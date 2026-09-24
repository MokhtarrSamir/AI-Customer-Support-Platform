from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.user import AccountStatus, UserRole


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    account_status: AccountStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)