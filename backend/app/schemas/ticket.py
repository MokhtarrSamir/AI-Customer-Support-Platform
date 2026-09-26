from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.ticket import TicketCategory, TicketPriority, TicketStatus


class CreateTicketRequest(BaseModel):
    subject: str
    description: str
    message: str

class TicketResponse(BaseModel):
    id: int
    subject: str
    description: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    customer_id: int
    assigned_agent_id: int | None
    created_at: datetime
    updated_at: datetime
    ai_summary: str | None
    ai_suggested_action: str | None

    model_config = ConfigDict(from_attributes=True)

class UpdateTicketRequest(BaseModel):
    status: TicketStatus | None = None
    priority: TicketPriority | None = None

class AssignTicketRequest(BaseModel):
    agent_id: int