import { createFileRoute } from "@tanstack/react-router";
import { apiDocs } from "@/lib/hub/guide";

export const Route = createFileRoute("/api/public/hub/docs")({
  server: { handlers: { GET: () => Response.json(apiDocs) } },
});
