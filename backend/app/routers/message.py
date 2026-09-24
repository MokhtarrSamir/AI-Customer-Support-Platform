from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.ticket import Ticket
from app.models.ticket_message import TicketMessage
from app.models.user import User, UserRole
from app.schemas.message import CreateMessageRequest, MessageResponse


router = APIRouter(
    prefix="/tickets",
    tags=["Messages"],
)

@router.post(
    "/{ticket_id}/messages",
    response_model=MessageResponse,
)
def create_message(
    ticket_id: int,
    data: CreateMessageRequest,
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
                detail="Not allowed to add a message to this ticket",
            )

    elif current_user.role == UserRole.SUPPORT_AGENT:
        if ticket.assigned_agent_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not allowed to add a message to this ticket",
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Not allowed to add messages",
        )

    message = TicketMessage(
        content=data.content,
        ticket_id=ticket.id,
        sender_id=current_user.id,
    )

    db.add(message)
    db.commit()
    db.refresh(message)

    return message

@router.get(
    "/{ticket_id}/messages",
    response_model=list[MessageResponse],
)
def get_messages(
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
                detail="Not allowed to view this conversation",
            )

    elif current_user.role == UserRole.SUPPORT_AGENT:
        if ticket.assigned_agent_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Not allowed to view this conversation",
            )
    elif current_user.role == UserRole.ADMIN:
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="Not allowed to view conversations",
        )

    stmt = (
        select(TicketMessage)
        .where(TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.id)
    )

    return db.scalars(stmt).all()