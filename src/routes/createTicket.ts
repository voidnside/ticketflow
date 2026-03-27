import { saveTicket } from "../storage";
import { SLA_HOURS, type Ticket, type TicketCategory, type TicketPriority } from "../types";

const VALID_PRIORITIES = new Set<TicketPriority>(["low", "medium", "high", "critical"]);
const VALID_CATEGORIES = new Set<TicketCategory>(["api-error", "auth", "performance", "billing", "other"]);

export async function handleCreateTicket(req: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: { type: "INVALID_BODY", status: 400, message: "Request body must be valid JSON." } },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return Response.json(
      { error: { type: "INVALID_BODY", status: 400, message: "Request body must be a JSON object." } },
      { status: 400 }
    );
  }

  const { title, description, priority, category } = body as Record<string, unknown>;

  // Validate required fields
  const errors: string[] = [];
  if (typeof title !== "string" || title.trim() === "") errors.push("'title' is required and must be a non-empty string.");
  if (typeof description !== "string" || description.trim() === "") errors.push("'description' is required and must be a non-empty string.");
  if (!VALID_PRIORITIES.has(priority as TicketPriority)) errors.push(`'priority' must be one of: ${[...VALID_PRIORITIES].join(", ")}.`);
  if (!VALID_CATEGORIES.has(category as TicketCategory)) errors.push(`'category' must be one of: ${[...VALID_CATEGORIES].join(", ")}.`);

  if (errors.length > 0) {
    return Response.json(
      { error: { type: "VALIDATION_ERROR", status: 422, message: "Request failed validation.", details: errors } },
      { status: 422 }
    );
  }

  const now = new Date();
  const slaHours = SLA_HOURS[priority as TicketPriority];
  const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

  const ticket: Ticket = {
    id: `TKT-${Date.now()}`,
    title: (title as string).trim(),
    description: (description as string).trim(),
    status: "open",
    priority: priority as TicketPriority,
    category: category as TicketCategory,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    resolved_at: null,
    sla_deadline: slaDeadline.toISOString(),
    sla_breached: false,
  };

  await saveTicket(ticket);

  return Response.json({ ticket }, { status: 201 });
}