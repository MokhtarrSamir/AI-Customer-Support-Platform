from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, UserRole
from app.models.ai_usage import AIUsage
from app.schemas.admin import AdminStatisticsResponse, SupportActivity, AIUsageResponse
from app.models.ticket import Ticket, TicketPriority, TicketStatus
from app.schemas.user import UserResponse
from app.models.ticket_message import TicketMessage

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
)

@router.get(
    "/statistics",
    response_model=AdminStatisticsResponse,
)
def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admins can view statistics",
        )

    total_tickets = db.scalar(
    select(func.count(Ticket.id))
    )

    open_tickets = db.scalar(
        select(func.count(Ticket.id))
        .where(Ticket.status == TicketStatus.OPEN)
    )

    in_progress_tickets = db.scalar(
        select(func.count(Ticket.id))
        .where(Ticket.status == TicketStatus.IN_PROGRESS)
    )

    resolved_tickets = db.scalar(
        select(func.count(Ticket.id))
        .where(Ticket.status == TicketStatus.RESOLVED)
    )

    critical_tickets = db.scalar(
        select(func.count(Ticket.id))
        .where(Ticket.priority == TicketPriority.CRITICAL)
    )

    category_rows = db.execute(
        select(
            Ticket.category,
            func.count(Ticket.id),
        )
        .group_by(Ticket.category)
    ).all()

    tickets_per_category = {
        category: count
        for category, count in category_rows
    }

    agent_rows = db.execute(
        select(
            User.id,
            User.name,
            func.count(Ticket.id),
        )
        .join(Ticket, Ticket.assigned_agent_id == User.id)
        .where(User.role == UserRole.SUPPORT_AGENT)
        .group_by(User.id, User.name)
        .order_by(User.id)
    ).all()

    tickets_per_agent = [
        {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "ticket_count": count,
        }
        for agent_id, agent_name, count in agent_rows
    ]

    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "in_progress_tickets": in_progress_tickets,
        "resolved_tickets": resolved_tickets,
        "critical_tickets": critical_tickets,
        "tickets_per_category": tickets_per_category,
        "tickets_per_agent": tickets_per_agent,
    }

@router.get(
    "/customers",
    response_model=list[UserResponse],
)
def get_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admins can view customers",
        )

    stmt = (
        select(User)
        .where(User.role == UserRole.CUSTOMER)
        .order_by(User.id)
    )

    return db.scalars(stmt).all()

@router.get(
    "/support-agents",
    response_model=list[UserResponse],
)
def get_support_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admins can view customers",
        )

    stmt = (
        select(User)
        .where(User.role == UserRole.SUPPORT_AGENT)
        .order_by(User.id)
    )

    return db.scalars(stmt).all()

@router.get(
    "/support-activity",
    response_model=list[SupportActivity],
)
def get_support_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admins can view support activity",
        )

    assigned_tickets = (
        select(func.count(Ticket.id))
        .where(Ticket.assigned_agent_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    resolved_tickets = (
        select(func.count(Ticket.id))
        .where(
            Ticket.assigned_agent_id == User.id,
            Ticket.status == TicketStatus.RESOLVED,
        )
        .correlate(User)
        .scalar_subquery()
    )

    messages_sent = (
        select(func.count(TicketMessage.id))
        .where(TicketMessage.sender_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    stmt = (
        select(
            User.id,
            User.name,
            assigned_tickets,
            resolved_tickets,
            messages_sent,
        )
        .where(User.role == UserRole.SUPPORT_AGENT)
        .order_by(User.id)
    )

    rows = db.execute(stmt).all()

    return [
        {
            "agent_id": agent_id,
            "agent_name": agent_name,
            "assigned_tickets": assigned_count,
            "resolved_tickets": resolved_count,
            "messages_sent": message_count,
        }
        for (
            agent_id,
            agent_name,
            assigned_count,
            resolved_count,
            message_count,
        ) in rows
    ]

@router.get(
    "/ai-usage",
    response_model=list[AIUsageResponse],
)
def get_ai_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only admins can view AI usage",
        )

    stmt = (
        select(
            AIUsage.id,
            AIUsage.user_id,
            User.name,
            AIUsage.operation,
            AIUsage.success,
            AIUsage.created_at,
        )
        .join(User, AIUsage.user_id == User.id)
        .order_by(AIUsage.created_at.desc())
    )

    rows = db.execute(stmt).all()

    return [
        {
            "id": usage_id,
            "user_id": user_id,
            "user_name": user_name,
            "operation": operation,
            "success": success,
            "created_at": created_at,
        }
        for (
            usage_id,
            user_id,
            user_name,
            operation,
            success,
            created_at,
        ) in rows
    ]