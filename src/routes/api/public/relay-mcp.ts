import { createFileRoute } from "@tanstack/react-router";
import { handleMcp } from "@/lib/hub/agent-api.server";

// Public by path only: every request must carry a valid per-tool Relay credential.
export const Route = createFileRoute("/api/public/relay-mcp")({
  server: { handlers: { POST: ({ request }) => handleMcp(request), GET: ({ request }) => handleMcp(request) } },
});
