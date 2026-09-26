from sqlalchemy.orm import Session

from app.models.ticket import Ticket, TicketCategory, TicketPriority, TicketStatus
from app.models.ticket_message import TicketMessage


def get_customer_tickets(db: Session, customer_id: int) -> list[Ticket]:
    return db.query(Ticket).filter(Ticket.customer_id == customer_id).all()


def get_customer_ticket(db: Session, ticket_id: int, customer_id: int) -> Ticket | None:
    return (
        db.query(Ticket)
        .filter(Ticket.id == ticket_id, Ticket.customer_id == customer_id)
        .first()
    )


def create_customer_ticket(
    db: Session,
    customer_id: int,
    subject: str,
    description: str,
    category: TicketCategory,
    priority: TicketPriority,
) -> Ticket:
    ticket = Ticket(
        customer_id=customer_id,
        subject=subject,
        description=description,
        category=category,
        priority=priority,
        status=TicketStatus.OPEN,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def update_ticket_priority(db: Session, ticket: Ticket, priority: TicketPriority) -> None:
    ticket.priority = priority
    db.commit()


def update_ticket_status(db: Session, ticket: Ticket, status: TicketStatus) -> None:
    ticket.status = status
    db.commit()


def add_ticket_message(db: Session, ticket_id: int, sender_id: int, content: str) -> TicketMessage:
    message = TicketMessage(
        ticket_id=ticket_id,
        sender_id=sender_id,
        content=content,
    )
    db.add(message)
    db.commit()
    return message