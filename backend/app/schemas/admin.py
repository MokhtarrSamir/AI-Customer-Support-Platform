from pydantic import BaseModel

from app.models.ticket import TicketCategory


class AgentTicketCount(BaseModel):
    agent_id: int
    agent_name: str
    ticket_count: int


class AdminStatisticsResponse(BaseModel):
    total_tickets: int
    open_tickets: int
    in_progress_tickets: int
    resolved_tickets: int
    critical_tickets: int
    tickets_per_category: dict[TicketCategory, int]
    tickets_per_agent: list[AgentTicketCount]

class SupportActivity(BaseModel):
    agent_id: int
    agent_name: str
    assigned_tickets: int
    resolved_tickets: int
    messages_sent: int