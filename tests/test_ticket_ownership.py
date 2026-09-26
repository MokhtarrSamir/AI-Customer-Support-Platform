def test_customer_can_create_and_view_own_ticket(client, register_and_login):
    headers = register_and_login("owner1@example.com")

    create_response = client.post("/tickets", json={
        "subject": "Cannot login",
        "description": "I forgot my password and reset link is not working.",
        "message": "Please help me access my account.",
    }, headers=headers)

    assert create_response.status_code == 200
    ticket_id = create_response.json()["id"]

    get_response = client.get(f"/tickets/{ticket_id}", headers=headers)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == ticket_id


def test_customer_cannot_view_other_customers_ticket(client, register_and_login):
    owner_headers = register_and_login("owner2@example.com")
    intruder_headers = register_and_login("intruder2@example.com")

    create_response = client.post("/tickets", json={
        "subject": "Billing issue",
        "description": "I was charged twice for the same order.",
        "message": "Please refund the extra charge.",
    }, headers=owner_headers)

    ticket_id = create_response.json()["id"]

    intruder_response = client.get(f"/tickets/{ticket_id}", headers=intruder_headers)

    assert intruder_response.status_code == 403