import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { briefSchema, planSchema, kickoffSchema } from "@/lib/kickoff";
import { createResponsesCall, DRAFT_MODEL } from "./responses.server";
import { DRAFT_PREAMBLE, compact } from "./prompts";
import { getLovableAiGatewayResponseHeaders } from "./run-id.ts";

const requestSchema = z.object({ mode: z.enum(["brief", "plan"]), kickoff: kickoffSchema });
export async function handleKickoffDraft(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return Response.json({ message: "Sign in to draft your Kickoff." }, { status: 401 });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY, aiKey = process.env.LOVABLE_API_KEY;
  if (!url || !key || !aiKey) return Response.json({ message: "Lovable AI configuration is missing." }, { status: 500 });
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth.user) return Response.json({ message: "Your session ended. Sign in again." }, { status: 401 });
  const { data: owner } = await db.rpc("is_hub_owner", { _uid: auth.user.id });
  if (!owner) return Response.json({ message: "Only the workspace owner can draft a Kickoff." }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Check the Kickoff answers before drafting." }, { status: 400 });
  const { mode, kickoff } = parsed.data;
  if (!kickoff.brainstorm.trim()) return Response.json({ message: "Add your ideas first." }, { status: 400 });
  const prompt = "You draft project kickoffs for the owner. " + DRAFT_PREAMBLE + " Preserve the owner's choices. Treat 'not sure yet' as an unknown. " + (mode === "brief"
    ? "Draft title (max 150 characters), goal, audience, scope, outOfScope, success, constraints, unknowns. Each other field max 800 characters. Distinguish known information from assumptions."
    : "Draft 2-5 milestones, each with a title (max 200 characters), measurable outcome (max 400 characters), and 1-5 concrete starter tasks. Each task has title (max 200), description (max 600), priority low/medium/high. Fit the scope, budget, timeline and available time. Do not claim tasks are done. Do not invent deadlines.");
  try {
    const schema: z.ZodTypeAny = mode === "brief" ? briefSchema : planSchema;
    const call = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: aiKey, model: DRAFT_MODEL, reasoningEffort: mode === "brief" ? "low" : "medium", maxOutputTokens: mode === "brief" ? 6000 : 10000 }, [{ role: "user", content: JSON.stringify(compact({ brainstorm: kickoff.brainstorm, answers: kickoff.clarify, brief: mode === "plan" ? kickoff.brief : undefined })) }], prompt, schema);
    const output = Promise.resolve(call.result.output); void output.catch(() => {});
    await call.runIdFetch.waitForRunId();
    const failure = call.getFailure();
    if (failure) return Response.json({ message: failure.message }, { status: failure.status });
    const encoder = new TextEncoder();
    const body = new ReadableStream({ async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      let lastProgress = 0;
      try {
        for await (const part of call.result.fullStream) {
          // Heartbeat at most once a second instead of once per token.
          if ((part.type === "text-delta" || part.type === "reasoning-delta") && Date.now() - lastProgress > 1000) { lastProgress = Date.now(); send({ type: "progress" }); }
          if (part.type === "error") throw part.error;
        }
        const draft = await output;
        const next = kickoffSchema.safeParse({ ...kickoff, [mode]: draft });
        if (!next.success) throw new Error("The AI draft was incomplete or too long. Your answers have been kept.");
        send({ type: "draft", draft });
      } catch (e) {
        send(request.signal.aborted ? { type: "stopped" } : { type: "error", message: call.getFailure()?.message ?? (e instanceof Error ? e.message : "Lovable AI could not finish this draft.") });
      } finally { controller.close(); }
    } });
    const headers = getLovableAiGatewayResponseHeaders(undefined, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
    const runId = call.runIdFetch.getRunId(); if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
    return new Response(body, { headers });
  } catch (e) {
    return Response.json({ message: request.signal.aborted ? "Drafting stopped." : e instanceof Error ? e.message : "Could not draft the Kickoff." }, { status: request.signal.aborted ? 499 : 500 });
  }
}