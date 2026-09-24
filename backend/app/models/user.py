from enum import Enum
from typing import TYPE_CHECKING
from datetime import datetime

from sqlalchemy import Enum as SQLEnum
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.ticket_message import TicketMessage


class UserRole(str, Enum):
    CUSTOMER = "customer"
    SUPPORT_AGENT = "support_agent"
    ADMIN = "admin"


class AccountStatus(str, Enum):
    ACTIVE = "active"
    DISABLED = "disabled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    nullable=False,
    server_default=func.now(),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole),
        default=UserRole.CUSTOMER,
        nullable=False
    )

    account_status: Mapped[AccountStatus] = mapped_column(
        SQLEnum(AccountStatus),
        default=AccountStatus.ACTIVE,
        nullable=False
    )

    created_tickets: Mapped[list["Ticket"]] = relationship(
        "Ticket",
        foreign_keys="Ticket.customer_id",
        back_populates="customer"
    )

    assigned_tickets: Mapped[list["Ticket"]] = relationship(
        "Ticket",
        foreign_keys="Ticket.assigned_agent_id",
        back_populates="assigned_agent"
    )

    messages: Mapped[list["TicketMessage"]] = relationship(
        "TicketMessage",
        foreign_keys="TicketMessage.sender_id",
        back_populates="sender"
    )