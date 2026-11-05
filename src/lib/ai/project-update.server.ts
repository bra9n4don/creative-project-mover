import { UPDATE_INPUT_LIMIT } from "@/lib/hub/update-draft";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { readState, project } from "@/lib/hub/store";
import { reviewedUpdateSchema } from "@/lib/hub/update-draft";
import { createResponsesCall } from "./responses.server";
import { UPDATE_MODEL } from "./model";
import { DRAFT_PREAMBLE, compact } from "./prompts";
import { getLovableAiGatewayResponseHeaders } from "./run-id.ts";

const inputSchema = z.object({ projectId: z.string().min(1), update: z.string().trim().min(1).max(UPDATE_INPUT_LIMIT) });
const jsonError = (status: number, message: string) => Response.json({ message }, { status });

export async function handleProjectUpdate(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return jsonError(401, "Sign in to draft a project update.");
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
  if (ownerError || !owner) return jsonError(403, "Only the workspace owner can generate project updates.");
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Choose a project and paste an update of up to 8,000 characters.");
  try {
    const { data: ownerId } = await db.rpc("hub_owner_uid");
    const state = await readState(db, (ownerId as string | null) ?? auth.user.id);
    const p = project(state, parsed.data.projectId);
    const projectTasks = state.tasks.filter(t => t.projectId === p.id);
    const done = (s: string) => s === "done" || s === "verified";
    const recent = [...projectTasks].sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
    const openTasks = recent.filter(t => !done(t.status)).slice(0, 40).map(t => ({ title: t.title, status: t.status }));
    const finishedTasks = recent.filter(t => done(t.status)).slice(0, 30).map(t => t.title);
    const call = createResponsesCall(request, { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey: aiKey, model: UPDATE_MODEL, reasoningEffort: "low", maxOutputTokens: 1500 }, [{ role: "user", content: JSON.stringify(compact({ project: { title: p.title, goal: p.goal }, openTasks, finishedTasks, update: parsed.data.update })) }],
      "Turn the owner's project update into actionable future tasks and a factual handoff. " + DRAFT_PREAMBLE + " Avoid duplicating existing tasks or creating tasks for work already completed. Never claim verification. Return 0-10 concrete tasks, each title <=200 characters and description <=600, priority low/medium/high. Return one handoff: title <=200, summary <=2000 describing progress/blockers/unknowns, nextAction <=400 with a concrete next step, target <=100 (Next session if unspecified).");
    // Start consuming immediately; wait only for upstream headers, not the answer.
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
        const validated = reviewedUpdateSchema.safeParse({ ...draft, projectId: p.id, reviewed: true });
        if (!validated.success) throw new Error("The AI draft was incomplete or too long. Your update has been kept.");
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
    return jsonError(500, error instanceof Error ? error.message : "Could not draft this update.");
  }
}