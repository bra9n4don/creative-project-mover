import { createFileRoute } from "@tanstack/react-router";
import { handleProjectUpdate } from "@/lib/ai/project-update.server";

export const Route = createFileRoute("/api/project-update")({
  server: { handlers: { POST: ({ request }) => handleProjectUpdate(request) } },
});