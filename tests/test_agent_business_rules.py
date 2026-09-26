from app.models.ticket import Ticket, TicketStatus


def test_customer_cannot_resolve_ticket_via_chatbot(client, register_and_login, db_session):
    headers = register_and_login("agent_rule_customer@example.com")

    create_response = client.post("/tickets", json={
        "subject": "App crashes on startup",
        "description": "The mobile app crashes immediately after opening it.",
        "message": "Please help, this started yesterday.",
    }, headers=headers)
    ticket_id = create_response.json()["id"]

    chat_response = client.post("/ai/chat", json={
        "message": f"Please mark ticket #{ticket_id} as resolved.",
        "thread_id": f"test-thread-{ticket_id}",
    }, headers=headers)

    assert chat_response.status_code == 200

    db_session.expire_all()
    ticket = db_session.query(Ticket).filter(Ticket.id == ticket_id).first()
    assert ticket.status != TicketStatus.RESOLVED
    assert ticket.status != TicketStatus.CLOSED