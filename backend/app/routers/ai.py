from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.ticket import Ticket
from app.models.ticket_message import TicketMessage
from app.models.ai_usage import AIUsage
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    SuggestResponseRequest,
    SuggestResponseResponse,
    StructuredChatResponse,
)
from app.agent.graph import app_graph, llm
from app.agent.prompts import SUGGEST_RESPONSE_PROMPT

router = APIRouter(
    prefix="/ai",
    tags=["AI"],
)


@router.post("/chat", response_model=ChatResponse)
def chat_with_agent(
    data: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        initial_state = {
            "messages": [("user", data.message)],
            "customer_id": current_user.id,
        }
        config = {
            "configurable": {
                "thread_id": f"customer_{current_user.id}"
            }
        }

        result = app_graph.invoke(initial_state, config=config)
        last_message = result["messages"][-1]
        response_text = (
            last_message.content
            if hasattr(last_message, "content")
            else str(last_message)
        )

        db.add(
            AIUsage(
                user_id=current_user.id,
                operation="chat",
                success=True,
            )
        )
        db.commit()

        return ChatResponse(response=response_text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing AI chat request: {str(e)}",
        )


@router.post(
    "/suggest-response",
    response_model=SuggestResponseResponse,
    dependencies=[Depends(require_roles(UserRole.SUPPORT_AGENT, UserRole.ADMIN))],
)
def suggest_response(
    data: SuggestResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        ticket = db.scalar(select(Ticket).where(Ticket.id == data.ticket_id))
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket #{data.ticket_id} not found",
            )

        if (
            current_user.role == UserRole.SUPPORT_AGENT
            and ticket.assigned_agent_id != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not allowed to generate a suggestion for this ticket",
            )

        context = (
            f"Ticket Subject: {ticket.subject}\n"
            f"Ticket Description: {ticket.description}\n"
        )

        messages = db.scalars(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == data.ticket_id)
            .order_by(TicketMessage.id.desc())
            .limit(5)
        ).all()

        if messages:
            context += "Recent Messages:\n" + "\n".join(
                [f"- {m.content}" for m in reversed(messages)]
            ) + "\n"

        prompt = SUGGEST_RESPONSE_PROMPT.format(context=context.strip())
        ai_response = llm.invoke(prompt)
        text_content = (
            ai_response.content
            if hasattr(ai_response, "content")
            else str(ai_response)
        )

        db.add(
            AIUsage(
                user_id=current_user.id,
                operation="suggest_response",
                success=True,
            )
        )
        db.commit()

        return SuggestResponseResponse(suggested_response=text_content.strip())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating response suggestion: {str(e)}",
        )


from langchain_core.messages import HumanMessage


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Use provided thread_id or default to the user's thread
    thread_id = request.thread_id or f"customer_{current_user.id}"
    config = {"configurable": {"thread_id": thread_id}}
    events = []

    try:
        async for event in app_graph.astream(
            {"messages": [HumanMessage(content=request.message)], "customer_id": current_user.id},
            config=config,
        ):
            for node_name, node_output in event.items():
                output_data = {}
                if isinstance(node_output, dict) and "messages" in node_output:
                    msgs = []
                    for msg in node_output["messages"]:
                        if hasattr(msg, "content"):
                            tool_calls = getattr(msg, "tool_calls", [])
                            msgs.append({
                                "type": type(msg).__name__, 
                                "content": msg.content,
                                "tool_calls": tool_calls
                            })
                        else:
                            msgs.append(str(msg))
                    output_data["messages"] = msgs
                else:
                    output_data["data"] = str(node_output)

                events.append({
                    "node": node_name,
                    "output_type": type(node_output).__name__,
                    "output": output_data
                })

        db.add(
            AIUsage(
                user_id=current_user.id,
                operation="chat_stream",
                success=True,
            )
        )
        db.commit()

        return {"events": events, "thread_id": thread_id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error streaming chat: {str(e)}",
        )


@router.post("/chat/structured", response_model=StructuredChatResponse)
async def chat_structured(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        structured_llm = llm.with_structured_output(StructuredChatResponse)
        # In a real scenario, you might pass through the graph or just use LLM directly
        # depending on if state is required. Here we just invoke the structured LLM.
        result = structured_llm.invoke(request.message)

        db.add(
            AIUsage(
                user_id=current_user.id,
                operation="chat_structured",
                success=True,
            )
        )
        db.commit()
        
        if isinstance(result, dict):
            return StructuredChatResponse(**result)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing structured chat request: {str(e)}",
        )
