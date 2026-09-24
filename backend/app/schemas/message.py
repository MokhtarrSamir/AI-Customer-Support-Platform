from pydantic import BaseModel, ConfigDict
from datetime import datetime

class MessageSenderResponse(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)

class CreateMessageRequest(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: int
    content: str
    ticket_id: int
    sender_id: int
    timestamp: datetime
    sender: MessageSenderResponse

    model_config = ConfigDict(from_attributes=True)



