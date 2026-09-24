from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.auth import router as auth_router
from app.routers.ticket import router as ticket_router
from app.routers.message import router as message_router
from app.routers.user import router as user_router
from app.routers.ai import router as ai_router


app = FastAPI(
    title="AI Customer Support Platform",
)
app.include_router(auth_router)
app.include_router(ticket_router)
app.include_router(message_router)
app.include_router(user_router)
app.include_router(ai_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def database_health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))

    return {"status": "database connected"}

