from typing import Optional
from langgraph.graph import MessagesState


class AgentState(MessagesState):
    customer_id: int
    intent: Optional[str] = None
    tool_required: Optional[bool] = False