import { createFileRoute } from "@tanstack/react-router";
import { relaySkill } from "@/lib/hub/guide";

export const Route = createFileRoute("/api/public/hub/skill")({
  server: { handlers: { GET: () => new Response(relaySkill, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": 'attachment; filename="SKILL.md"' } }) } },
});
