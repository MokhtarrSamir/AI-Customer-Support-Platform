import os
from dotenv import load_dotenv

load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver

from app.agent.state import AgentState
from app.agent.prompts import SYSTEM_PROMPT
from app.agent.tools import (
    get_customer_tickets,
    get_ticket_details,
    create_ticket,
    check_ticket_status,
    update_ticket,
    escalate_ticket
)

tools = [
    get_customer_tickets,
    get_ticket_details,
    create_ticket,
    check_ticket_status,
    update_ticket,
    escalate_ticket
]

llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="openai/gpt-oss-120b",
    temperature=0
)

llm_with_tools = llm.bind_tools(tools)

def receive_message_node(state: AgentState):
    messages = list(state.get("messages", []))
    customer_id = state.get("customer_id")
    
    if not any(isinstance(m, SystemMessage) for m in messages):
        formatted_prompt = SYSTEM_PROMPT.format(customer_id=customer_id)
        messages.insert(0, SystemMessage(content=formatted_prompt))
        
    return {"messages": messages}

def analyze_request_node(state: AgentState):
    messages = state.get("messages", [])
    response = llm_with_tools.invoke(messages)
    
    intent = "ask_general_question"
    tool_required = False
    
    if hasattr(response, "tool_calls") and len(response.tool_calls) > 0:
        tool_required = True
        intent = response.tool_calls[0]["name"]
        
    return {
        "messages": [response],
        "intent": intent,
        "tool_required": tool_required
    }

execute_tool_node = ToolNode(tools)

def generate_response_node(state: AgentState):
    messages = state.get("messages", [])
    response = llm_with_tools.invoke(messages)
    
    return {"messages": [response]}

def escalation_node(state: AgentState):
    escalation_message = AIMessage(
        content="This ticket requires human intervention. It has been escalated to the support team."
    )
    
    return {
        "messages": [escalation_message],
        "intent": "escalated"
    }

def decide_route(state: AgentState):
    intent = state.get("intent")
    
    if intent == "escalate_ticket":
        return "escalation"
    elif state.get("tool_required"):
        return "execute_tool"
        
    return "generate_response"

workflow = StateGraph(AgentState)

workflow.add_node("receive_message", receive_message_node)
workflow.add_node("analyze_request", analyze_request_node)
workflow.add_node("execute_tool", execute_tool_node)
workflow.add_node("generate_response", generate_response_node)
workflow.add_node("escalation", escalation_node)

workflow.add_edge(START, "receive_message")
workflow.add_edge("receive_message", "analyze_request")

workflow.add_conditional_edges(
    "analyze_request",
    decide_route
)

workflow.add_edge("execute_tool", "generate_response")
workflow.add_edge("generate_response", END)
workflow.add_edge("escalation", END)

memory = MemorySaver()
app_graph = workflow.compile(checkpointer=memory)