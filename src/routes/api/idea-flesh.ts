import { createFileRoute } from "@tanstack/react-router";
import { handleIdeaFlesh } from "@/lib/ai/idea-flesh.server";

export const Route = createFileRoute("/api/idea-flesh")({
  server: { handlers: { POST: ({ request }) => handleIdeaFlesh(request) } },
});
