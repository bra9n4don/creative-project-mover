import { createFileRoute } from "@tanstack/react-router";
import { demoState } from "@/lib/hub/demo";

// Synthetic, read-only sample data. Real workspace data is never public.
export const Route = createFileRoute("/api/public/hub/demo")({
  server: { handlers: { GET: () => new Response(JSON.stringify(demoState()), { headers: { "content-type": "application/json", "cache-control": "no-store" } }) } },
});
