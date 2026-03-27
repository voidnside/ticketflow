import { getAllTickets, getTicketById, saveTicket } from "../storage";
import type { Ticket } from "../types";

function computeSlaBreached(ticket: Ticket): boolean {
  const deadline = new Date(ticket.sla_deadline).getTime();
  if (ticket.resolved_at) {
    return new Date(ticket.resolved_at).getTime() > deadline;
  }
  return Date.now() > deadline;
}

export async function handleGetTicket(id: string): Promise<Response> {
  const ticket = await getTicketById(id);

  if (!ticket) {
    return Response.json(
      { error: { type: "NOT_FOUND", status: 404, message: `No ticket found with id '${id}'.` } },
      { status: 404 }
    );
  }

  // Recompute sla_breached on read — catches tickets that breached while the server was idle
  const slaBreached = computeSlaBreached(ticket);
  if (slaBreached !== ticket.sla_breached) {
    ticket.sla_breached = slaBreached;
    await saveTicket(ticket);
  }

  return Response.json({ ticket });
}

export async function handleListTickets(): Promise<Response> {
  const tickets = await getAllTickets();

  // Recompute SLA breach status for all open tickets
  const updated: Ticket[] = [];
  for (const ticket of tickets) {
    const breached = computeSlaBreached(ticket);
    if (breached !== ticket.sla_breached) {
      ticket.sla_breached = breached;
      updated.push(ticket);
    }
  }
  for (const ticket of updated) await saveTicket(ticket);

  return Response.json({ tickets, total: tickets.length });
}