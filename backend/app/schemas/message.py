from pydantic import BaseModel, ConfigDict

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
    sender: MessageSenderResponse

    model_config = ConfigDict(from_attributes=True)



