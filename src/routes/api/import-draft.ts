import { createFileRoute } from "@tanstack/react-router";
import { handleImportDraft } from "@/lib/ai/import-draft.server";

export const Route = createFileRoute("/api/import-draft")({
  server: { handlers: { POST: ({ request }) => handleImportDraft(request) } },
});
