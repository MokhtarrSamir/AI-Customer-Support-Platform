from app.agent.graph import llm
from app.agent.prompts import classify_ticket_template
from app.schemas.ai import ClassifyTicketResponse


def classify_ticket(subject: str, description: str) -> ClassifyTicketResponse:
    structured_llm = llm.with_structured_output(ClassifyTicketResponse)

    prompt = classify_ticket_template.invoke({
        "subject": subject,
        "description": description,
    })

    result = structured_llm.invoke(prompt)

    if isinstance(result, dict):
        return ClassifyTicketResponse(**result)

    return result