import { handleCreateTicket } from "./routes/createTicket";
import { handleGetTicket, handleListTickets } from "./routes/getTicket";
import { handleUpdateStatus } from "./routes/updateStatus";

const PORT = 3001;

// Matches /tickets/:id and /tickets/:id/status
function parseTicketPath(pathname: string): { id: string; action: "status" | null } | null {
  const base = pathname.match(/^\/tickets\/([^/]+)(\/status)?$/);
  if (!base) return null;
  return {
    id: base[1],
    action: base[2] ? "status" : null,
  };
}

const server = Bun.serve({
  port: PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    // Health check
    if (pathname === "/health" && method === "GET") {
      return Response.json({ status: "ok", uptime_ms: process.uptime() * 1000 });
    }

    // POST /tickets
    if (pathname === "/tickets" && method === "POST") {
      return await handleCreateTicket(req);
    }

    // GET /tickets
    if (pathname === "/tickets" && method === "GET") {
      return await handleListTickets();
    }

    const parsed = parseTicketPath(pathname);

    if (parsed) {
      // GET /tickets/:id
      if (method === "GET" && !parsed.action) {
        return await handleGetTicket(parsed.id);
      }

      // PATCH /tickets/:id/status
      if (method === "PATCH" && parsed.action === "status") {
        return await handleUpdateStatus(parsed.id, req);
      }
    }

    // 404
    return Response.json(
      {
        error: {
          type: "NOT_FOUND",
          status: 404,
          message: `No route matched: ${method} ${pathname}`,
          available_routes: [
            "POST   /tickets",
            "GET    /tickets",
            "GET    /tickets/:id",
            "PATCH  /tickets/:id/status",
            "GET    /health",
          ],
        },
      },
      { status: 404 }
    );
  },
});

// Ensure data dir exists
await Bun.write("./data/.gitkeep", "");

console.log(`TicketFlow running on http://localhost:${server.port}`);