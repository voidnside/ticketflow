# TicketFlow

REST API simulating a support ticket lifecycle — built with Bun + TypeScript.

TicketFlow models what happens to a support ticket from the moment it's created to the moment it's closed: status transitions, priority queues, SLA deadlines, and structured validation at every step. Tickets are persisted to a local JSON file.

---

## Why this exists

A support system is only as useful as its structure. Without defined status transitions, tickets get stuck in ambiguous states. Without SLA fields, there's no way to know which tickets are on fire. Without input validation, garbage gets into the queue and silently corrupts later queries.

This project models those constraints as code — not because this is production software, but because understanding the rules of a support system is a prerequisite to working in one.

---

## Ticket lifecycle

```
  [POST /tickets]
        │
        ▼
      open  ──────────────────────────────────────────┐
        │                                              │
        │  PATCH /tickets/:id/status                   │  SLA deadline
        │  { "status": "in-progress" }                 │  computed at
        ▼                                              │  creation from
   in-progress                                        │  priority
        │
        │  PATCH /tickets/:id/status
        │  { "status": "resolved" }
        ▼
    resolved  ◄── resolved_at recorded here
        │          sla_breached evaluated here
        │
        │  PATCH /tickets/:id/status
        │  { "status": "closed" }
        ▼
     closed  ◄── terminal state, no further transitions
```

Invalid transitions return `409 Conflict` with the current status and allowed next states.

---

## SLA deadlines

SLA deadline is computed at ticket creation based on priority:

| Priority   | SLA window |
| ---------- | ---------- |
| `critical` | 4 hours    |
| `high`     | 8 hours    |
| `medium`   | 24 hours   |
| `low`      | 72 hours   |

`sla_breached` is evaluated when a ticket is resolved (was it resolved in time?) and recomputed on every read for open tickets (has the deadline passed while it was sitting in the queue?).

---

## Setup

```bash
# Requires Bun — https://bun.sh
bun install
bun run dev     # development with file watching
bun run start   # production
```

Server starts on `http://localhost:3001`. Tickets are stored in `./data/tickets.json` (created automatically, excluded from git).

---

## API reference

### `POST /tickets`

Create a new ticket.

**Request body:**

```json
{
  "title": "POST /v1/orders returns 500 for requests with discount_code",
  "description": "Reproducible. Affects all users on Pro plan. Started after deploy at 14:22 UTC.",
  "priority": "high",
  "category": "api-error"
}
```

| Field         | Type   | Required | Values                                             |
| ------------- | ------ | -------- | -------------------------------------------------- |
| `title`       | string | yes      | non-empty                                          |
| `description` | string | yes      | non-empty                                          |
| `priority`    | string | yes      | `low` `medium` `high` `critical`                   |
| `category`    | string | yes      | `api-error` `auth` `performance` `billing` `other` |

**Response — 201 Created:**

```json
{
  "ticket": {
    "id": "TKT-1710510123456",
    "title": "POST /v1/orders returns 500 for requests with discount_code",
    "description": "Reproducible. Affects all users on Pro plan. Started after deploy at 14:22 UTC.",
    "status": "open",
    "priority": "high",
    "category": "api-error",
    "created_at": "2025-03-15T14:22:03.441Z",
    "updated_at": "2025-03-15T14:22:03.441Z",
    "resolved_at": null,
    "sla_deadline": "2025-03-15T22:22:03.441Z",
    "sla_breached": false
  }
}
```

---

### `GET /tickets/:id`

Fetch a single ticket by ID.

**Response — 200 OK:**

```json
{
  "ticket": {
    "id": "TKT-1710510123456",
    "status": "open",
    "priority": "high",
    "sla_deadline": "2025-03-15T22:22:03.441Z",
    "sla_breached": false,
    ...
  }
}
```

**Response — 404 Not Found:**

```json
{
  "error": {
    "type": "NOT_FOUND",
    "status": 404,
    "message": "No ticket found with id 'TKT-9999'."
  }
}
```

---

### `GET /tickets`

List all tickets.

**Response — 200 OK:**

```json
{
  "tickets": [...],
  "total": 3
}
```

---

### `PATCH /tickets/:id/status`

Advance a ticket to the next status. Only valid transitions are accepted.

**Request body:**

```json
{ "status": "in-progress" }
```

**Response — 200 OK:**

```json
{
  "ticket": {
    "id": "TKT-1710510123456",
    "status": "in-progress",
    "updated_at": "2025-03-15T14:35:00.000Z",
    ...
  }
}
```

**Response — 409 Conflict (invalid transition):**

```json
{
  "error": {
    "type": "INVALID_TRANSITION",
    "status": 409,
    "message": "Cannot transition from 'open' to 'resolved'.",
    "current_status": "open",
    "allowed_transitions": ["in-progress"]
  }
}
```

---

## End-to-end example

```bash
# 1. Create a ticket
curl -s -X POST http://localhost:3001/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Auth tokens expiring early","description":"Users report 401s 30 min before expected expiry. Reproducible in prod.","priority":"critical","category":"auth"}' | jq .

# 2. Move to in-progress
curl -s -X PATCH http://localhost:3001/tickets/TKT-1710510123456/status \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress"}' | jq .

# 3. Resolve
curl -s -X PATCH http://localhost:3001/tickets/TKT-1710510123456/status \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}' | jq .

# 4. Check SLA outcome
curl -s http://localhost:3001/tickets/TKT-1710510123456 | jq '{status, sla_deadline, resolved_at, sla_breached}'

# 5. Try an invalid transition — should get 409
curl -s -X PATCH http://localhost:3001/tickets/TKT-1710510123456/status \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress"}' | jq .error
```

---

## What this demonstrates

**Lifecycle modeling:** Support tickets are not a flat list. They move through states with rules. Enforcing those rules in code reflects how a real support system should behave — and prevents tickets from jumping to resolved without investigation.

**SLA awareness:** Every ticket has a deadline derived from its priority. `sla_breached` is not a field you set manually — it's evaluated against real timestamps. This is how prioritization actually works in production support systems.

**Input validation:** Missing fields, wrong types, and invalid enum values all return structured 422 responses with specific messages. The client should never have to guess why a request was rejected.

**Structured error responses:** Every error — 400, 404, 409, 422 — follows the same shape. Predictable error formats are the difference between a debuggable API and a frustrating one.

---

## Stack

- [Bun](https://bun.sh) — runtime and server
- TypeScript — strict mode
- Zero external dependencies
- JSON file persistence (`./data/tickets.json`)
