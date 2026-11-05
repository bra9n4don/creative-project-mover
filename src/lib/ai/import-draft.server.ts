import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { HubDb } from "@/lib/hub/store";
import { HubError } from "@/lib/hub/store";
import { createImportDraft } from "@/lib/hub/operations";
import { aiImportSchema, capChat, importSources, sourceLabels, IMPORT_TEXT_LIMIT, IMPORT_MAX_TASKS, IMPORT_MAX_IDEAS } from "@/lib/hub/imports";
import { createResponsesCall } from "./responses.server";
import { UPDATE_MODEL } from "./model";
import { DRAFT_PREAMBLE } from "./prompts";

const inputSchema = z.object({ source: z.enum(importSources), title: z.string().max(200).default(""), text: z.string().trim().min(20).max(IMPORT_TEXT_LIMIT * 4) });
const jsonError = (status: number, message: string) => Response.json({ message }, { status });
const clip = (s: string, n: number) => s.trim().slice(0, n);

/** Owner-only: turns a pasted/uploaded chat into a pending import draft. Never writes live project data. */
export async function handleImportDraft(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return jsonError(401, "Sign in to import a chat.");
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY, aiKey = process.env.LOVABLE_API_KEY;
  if (!url || !key || !aiKey) return jsonError(500, "Lovable AI configuration is missing.");
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => {
    const h = new Headers(init?.headers); h.set("apikey", key); return fetch(input, { ...init, headers: h });
  } } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return jsonError(401, "Your session ended. Sign in again.");
  const { data: owner } = await db.rpc("is_hub_owner", { _uid: auth.user.id });
  if (!owner) return jsonError(403, "Only the workspace owner can import chats.");
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Paste a conversation of at least a few sentences.");
  const { text, trimmed } = capChat(parsed.data.text);
  try {
    const call = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: aiKey, model: UPDATE_MODEL, reasoningEffort: "low", maxOutputTokens: 2000 },
      [{ role: "user", content: JSON.stringify({ source: sourceLabels[parsed.data.source], chatTitle: parsed.data.title || undefined, conversation: text }) }],
      "Turn this conversation from another AI chatbot into a CarterHub project the owner started there. " + DRAFT_PREAMBLE +
      ` Use only facts from the conversation. project: title <=120, goal <=300, description <=1500 summarizing what was decided. tasks: 0-${Math.min(15, IMPORT_MAX_TASKS)} concrete remaining next steps (not work already done), title <=200, description <=400, priority low/medium/high. ideas: 0-${Math.min(8, IMPORT_MAX_IDEAS)} side ideas not yet committed to, title <=150, description <=300. handoff: title <=200, summary <=1500 of progress/open questions, nextAction <=300, target "Next session".`,
      aiImportSchema);
    const out = await call.result.output.catch(() => null);
    const failure = call.getFailure();
    if (failure) return jsonError(failure.status, failure.message);
    if (!out) return jsonError(502, "The AI couldn't read this chat. Try a shorter or cleaner paste.");
    const { data: ownerId } = await db.rpc("hub_owner_uid");
    const content = {
      project: { title: clip(out.project.title || parsed.data.title || "Imported project", 200), goal: clip(out.project.goal, 2000), description: clip(out.project.description, 20000) },
      tasks: out.tasks.filter(t => t.title.trim()).slice(0, IMPORT_MAX_TASKS).map(t => ({ title: clip(t.title, 200), description: clip(t.description, 4000), priority: t.priority })),
      ideas: out.ideas.filter(i => i.title.trim()).slice(0, IMPORT_MAX_IDEAS).map(i => ({ title: clip(i.title, 150), description: clip(i.description, 2000) })),
      handoff: out.handoff.title.trim() && out.handoff.summary.trim() && out.handoff.nextAction.trim()
        ? { title: clip(out.handoff.title, 200), summary: clip(out.handoff.summary, 15000), nextAction: clip(out.handoff.nextAction, 2000), target: clip(out.handoff.target || "Next session", 100) } : null,
    };
    const r = await createImportDraft({ ownerId: (ownerId as string | null) ?? auth.user.id, agent: false, source: "You", db: db as unknown as HubDb },
      { source: parsed.data.source, sourceDetail: parsed.data.title, content, trimmed });
    return Response.json({ draftId: r.draftId, trimmed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    if (error instanceof HubError) return jsonError(error.status, error.message);
    console.error("Import draft failed", error);
    return jsonError(500, "Could not draft this import.");
  }
}
