import { createAnthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "@/integrations/supabase/types";
import { readState } from "@/lib/hub/store";
import { buildResumeContext } from "@/lib/hub/context";
import { UPDATE_MODEL } from "./model";
import { CHAT_HISTORY_LIMIT, CHAT_INPUT_LIMIT, CHAT_OUTPUT_TOKENS, proposeIdea, proposeIdeaInput, proposeTask, proposeTaskInput, proposeTaskUpdate, proposeTaskUpdateInput, proposeMilestone, proposeMilestoneInput, proposeMilestoneUpdate, proposeMilestoneUpdateInput, threadTitle } from "./chat-tools";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  projectId: z.string().max(100).optional(),
  message: z.object({ id: z.string().min(1).max(100), role: z.literal("user"), parts: z.array(z.object({ type: z.literal("text"), text: z.string().min(1).max(CHAT_INPUT_LIMIT) })).min(1).max(4) }),
});
const jsonError = (status: number, message: string) => Response.json({ message }, { status });

const SYSTEM = `You are the CarterHub assistant for Brandon's private project workspace. Answer using the workspace context below; say when something isn't in it and never invent progress, dates or ids.
When a new task (optionally in a roadmap milestone), a task status/title change, a new milestone, a milestone title/target-date change, or an idea would help, call the matching propose_* tool. Proposals are NOT saved: Brandon approves or dismisses each card. After proposing, say briefly what you suggested. Use exact ids from context. Be concise and use markdown.`;

export async function handleChat(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return jsonError(401, "Sign in to chat.");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const aiKey = process.env.LOVABLE_API_KEY;
  if (!url || !key || !aiKey) return jsonError(500, "Lovable AI configuration is missing.");
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => {
    const h = new Headers(init?.headers); h.set("apikey", key); return fetch(input, { ...init, headers: h });
  } } });
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return jsonError(401, "Your session ended. Sign in again.");
  const { data: owner } = await db.rpc("is_hub_owner", { _uid: auth.user.id });
  if (!owner) return jsonError(403, "Only the workspace owner can use chat.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, `Messages can be up to ${CHAT_INPUT_LIMIT.toLocaleString()} characters.`);
  const { threadId, projectId, message } = parsed.data;

  // RLS limits this to the owner's threads, so a foreign id simply isn't found.
  const { data: thread, error: threadErr } = await db.from("hub_chat_threads").select("id, owner_id, title").eq("id", threadId).maybeSingle();
  if (threadErr) return jsonError(500, "Could not open this chat.");
  if (!thread) return jsonError(404, "This chat no longer exists.");

  const { data: rows, error: histErr } = await db.from("hub_chat_messages").select("message_id, role, parts").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(CHAT_HISTORY_LIMIT - 1);
  if (histErr) return jsonError(500, "Could not load this chat's history.");
  const history: UIMessage[] = (rows ?? []).reverse().map(r => ({ id: r.message_id, role: r.role as UIMessage["role"], parts: r.parts as unknown as UIMessage["parts"] }));

  const { error: saveErr } = await db.from("hub_chat_messages").upsert({ thread_id: threadId, owner_id: thread.owner_id, message_id: message.id, role: "user", parts: message.parts as unknown as Json }, { onConflict: "thread_id,message_id" });
  if (saveErr) return jsonError(500, "Could not save your message.");
  await db.from("hub_chat_threads").update({ updated_at: new Date().toISOString(), ...(thread.title === "New chat" ? { title: threadTitle(message.parts.map(p => p.text).join(" ")) } : {}) }).eq("id", threadId);

  const state = await readState(db, thread.owner_id);
  const focusId = projectId && state.projects.some(p => p.id === projectId) ? projectId : undefined;
  const context = JSON.stringify(buildResumeContext(state, focusId));
  const messages = [...history, message as UIMessage];

  const provider = createAnthropic({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: aiKey,
    headers: { "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider(UPDATE_MODEL),
    system: `${SYSTEM}\n\nWorkspace context (JSON):\n${context}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: CHAT_OUTPUT_TOKENS,
    maxRetries: 0,
    stopWhen: stepCountIs(3),
    abortSignal: request.signal,
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    tools: {
      propose_task: tool({ description: "Suggest a new task for a project (owner must approve).", inputSchema: proposeTaskInput, execute: async i => proposeTask(state, i) }),
      propose_task_update: tool({ description: "Suggest changing an existing task's status or title (owner must approve).", inputSchema: proposeTaskUpdateInput, execute: async i => proposeTaskUpdate(state, i) }),
      propose_milestone: tool({ description: "Suggest a new roadmap milestone for a project (owner must approve).", inputSchema: proposeMilestoneInput, execute: async i => proposeMilestone(state, i) }),
      propose_milestone_update: tool({ description: "Suggest renaming a milestone or changing its target date (owner must approve).", inputSchema: proposeMilestoneUpdateInput, execute: async i => proposeMilestoneUpdate(state, i) }),
      propose_idea: tool({ description: "Suggest an idea for the Ideas inbox (owner must approve).", inputSchema: proposeIdeaInput, execute: async i => proposeIdea(state, i) }),
    },
  });
  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: false,
    onError: e => { console.error("chat stream failed", e); return "CarterHub chat couldn't finish this reply. Try again."; },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || !responseMessage.parts.length) return;
      const { error } = await db.from("hub_chat_messages").upsert({ thread_id: threadId, owner_id: thread.owner_id, message_id: responseMessage.id, role: "assistant", parts: responseMessage.parts as unknown as Json }, { onConflict: "thread_id,message_id" });
      if (error) console.error("chat reply save failed", error.message);
    },
  });
}
