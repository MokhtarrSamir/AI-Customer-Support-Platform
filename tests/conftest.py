import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env.test", override=True)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.config import settings
from app.main import app

engine = create_engine(settings.DATABASE_URL)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture()
def register_and_login(client):
    def _register_and_login(email: str, password: str = "strongpassword123", name: str = "Test User"):
        client.post("/auth/register", json={
            "name": name,
            "email": email,
            "password": password,
        })

        login_response = client.post("/auth/login", json={
            "email": email,
            "password": password,
        })

        token = login_response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _register_and_login