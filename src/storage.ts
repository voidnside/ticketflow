import type { Ticket, TicketStore } from "./types";

const DB_PATH = "./data/tickets.json";

async function ensureFile(): Promise<void> {
  const file = Bun.file(DB_PATH);
  const exists = await file.exists();
  if (!exists) {
    await Bun.write(DB_PATH, JSON.stringify({ tickets: {} }, null, 2));
  }
}

export async function readStore(): Promise<TicketStore> {
  await ensureFile();
  const file = Bun.file(DB_PATH);
  return await file.json() as TicketStore;
}

export async function writeStore(store: TicketStore): Promise<void> {
  await Bun.write(DB_PATH, JSON.stringify(store, null, 2));
}

export async function getAllTickets(): Promise<Ticket[]> {
  const store = await readStore();
  return Object.values(store.tickets);
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  const store = await readStore();
  return store.tickets[id] ?? null;
}

export async function saveTicket(ticket: Ticket): Promise<void> {
  const store = await readStore();
  store.tickets[ticket.id] = ticket;
  await writeStore(store);
}