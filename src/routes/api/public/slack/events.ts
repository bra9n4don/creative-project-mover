import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { isOwnerSlackEvent } from "@/lib/slack/owner";

const eventSchema = z.object({
  type: z.string(),
  challenge: z.string().optional(),
  team_id: z.string().optional(),
  event_id: z.string().optional(),
  event: z.object({ type: z.string(), text: z.string().max(4000).optional(), channel: z.string().optional(), user: z.string().optional(), bot_id: z.string().optional(), subtype: z.string().optional(), thread_ts: z.string().optional(), ts: z.string().optional() }).optional(),
});

async function validSignature(secret: string, request: Request, body: string) {
  const ts = request.headers.get("x-slack-request-timestamp") ?? "";
  const sig = request.headers.get("x-slack-signature") ?? "";
  if (!ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${ts}:${body}`));
  const expected = "v0=" + [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

// Slack bot: replies are fast (no AI), so it replies before acknowledging, well within Slack's 3s limit.
export const Route = createFileRoute("/api/public/slack/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        let parsed: z.infer<typeof eventSchema>;
        try { parsed = eventSchema.parse(JSON.parse(body)); } catch { return new Response("bad request", { status: 400 }); }
        if (parsed.type === "url_verification") return Response.json({ challenge: parsed.challenge });
        const secret = process.env.SLACK_SIGNING_SECRET;
        if (!secret) return new Response("ok");
        if (!(await validSignature(secret, request, body))) return new Response("invalid signature", { status: 401 });

        const ev = parsed.event;
        if (!ev || ev.bot_id || ev.subtype || !ev.channel || !["app_mention", "message"].includes(ev.type)) return new Response("ok");
        // Only Brandon's own Slack account may read or write the workspace.
        if (!isOwnerSlackEvent(parsed.team_id, ev.user)) return new Response("ok");
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: owner } = await supabaseAdmin.from("hub_owner").select("user_id").eq("id", "personal").maybeSingle();
          const { handleMessage } = await import("@/lib/slack/bot");
          let reply = "Relay isn't set up yet — claim your workspace first.";
          if (owner?.user_id) {
            const actor = { ownerId: owner.user_id, source: "Slack", agent: true, db: supabaseAdmin };
            const { getState } = await import("@/lib/hub/context");
            const action = handleMessage(ev.text ?? "", await getState(actor));
            if (action.idea) {
              const { addIdea } = await import("@/lib/hub/operations");
              // Slack retries reuse event_id; skip the save if this event already created an idea.
              const tag = parsed.event_id ? `slack:${parsed.event_id}` : null;
              const already = tag && (await getState(actor)).ideas.some(i => i.tags.includes(tag));
              if (!already) await addIdea(actor, { title: action.idea.title, description: action.idea.description, tags: tag ? ["slack", tag] : ["slack"] });
            }
            reply = action.reply;
          }
          const res = await fetch(`${process.env.CONNECTOR_GATEWAY_BASE_URL ?? "https://connector-gateway.lovable.dev"}/slack/api/chat.postMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "X-Connection-Api-Key": process.env.SLACK_API_KEY ?? "" },
            body: JSON.stringify({ channel: ev.channel, text: reply, thread_ts: ev.thread_ts ?? (ev.type === "app_mention" ? ev.ts : undefined) }),
          });
          const out = await res.text();
          if (!res.ok || !JSON.parse(out).ok) throw new Error(`Slack reply failed [${res.status}]: ${out}`);
        } catch (e) {
          console.error("Slack handler error", e);
          // Safe to retry: ideas are de-duplicated by Slack's event_id.
          return new Response("retry", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
