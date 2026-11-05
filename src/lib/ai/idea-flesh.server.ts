import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { readState } from "@/lib/hub/store";
import { IDEA_INPUT_LIMIT, ideaDraftSchema, reviewedIdeaDraftSchema } from "@/lib/hub/idea-draft";
import { createResponsesCall } from "./responses.server";
import { UPDATE_MODEL } from "./model";
import { DRAFT_PREAMBLE, compact } from "./prompts";
import { getLovableAiGatewayResponseHeaders } from "./run-id.ts";

const inputSchema = z.object({ ideaId: z.string().min(1), notes: z.string().trim().max(IDEA_INPUT_LIMIT).optional() });
const jsonError = (status: number, message: string) => Response.json({ message }, { status });

export async function handleIdeaFlesh(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return jsonError(401, "Sign in to flesh out an idea.");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const aiKey = process.env.LOVABLE_API_KEY;
  if (!url || !key || !aiKey) return jsonError(500, "Lovable AI configuration is missing.");
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => {
    const h = new Headers(init?.headers); h.set("apikey", key); return fetch(input, { ...init, headers: h });
  } } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return jsonError(401, "Your session ended. Sign in again.");
  const { data: owner, error: ownerError } = await db.rpc("is_hub_owner", { _uid: auth.user.id });
  if (ownerError || !owner) return jsonError(403, "Only the workspace owner can flesh out ideas.");
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Choose an idea; extra notes are optional up to 4,000 characters.");
  try {
    const { data: ownerId } = await db.rpc("hub_owner_uid");
    const state = await readState(db, (ownerId as string | null) ?? auth.user.id);
    const idea = state.ideas.find(i => i.id === parsed.data.ideaId);
    if (!idea) return jsonError(404, "That idea no longer exists.");
    const call = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: aiKey, model: UPDATE_MODEL, reasoningEffort: "low", maxOutputTokens: 1500 }, [{ role: "user", content: JSON.stringify(compact({ idea: { title: idea.title, description: idea.description, tags: idea.tags }, extraNotes: parsed.data.notes })) }],
      "Flesh out the owner's rough idea into a clearer concept. " + DRAFT_PREAMBLE + " Return one summary <=2000 characters describing what the idea is and why it matters, 0-6 concrete first tasks (each title <=200, description <=600), 0-5 risks (each <=300), and 0-5 open questions the owner should answer (each <=300). Stay grounded in the idea text; do not invent commitments or facts.", ideaDraftSchema);
    const outputPromise = Promise.resolve(call.result.output);
    void outputPromise.catch(() => {});
    await call.runIdFetch.waitForRunId();
    const failure = call.getFailure();
    if (failure) return jsonError(failure.status, failure.message);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({ async start(controller) {
      const send = (v: unknown) => controller.enqueue(encoder.encode(JSON.stringify(v) + "\n"));
      try {
        let lastProgress = 0;
        for await (const part of call.result.fullStream) {
          if ((part.type === "reasoning-delta" || part.type === "text-delta") && Date.now() - lastProgress > 1000) { lastProgress = Date.now(); send({ type: "progress" }); }
          if (part.type === "error") throw part.error;
        }
        const draft = await outputPromise;
        const validated = reviewedIdeaDraftSchema.safeParse(draft);
        if (!validated.success) throw new Error("The AI draft was incomplete or too long. Your idea has been kept.");
        send({ type: "draft", draft });
      } catch (error) {
        if (request.signal.aborted) send({ type: "stopped" });
        else send({ type: "error", message: call.getFailure()?.message ?? (error instanceof Error ? error.message : "Lovable AI could not finish this draft.") });
      } finally { controller.close(); }
    } });
    const headers = getLovableAiGatewayResponseHeaders(undefined, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
    const runId = call.runIdFetch.getRunId();
    if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    return new Response(stream, { headers });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return jsonError(500, error instanceof Error ? error.message : "Could not flesh out this idea.");
  }
}
