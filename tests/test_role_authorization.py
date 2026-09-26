from app.models.user import User, UserRole
from app.core.security import hash_password


def make_user_with_role(db_session, email: str, role: UserRole, name: str = "Test User"):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("strongpassword123"),
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def login_headers(client, email: str, password: str = "strongpassword123"):
    response = client.post("/auth/login", json={"email": email, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_customer_cannot_access_admin_statistics(client, register_and_login):
    headers = register_and_login("customer_no_admin@example.com")

    response = client.get("/admin/statistics", headers=headers)

    assert response.status_code == 403


def test_admin_can_access_statistics(client, db_session):
    make_user_with_role(db_session, "admin1@example.com", UserRole.ADMIN)
    headers = login_headers(client, "admin1@example.com")

    response = client.get("/admin/statistics", headers=headers)

    assert response.status_code == 200
    assert "total_tickets" in response.json()


def test_agent_cannot_suggest_response_for_unassigned_ticket(client, register_and_login, db_session):
    customer_headers = register_and_login("customer_for_agent_test@example.com")

    create_response = client.post("/tickets", json={
        "subject": "Cannot access dashboard",
        "description": "The dashboard page shows a blank screen after login.",
        "message": "Please investigate this issue.",
    }, headers=customer_headers)
    ticket_id = create_response.json()["id"]

    make_user_with_role(db_session, "agent_unassigned@example.com", UserRole.SUPPORT_AGENT)
    agent_headers = login_headers(client, "agent_unassigned@example.com")

    response = client.post("/ai/suggest-response", json={"ticket_id": ticket_id}, headers=agent_headers)

    assert response.status_code == 403