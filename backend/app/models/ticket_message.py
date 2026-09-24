from typing import TYPE_CHECKING
from datetime import datetime

from sqlalchemy import ForeignKey, Text, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.user import User


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        index=True
    )

    timestamp: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    nullable=False,
    server_default=func.now(),
)

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )

    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("tickets.id"),
        nullable=False,
        index=True
    )

    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    ticket: Mapped["Ticket"] = relationship(
        "Ticket",
        back_populates="messages"
    )

    sender: Mapped["User"] = relationship(
        "User",
        foreign_keys=[sender_id],
        back_populates="messages"
    )