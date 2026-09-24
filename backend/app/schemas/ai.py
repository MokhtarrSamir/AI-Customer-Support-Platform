from typing import Optional, Literal
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., description="User message to the chatbot")
    thread_id: Optional[str] = Field(None, description="Thread ID for the conversation")


class ChatResponse(BaseModel):
    response: str = Field(..., description="Assistant response message")


class StructuredChatResponse(BaseModel):
    response: str = Field(..., description="Assistant response message")
    confidence_score: float = Field(..., description="Confidence score of the response")
    sources: list[str] = Field(default_factory=list, description="Sources used for the response")


class SuggestResponseRequest(BaseModel):
    ticket_id: int = Field(..., description="ID of the ticket to generate a suggestion for")


class SuggestResponseResponse(BaseModel):
    suggested_response: str = Field(..., description="Generated professional response suggestion")


class ClassifyTicketRequest(BaseModel):
    subject: str = Field(..., description="Subject of the support ticket")
    description: str = Field(..., description="Detailed description of the customer issue")


class ClassifyTicketResponse(BaseModel):
    category: Literal[
        "technical_issue",
        "account_issue",
        "billing",
        "product_issue",
        "general_inquiry",
    ] = Field(..., description="Predicted category for the ticket")
    priority: Literal["low", "medium", "high", "critical"] = Field(
        ..., description="Predicted priority level"
    )
    summary: str = Field(..., description="Brief summary of the issue")
    suggested_action: str = Field(..., description="Suggested resolution action for support team")
