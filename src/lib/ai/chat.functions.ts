import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;
const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);
const fail = (msg: string, e?: { message: string } | null): never => { if (e) console.error(msg, e.message); throw new Error(msg); };

async function ownerId(db: Db) {
  const { data, error } = await db.rpc("hub_owner_uid");
  if (error || !data) fail("Only the workspace owner can use chat.", error);
  return data as string;
}

export type ChatThread = { id: string; title: string; updatedAt: string };

export const listChatThreadsFn = authed.handler(async ({ context }) => {
  const db = context.supabase as Db;
  const { data, error } = await db.from("hub_chat_threads").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(100);
  if (error) fail("Could not load chats.", error);
  return (data ?? []).map(t => ({ id: t.id, title: t.title, updatedAt: t.updated_at })) as ChatThread[];
});

export const createChatThreadFn = authed.handler(async ({ context }) => {
  const db = context.supabase as Db;
  const { data, error } = await db.from("hub_chat_threads").insert({ owner_id: await ownerId(db) }).select("id, title, updated_at").single();
  if (error || !data) fail("Could not start a chat.", error);
  return { id: data!.id, title: data!.title, updatedAt: data!.updated_at } as ChatThread;
});

export const renameChatThreadFn = authed.inputValidator(z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(80) })).handler(async ({ context, data }) => {
  const { error } = await (context.supabase as Db).from("hub_chat_threads").update({ title: data.title }).eq("id", data.id);
  if (error) fail("Could not rename this chat.", error);
  return { ok: true };
});

export const deleteChatThreadFn = authed.inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ context, data }) => {
  const { error } = await (context.supabase as Db).from("hub_chat_threads").delete().eq("id", data.id);
  if (error) fail("Could not delete this chat.", error);
  return { ok: true };
});

export const getChatMessagesFn = authed.inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ context, data }) => {
  const db = context.supabase as Db;
  const { data: thread, error: tErr } = await db.from("hub_chat_threads").select("id, title").eq("id", data.id).maybeSingle();
  if (tErr) fail("Could not open this chat.", tErr);
  if (!thread) return null;
  const { data: rows, error } = await db.from("hub_chat_messages").select("message_id, role, parts").eq("thread_id", data.id).order("created_at");
  if (error) fail("Could not load messages.", error);
  return { id: thread.id, title: thread.title, messages: (rows ?? []).map(r => ({ id: r.message_id, role: r.role, parts: r.parts })) };
});

/** Records Approve/Dismiss on a proposal card so it stays decided after reload. */
export const decideProposalFn = authed.inputValidator(z.object({ threadId: z.string().uuid(), messageId: z.string().min(1), toolCallId: z.string().min(1), decision: z.enum(["approved", "dismissed"]) })).handler(async ({ context, data }) => {
  const db = context.supabase as Db;
  const { data: row, error } = await db.from("hub_chat_messages").select("id, parts").eq("thread_id", data.threadId).eq("message_id", data.messageId).maybeSingle();
  if (error) fail("Could not update this suggestion.", error);
  if (!row) return { ok: false };
  const parts = (row.parts as Array<Record<string, unknown>>).map(p => p.toolCallId === data.toolCallId ? { ...p, decision: data.decision } : p);
  const { error: uErr } = await db.from("hub_chat_messages").update({ parts: parts as unknown as Json }).eq("id", row.id);
  if (uErr) fail("Could not update this suggestion.", uErr);
  return { ok: true };
});
