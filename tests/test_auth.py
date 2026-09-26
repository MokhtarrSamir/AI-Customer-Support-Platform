def test_register_success(client):
    response = client.post("/auth/register", json={
        "name": "Test Customer",
        "email": "customer1@example.com",
        "password": "strongpassword123",
    })

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "customer1@example.com"


def test_register_duplicate_email_fails(client):
    payload = {
        "name": "Test Customer",
        "email": "duplicate@example.com",
        "password": "strongpassword123",
    }
    client.post("/auth/register", json=payload)

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 400


def test_login_wrong_password_fails(client):
    client.post("/auth/register", json={
        "name": "Test Customer",
        "email": "wrongpass@example.com",
        "password": "correctpassword",
    })

    response = client.post("/auth/login", json={
        "email": "wrongpass@example.com",
        "password": "incorrectpassword",
    })

    assert response.status_code == 401


def test_login_success_and_me(client):
    client.post("/auth/register", json={
        "name": "Test Customer",
        "email": "loginok@example.com",
        "password": "strongpassword123",
    })

    login_response = client.post("/auth/login", json={
        "email": "loginok@example.com",
        "password": "strongpassword123",
    })

    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert me_response.status_code == 200
    assert me_response.json()["email"] == "loginok@example.com"