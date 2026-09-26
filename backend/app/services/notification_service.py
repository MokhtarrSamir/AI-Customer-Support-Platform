import httpx

from app.core.config import settings


def trigger_n8n_webhook(path: str, payload: dict) -> None:
    """Fire-and-forget POST to an n8n webhook. Never raises."""
    if not settings.N8N_WEBHOOK_URL:
        return

    url = f"{settings.N8N_WEBHOOK_URL.rstrip('/')}/webhook/{path}"

    try:
        httpx.post(url, json=payload, timeout=5)
    except Exception as e:
        print(f"n8n webhook '{path}' failed: {e}")