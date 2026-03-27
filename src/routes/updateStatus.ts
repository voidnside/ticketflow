import { getTicketById, saveTicket } from "../storage";
import { ALLOWED_TRANSITIONS, type TicketStatus } from "../types";

const VALID_STATUSES = new Set<TicketStatus>(["open", "in-progress", "resolved", "closed"]);

export async function handleUpdateStatus(id: string, req: Request): Promise<Response> {
  const ticket = await getTicketById(id);

  if (!ticket) {
    return Response.json(
      { error: { type: "NOT_FOUND", status: 404, message: `No ticket found with id '${id}'.` } },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { type: "INVALID_BODY", status: 400, message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  const { status } = (body ?? {}) as Record<string, unknown>;

  if (!VALID_STATUSES.has(status as TicketStatus)) {
    return Response.json(
      {
        error: {
          type: "VALIDATION_ERROR",
          status: 422,
          message: `'status' must be one of: ${[...VALID_STATUSES].join(", ")}.`,
        },
      },
      { status: 422 }
    );
  }

  const newStatus = status as TicketStatus;
  const allowed = ALLOWED_TRANSITIONS[ticket.status];

  if (!allowed.includes(newStatus)) {
    return Response.json(
      {
        error: {
          type: "INVALID_TRANSITION",
          status: 409,
          message: `Cannot transition from '${ticket.status}' to '${newStatus}'.`,
          current_status: ticket.status,
          allowed_transitions: allowed.length > 0 ? allowed : ["none — ticket is closed"],
        },
      },
      { status: 409 }
    );
  }

  const now = new Date();
  ticket.status = newStatus;
  ticket.updated_at = now.toISOString();

  if (newStatus === "resolved") {
    ticket.resolved_at = now.toISOString();
    ticket.sla_breached = now.getTime() > new Date(ticket.sla_deadline).getTime();
  }

  await saveTicket(ticket);

  return Response.json({ ticket });
}