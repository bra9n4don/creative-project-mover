import { createFileRoute } from "@tanstack/react-router";
import { handleRest } from "@/lib/hub/agent-api.server";

// Agent REST fallback. Every request is verified against a per-tool Relay credential.
export const Route = createFileRoute("/api/public/hub/$")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleRest(request, params._splat ?? ""),
      POST: ({ request, params }) => handleRest(request, params._splat ?? ""),
      PATCH: ({ request, params }) => handleRest(request, params._splat ?? ""),
      DELETE: ({ request, params }) => handleRest(request, params._splat ?? ""),
    },
  },
});
