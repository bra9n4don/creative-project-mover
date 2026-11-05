import type { Proposal } from "@/lib/ai/chat-tools";

export type InboxStatus = "waiting" | "approved" | "dismissed";
export type CreatedRef = { kind: "task" | "idea" | "milestone" | "task_update" | "milestone_update"; id: string };
export type InboxItem = { threadId: string; threadTitle: string; messageId: string; toolCallId: string; createdAt: string; status: InboxStatus; part: { type: string; toolCallId: string; state: string; output?: Proposal; decision?: "approved" | "dismissed"; created?: CreatedRef } };
export const APPROVING_LOCK_MS = 2 * 60_000;
type Part = Record<string, unknown>;

/** Applies an Approve/Dismiss/approving-lock decision to a stored tool part. Approved parts are never overwritten; a fresh "approving" lock blocks a second approver. */
export function applyDecision(part: Part, decision: "approving" | "approved" | "dismissed", created: CreatedRef | undefined, now = Date.now()): { part: Part; result: { ok: boolean; alreadyApproved?: boolean; locked?: boolean; created?: CreatedRef } } {
  if (part.decision === "approved") return { part, result: { ok: true, alreadyApproved: true, created: part.created as CreatedRef | undefined } };
  if (decision === "approving") {
    const at = typeof part.approvingAt === "number" ? part.approvingAt : 0;
    if (at && now - at < APPROVING_LOCK_MS) return { part, result: { ok: false, locked: true } };
    return { part: { ...part, approvingAt: now }, result: { ok: true } };
  }
  const { approvingAt: _a, ...rest } = part;
  return { part: { ...rest, decision, ...(decision === "approved" && created ? { created } : {}) }, result: { ok: true, created } };
}
type Row = { thread_id: string; message_id: string; created_at: string; parts: unknown };

/** Flattens stored chat messages into AI-suggestion inbox items (newest first). Failed suggestions are skipped. */
export function extractInboxItems(rows: Row[], titles: Record<string, string>, limit = 200): InboxItem[] {
  const out: InboxItem[] = [];
  for (const r of rows) {
    if (!Array.isArray(r.parts)) continue;
    for (const p of r.parts as Array<Record<string, unknown>>) {
      if (typeof p.type !== "string" || !p.type.startsWith("tool-propose_") || p.state !== "output-available") continue;
      const out_ = p.output as Proposal | undefined;
      if (!out_ || !out_.ok) continue;
      const decision = p.decision === "approved" || p.decision === "dismissed" ? p.decision : undefined;
      out.push({ threadId: r.thread_id, threadTitle: titles[r.thread_id] ?? "Chat", messageId: r.message_id, toolCallId: String(p.toolCallId), createdAt: r.created_at, status: decision ?? "waiting", part: { type: p.type, toolCallId: String(p.toolCallId), state: "output-available", output: out_, decision, ...(decision === "approved" && p.created ? { created: p.created as CreatedRef } : {}) } });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export type ChatSource = { threadId: string; kind: CreatedRef["kind"] };
/** Maps each created/changed task, idea or milestone id to the chat that suggested it (newest approval wins). */
export function buildChatSources(items: InboxItem[]): Record<string, ChatSource> {
  const out: Record<string, ChatSource> = {};
  for (const i of [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const c = i.part.created;
    if (i.status === "approved" && c) out[c.id] = { threadId: i.threadId, kind: c.kind };
  }
  return out;
}
