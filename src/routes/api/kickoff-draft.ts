import { createFileRoute } from "@tanstack/react-router";
import { handleKickoffDraft } from "@/lib/ai/kickoff.server";
export const Route = createFileRoute("/api/kickoff-draft")({ server: { handlers: { POST: ({ request }) => handleKickoffDraft(request) } } });