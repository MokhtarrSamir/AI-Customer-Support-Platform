from app.agent.graph import llm
from app.agent.prompts import CLASSIFY_TICKET_PROMPT
from app.schemas.ai import ClassifyTicketResponse


def classify_ticket(subject: str, description: str) -> ClassifyTicketResponse:
    structured_llm = llm.with_structured_output(ClassifyTicketResponse)

    prompt = CLASSIFY_TICKET_PROMPT.format(
        subject=subject,
        description=description,
    )

    result = structured_llm.invoke(prompt)

    if isinstance(result, dict):
        return ClassifyTicketResponse(**result)

    return result