export type TicketStatus = "open" | "in-progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketCategory = "api-error" | "auth" | "performance" | "billing" | "other";

// Valid status transitions — enforced at the route level
export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in-progress"],
  "in-progress": ["resolved"],
  resolved: ["closed"],
  closed: [],
};

// SLA deadline in hours by priority
export const SLA_HOURS: Record<TicketPriority, number> = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 72,
};

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  created_at: string;       // ISO 8601
  updated_at: string;       // ISO 8601
  resolved_at: string | null;
  sla_deadline: string;     // ISO 8601 — derived from priority at creation
  sla_breached: boolean;    // true if resolved_at > sla_deadline, or still open past deadline
}

export interface TicketStore {
  tickets: Record<string, Ticket>;
}