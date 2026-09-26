from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole, AccountStatus
from app.models.ticket import Ticket
from app.models.ticket_message import TicketMessage
from app.schemas.ticket import CreateTicketRequest, TicketResponse, UpdateTicketRequest, AssignTicketRequest
from app.services.ai_service import classify_ticket
from app.models.ai_usage import AIUsage
from app.services.notification_service import trigger_n8n_webhook

router = APIRouter(
    prefix="/tickets",
    tags=["Tickets"],
)

@router.post("", response_model=TicketResponse)
def create_ticket(
    data: CreateTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(
            status_code=403,
            detail="Only customers can create tickets",
        )

    try:
        classification = classify_ticket(
            subject=data.subject,
            description=data.description,
        )

        ticket = Ticket(
            subject=data.subject,
            description=data.description,
            category=classification.category,
            priority=classification.priority,
            ai_summary=classification.summary,
            ai_suggested_action=classification.suggested_action,
            customer_id=current_user.id,
        )

        db.add(ticket)
        db.flush()

        message = TicketMessage(
            content=data.message,
            ticket_id=ticket.id,
            sender_id=current_user.id,
        )

        db.add(message)

        db.add(
            AIUsage(
                user_id=current_user.id,
                operation="classify_ticket",
                success=True,
            )
        )

        db.commit()
        db.refresh(ticket)

        trigger_n8n_webhook("new-ticket", {
            "ticket_id": ticket.id,
            "customer": current_user.name,
            "subject": ticket.subject,
            "category": ticket.category.value,
            "priority": ticket.priority.value,
            "status": ticket.status.value,
        })

        return ticket

    except Exception as e:
        db.rollback()

        db.add(
            AIUsage(
                user_id=current_user.id,
                operation="classify_ticket",
                success=False,
            )
        )
        db.commit()

        raise HTTPException(
            status_code=500,
            detail=f"Error creating ticket: {str(e)}",
        )

@router.get("", response_model=list[TicketResponse])
def get_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == UserRole.CUSTOMER:
        stmt = select(Ticket).where(
            Ticket.customer_id == current_user.id
        )

    elif current_user.role == UserRole.SUPPORT_AGENT:
        stmt = select(Ticket).where(
            Ticket.assigned_agent_id == current_user.id
        )

    elif current_user.role == UserRole.ADMIN:
        stmt = select(Ticket)

    else:
        raise HTTPException(
            status_code=403,
            detail="Not allowed to view tickets",
        )

    return db.scalars(stmt).all()

@router.get("/{ticket_id}", response_model=TicketResponse)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.scalar(
        select(Ticket).where(Ticket.id == ticket_id)
    )

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    if current_user.role == UserRole.CUSTOMER:
        if ticket.customer_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not allowed to access this ticket",
            )

    elif current_user.role == UserRole.SUPPORT_AGENT:
        if ticket.assigned_agent_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not allowed to access this ticket",
            )

    elif current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Not allowed to access this ticket",
        )

    return ticket

@router.patch("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    data: UpdateTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (
        UserRole.SUPPORT_AGENT,
        UserRole.ADMIN,
    ):
        raise HTTPException(
            status_code=403,
            detail="Not allowed to update this ticket",
        )

    ticket = db.scalar(
        select(Ticket).where(Ticket.id == ticket_id)
    )

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    if (
        current_user.role == UserRole.SUPPORT_AGENT
        and ticket.assigned_agent_id != current_user.id
    ):
        raise HTTPException(
            status_code=403,
            detail="Not allowed to update this ticket",
        )

    if data.status is not None:
        ticket.status = data.status

    if data.priority is not None:
        ticket.priority = data.priority

    db.commit()
    db.refresh(ticket)

    return ticket

@router.patch("/{ticket_id}/assign", response_model=TicketResponse)
def assign_ticket(
    ticket_id: int,
    data: AssignTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (
        UserRole.SUPPORT_AGENT,
        UserRole.ADMIN,
    ):
        raise HTTPException(
            status_code=403,
            detail="Not allowed to assign tickets",
        )

    ticket = db.scalar(
        select(Ticket).where(Ticket.id == ticket_id)
    )

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    agent = db.scalar(
        select(User).where(User.id == data.agent_id)
    )

    if agent is None:
        raise HTTPException(
            status_code=404,
            detail="Agent not found",
        )

    if agent.role != UserRole.SUPPORT_AGENT:
        raise HTTPException(
            status_code=400,
            detail="User is not a support agent",
        )

    if agent.account_status != AccountStatus.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Support agent account is disabled",
        )

    ticket.assigned_agent_id = agent.id

    db.commit()
    db.refresh(ticket)

    return ticket