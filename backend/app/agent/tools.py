from typing import Optional, Annotated
from langgraph.prebuilt import InjectedState
from langchain_core.tools import tool
from app.core.database import SessionLocal
from app.models.ticket import TicketCategory, TicketPriority, TicketStatus
from app.services.notification_service import trigger_n8n_webhook
from app.services import ticket_service

@tool
def get_customer_tickets(customer_id: Annotated[int, InjectedState("customer_id")]) -> str:
    """Retrieve all tickets belonging to a specific customer using their customer ID."""
    db = SessionLocal()
    try:
        tickets = ticket_service.get_customer_tickets(db, customer_id)
        if not tickets:
            return f"No tickets found for customer ID {customer_id}."

        results = [f"Ticket #{t.id}: {t.subject} - Status: {t.status.value} - Priority: {t.priority.value}" for t in tickets]
        return "\n".join(results)
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        db.close()

@tool
def get_ticket_details(ticket_id: int, customer_id: Annotated[int, InjectedState("customer_id")]) -> str:
    """Retrieve detailed information about a specific ticket using its ID. 
    Requires the customer_id to ensure the ticket belongs to the requesting user."""
    db = SessionLocal()
    try:
        ticket = ticket_service.get_customer_ticket(db, ticket_id, customer_id)
        if not ticket:
            return f"Ticket #{ticket_id} was not found or you do not have permission to view it."

        return (
            f"Ticket #{ticket.id} Details:\n"
            f"- Subject: {ticket.subject}\n"
            f"- Description: {ticket.description}\n"
            f"- Status: {ticket.status.value}\n"
            f"- Priority: {ticket.priority.value}\n"
            f"- Category: {ticket.category.value}\n"
            f"- Assigned Agent ID: {ticket.assigned_agent_id or 'Unassigned'}"
        )
    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        db.close()

@tool
def create_ticket(
    customer_id: Annotated[int, InjectedState("customer_id")],
    subject: str,
    description: str,
    category: str = "general_inquiry",
    priority: str = "medium"
) -> str:
    """Create a new support ticket in the database when the customer explicitly requests it.
    Valid categories: 'technical_issue', 'account_issue', 'billing', 'product_issue', 'general_inquiry'.
    Valid priorities: 'low', 'medium', 'high', 'critical'.
    """
    db = SessionLocal()
    try:
        category_enum = TicketCategory(category.lower())
    except ValueError:
        category_enum = TicketCategory.GENERAL_INQUIRY

    try:
        priority_enum = TicketPriority(priority.lower())
    except ValueError:
        priority_enum = TicketPriority.MEDIUM

    try:
        new_ticket = ticket_service.create_customer_ticket(
            db,
            customer_id=customer_id,
            subject=subject,
            description=description,
            category=category_enum,
            priority=priority_enum,
        )

        return (
            f"Ticket #{new_ticket.id} created successfully.\n"
            f"- Subject: {new_ticket.subject}\n"
            f"- Category: {new_ticket.category.value}\n"
            f"- Priority: {new_ticket.priority.value}\n"
            f"- Status: {new_ticket.status.value}"
        )
    except Exception as e:
        db.rollback()
        return f"Error creating ticket: {str(e)}"
    finally:
        db.close()

@tool
def check_ticket_status(ticket_id: int, customer_id: Annotated[int, InjectedState("customer_id")]) -> str:
    """Check the current status of a specific support ticket.
    Requires ticket_id and customer_id for authorization.
    """
    db = SessionLocal()
    try:
        ticket = ticket_service.get_customer_ticket(db, ticket_id, customer_id)
        if not ticket:
            return f"Ticket #{ticket_id} was not found or does not belong to you."

        return f"Ticket #{ticket.id} ('{ticket.subject}') status is currently: {ticket.status.value}"
    except Exception as e:
        return f"Error checking ticket status: {str(e)}"
    finally:
        db.close()

@tool
def update_ticket(
    ticket_id: int,
    customer_id: Annotated[int, InjectedState("customer_id")],
    status: Optional[str] = None,
    priority: Optional[str] = None
) -> str:
    """Update permitted fields (status or priority) of an existing ticket.
    Requires ticket_id and customer_id for authorization.
    A closed ticket cannot be updated.
    Valid status values: 'open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'.
    Valid priority values: 'low', 'medium', 'high', 'critical'.
    """
    db = SessionLocal()
    try:
        ticket = ticket_service.get_customer_ticket(db, ticket_id, customer_id)
        if not ticket:
            return f"Ticket #{ticket_id} was not found or does not belong to you."

        if ticket.status == TicketStatus.CLOSED:
            return f"Ticket #{ticket_id} is closed and cannot be updated. A new ticket can be opened instead."

        updated_fields = []

        if status:
            try:
                new_status = TicketStatus(status.lower())
            except ValueError:
                return f"Invalid status: '{status}'."

            if new_status in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
                return (
                    "Customers cannot mark a ticket as resolved or closed. "
                    "A support agent will confirm resolution. "
                    "If your issue is fixed, you can let us know and we'll close it from our side."
                )

            if ticket.status == new_status:
                updated_fields.append(f"Status is already '{new_status.value}'")
            else:
                ticket_service.update_ticket_status(db, ticket, new_status)
                updated_fields.append(f"Status to '{new_status.value}'")

        if priority:
            try:
                new_priority = TicketPriority(priority.lower())
            except ValueError:
                return f"Invalid priority: '{priority}'."

            if ticket.priority == new_priority:
                updated_fields.append(f"Priority is already '{new_priority.value}'")
            else:
                ticket_service.update_ticket_priority(db, ticket, new_priority)
                updated_fields.append(f"Priority to '{new_priority.value}'")

        if not updated_fields:
            return "No valid fields were provided to update."

        return f"Ticket #{ticket_id} result: " + ", ".join(updated_fields)

    except Exception as e:
        db.rollback()
        return f"Error updating ticket: {str(e)}"
    finally:
        db.close()

@tool
def escalate_ticket(ticket_id: int, customer_id: Annotated[int, InjectedState("customer_id")], reason: str) -> str:
    """Escalate a support ticket to human agents or higher support tier.
    Requires ticket_id, customer_id for authorization, and reason for escalation.
    Cannot escalate resolved or closed tickets.
    """
    db = SessionLocal()
    try:
        ticket = ticket_service.get_customer_ticket(db, ticket_id, customer_id)
        if not ticket:
            return f"Ticket #{ticket_id} was not found or does not belong to you."

        if ticket.status in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
            return f"Ticket #{ticket_id} cannot be escalated because it is already {ticket.status.value}."

        ticket_service.update_ticket_priority(db, ticket, TicketPriority.CRITICAL)
        ticket_service.add_ticket_message(
            db,
            ticket_id=ticket.id,
            sender_id=customer_id,
            content=f"[ESCALATION REASON]: {reason}",
        )

        trigger_n8n_webhook("ticket-escalation", {
            "ticket_id": ticket.id,
            "customer": customer_id,
            "subject": ticket.subject,
            "priority": ticket.priority.value,
            "status": "Escalated",
        })

        return (
            f"Ticket #{ticket.id} has been escalated to CRITICAL priority.\n"
            f"- Reason recorded: {reason}\n"
            f"- The ticket is flagged for human agent review."
        )
    except Exception as e:
        db.rollback()
        return f"Error escalating ticket: {str(e)}"
    finally:
        db.close()