import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Automatic read-only GitHub sync, called by the managed schedule every hour.
export const Route = createFileRoute("/api/public/jobs/github-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: owner, error } = await supabaseAdmin.from("hub_owner").select("user_id, github_sync_enabled").eq("id", "personal").maybeSingle();
        if (error) return Response.json({ ok: false, error: "Could not read sync settings." }, { status: 500 });
        if (!owner?.github_sync_enabled) return Response.json({ skipped: "Automatic sync starts after the first manual sync." });
        const { syncAndRecord } = await import("@/lib/hub/github.server");
        try {
          const r = await syncAndRecord({ ownerId: owner.user_id, source: "GitHub sync", agent: false, db: supabaseAdmin }, "automatic");
          return Response.json(r);
        } catch (e) {
          // A failed sync must look failed to the scheduler, not like a success.
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "Sync failed" }, { status: 502 });
        }
      },
    },
  },
});
