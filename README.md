# AI Customer Support Platform

An AI-powered customer support platform where a real **AI Agent** — not a scripted chatbot — understands customer requests, decides whether a backend tool is required, executes it, and responds accordingly. Built as a full-stack graduation project with a FastAPI backend, a React frontend, and n8n-driven automation.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [API Overview](#api-overview)
- [Roles & Permissions](#roles--permissions)
- [The AI Agent](#the-ai-agent)
- [n8n Automation](#n8n-automation)
- [Testing](#testing)

---

## Overview

Customers submit support tickets that are automatically classified by AI (category, priority, summary, suggested action). Support agents manage assigned tickets, converse with customers, and can request AI-drafted replies that they review and send themselves — the AI never contacts a customer directly. Admins oversee the whole platform: users, roles, ticket assignment, and system-wide analytics.

A conversational **AI Agent**, built with LangChain and LangGraph, lets customers check their tickets, ask about status, create new tickets, or escalate an issue in natural language — always through authenticated, permission-checked backend tools, never by touching the database directly.

> **Out of scope by design:** RAG, vector databases, embeddings, and fine-tuning are intentionally not part of this project.

---

## Key Features

- **Authentication & Authorization** — JWT-based auth, password hashing, and role-based access control (`Customer`, `Support Agent`, `Admin`).
- **Ticket Lifecycle Management** — creation, categorization, prioritization, status tracking, assignment, and threaded conversations.
- **AI Ticket Classification** — every new ticket is automatically classified (category, priority, summary, suggested action) and the result is stored in PostgreSQL. A separate preview endpoint lets customers see a suggested classification before submitting.
- **Conversational AI Agent** — a LangGraph-driven agent with tool-calling that can retrieve tickets, check status, create tickets, update permitted fields, and escalate — always scoped to the authenticated customer.
- **AI-Assisted Agent Replies** — support agents can request an AI-drafted response, edit it, and send it manually. Nothing is sent to a customer without human confirmation.
- **Admin Analytics** — platform-wide statistics, per-agent support activity, and AI usage logs, all backed by dedicated endpoints and surfaced in the admin dashboard.
- **Workflow Automation (n8n)** — new-ticket notifications, critical-ticket escalation alerts, and ticket reporting to Google Sheets.

---

## Architecture

```
                         ┌─────────────────────┐
                         │   React Frontend     │
                         │ (Customer/Agent/Admin)│
                         └──────────┬───────────┘
                                    │ REST (JWT)
                                    ▼
                         ┌─────────────────────┐
                         │     FastAPI Backend  │
                         │  Routers → Services   │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
         ┌───────────────┐ ┌───────────────┐  ┌────────────────┐
         │  PostgreSQL    │ │  AI Agent      │  │  n8n Webhooks   │
         │  (SQLAlchemy)  │ │ (LangGraph +   │  │ (notifications, │
         │                │ │  LangChain)    │  │  escalation,    │
         │                │ │                │  │  reporting)     │
         └───────────────┘ └───────────────┘  └────────────────┘
```

**AI ↔ Backend contract:** the AI Agent never touches the database directly. Every agent tool calls a backend service, which enforces the same authentication, authorization, and validation rules as the human-facing REST endpoints.

```
AI Agent → Agent Tool → Backend Service → Database
```

### Agent Workflow (LangGraph)

```
Receive Message → Analyze Request → Tool required?
                                        │
                        ┌───────────────┴───────────────┐
                       Yes                               No
                        │                                 │
                 Execute Tool                    Generate Response
                        │
             Escalation needed? ──Yes──► Escalation Node
                        │
                        No
                        │
               Generate Response
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI |
| Database | PostgreSQL |
| ORM / Migrations | SQLAlchemy + Alembic |
| Auth | JWT (PyJWT), pwdlib (Argon2) |
| AI / LLM | LangChain, LangGraph, Groq (`langchain_groq`) |
| Frontend | React + Vite |
| Automation | n8n (webhooks, Gmail, Google Sheets) |
| Testing | pytest |

---

## Project Structure

```
project-root/
├── backend/
│   └── app/
│       ├── main.py                # FastAPI app, router registration, health checks
│       ├── core/
│       │   ├── config.py          # environment-based settings
│       │   ├── database.py        # SQLAlchemy engine/session
│       │   └── security.py        # password hashing, JWT, auth dependencies
│       ├── routers/                # auth, ticket, message, user, admin, ai
│       ├── models/                 # User, Ticket, TicketMessage, AIUsage
│       ├── schemas/                # Pydantic request/response contracts
│       ├── services/                # ticket_service, ai_service, notification_service
│       └── agent/
│           ├── graph.py            # LangGraph workflow definition
│           ├── tools.py            # backend-connected agent tools
│           ├── prompts.py          # system & task prompts
│           └── state.py            # agent state schema
├── frontend/                        # React (Vite) single-page app
├── n8n/workflows/                   # exported n8n automation workflows
├── alembic/                         # database migrations
├── tests/                           # pytest suite
├── requirements.txt
└── .env.example
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- PostgreSQL
- Node.js 18+
- A Groq API key (for the LLM)

### Backend

```bash
# from the project root
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env              # fill in the values, see below
alembic upgrade head              # apply all migrations

uvicorn app.main:app --reload --app-dir backend
```

The API is now available at `http://localhost:8000`, with interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
cp .env.example .env              # set VITE_API_URL and VITE_MOCK_MODE
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Set `VITE_MOCK_MODE=true` to run the UI against built-in mock data without a backend.

---

## Environment Variables

**Backend (`.env`)**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET_KEY` | secret used to sign access tokens |
| `JWT_ALGORITHM` | defaults to `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | token lifetime, defaults to `30` |
| `GROQ_API_KEY` | API key for the LLM used by the AI Agent |
| `N8N_WEBHOOK_URL` | base URL n8n webhooks are triggered on (optional) |

**Frontend (`frontend/.env`)**

| Variable | Description |
|---|---|
| `VITE_API_URL` | backend base URL, e.g. `http://localhost:8000` |
| `VITE_MOCK_MODE` | `true` to run the UI fully mocked, no backend required |

---

## Database Migrations

Migrations are managed with Alembic.

```bash
# generate a migration after changing a model
alembic revision --autogenerate -m "describe the change"

# review the generated file, then apply it
alembic upgrade head

# check the currently applied revision
alembic current
```

---

## API Overview

Full interactive documentation is available at `/docs` (Swagger UI) once the backend is running. Summary of the main resource groups:

| Group | Examples |
|---|---|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| **Tickets** | `POST /tickets`, `GET /tickets`, `GET /tickets/{id}`, `PATCH /tickets/{id}`, `PATCH /tickets/{id}/assign` |
| **Messages** | `POST /tickets/{id}/messages`, `GET /tickets/{id}/messages` |
| **Users** | `GET /users`, `PATCH /users/{id}/disable`, `PATCH /users/{id}/activate`, `PATCH /users/{id}/role`, `DELETE /users/{id}` |
| **Admin** | `GET /admin/statistics`, `GET /admin/support-activity`, `GET /admin/ai-usage`, `GET /admin/customers`, `GET /admin/support-agents` |
| **AI** | `POST /ai/classify-ticket`, `POST /ai/suggest-response`, `POST /ai/chat` |

All endpoints (except `/auth/register` and `/auth/login`) require a `Bearer` JWT and are gated by role and, where relevant, resource ownership (a customer can only access their own tickets; an agent only their assigned tickets).

---

## Roles & Permissions

| Capability | Customer | Support Agent | Admin |
|---|:---:|:---:|:---:|
| Register / Login | ✅ | ✅ | ✅ |
| Create tickets | ✅ | ❌ | ❌ |
| View own / assigned / all tickets | own only | assigned only | all |
| Reply in a ticket conversation | ✅ (own) | ✅ (assigned) | ❌ |
| Change ticket status / priority | ❌ | ✅ (assigned) | ✅ |
| Assign tickets to an agent | ❌ | ❌ | ✅ |
| Request AI-suggested reply | ❌ | ✅ | ❌ |
| Use the conversational AI Agent | ✅ | ✅ | ❌ |
| Manage users & roles | ❌ | ❌ | ✅ |
| View platform statistics / AI usage | ❌ | ❌ | ✅ |

The frontend only renders controls a given role is actually permitted to use — the same rules are enforced independently on the backend.

---

## The AI Agent

Implemented with **LangChain** (chat model, prompt templates, tool calling, structured output) and **LangGraph** (state management and workflow routing).

### Available Tools

| Tool | Purpose |
|---|---|
| `get_customer_tickets` | list all tickets belonging to the authenticated customer |
| `get_ticket_details` | fetch full details of a specific ticket the customer owns |
| `create_ticket` | create a new ticket, only when explicitly requested |
| `check_ticket_status` | check the current status of a ticket |
| `update_ticket` | update status/priority within allowed business rules |
| `escalate_ticket` | escalate to human support with a required reason |

**Business rules enforced by the agent (not just the prompt):**
- The customer's identity is injected automatically — the agent never asks for or trusts a customer ID from the conversation.
- A ticket cannot be updated once it is `closed`.
- The agent cannot mark a ticket as `resolved` or `closed` — only a human support agent can.
- Escalation requires a reason and cannot be applied to `resolved`/`closed` tickets.

### AI Ticket Classification

On ticket creation, the backend calls the LLM with structured output to produce a `category`, `priority`, `summary`, and `suggested_action`, which are stored directly on the ticket. A separate, read-only `POST /ai/classify-ticket` endpoint lets a customer preview a classification before submitting — the preview has no effect on what is ultimately stored; the ticket-creation flow always classifies independently to prevent a client from injecting an unverified priority or category.

### AI-Suggested Agent Responses

```
Agent → requests AI suggestion → AI drafts a reply → Agent reviews/edits → Agent sends manually
```

The AI never sends a message to a customer automatically.

---

## n8n Automation

Exported workflows live in `n8n/workflows/`:

1. **New Ticket Notification** — triggered when a ticket is created; notifies the team via email.
2. **Critical Ticket Escalation** — triggered when a ticket is escalated or reaches `critical` priority; sends an alert email.
3. **Ticket Reporting (Google Sheets)** — logs ticket data to a Google Sheet for tracking and reporting.

Workflows are triggered by the backend via `trigger_n8n_webhook()`, which fires a fail-safe (non-blocking) POST request to the configured `N8N_WEBHOOK_URL` — a failure in n8n never breaks the main request.

---

## Testing

```bash
pytest
```

The suite covers, among other things:

- Registration, login, and `/auth/me`
- Ticket ownership boundaries (a customer cannot view another customer's ticket)
- Role-based authorization on admin and AI endpoints
- Business-rule enforcement in the AI Agent (e.g. a customer cannot resolve a ticket via the chatbot)

Tests run against a dedicated test database configured via `.env.test` and are fully isolated per test (`tests/conftest.py` creates and drops all tables around each test).