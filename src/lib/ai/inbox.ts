import type { Proposal } from "@/lib/ai/chat-tools";

export type InboxStatus = "waiting" | "approved" | "dismissed";
export type InboxItem = { threadId: string; threadTitle: string; messageId: string; toolCallId: string; createdAt: string; status: InboxStatus; part: { type: string; toolCallId: string; state: string; output?: unknown; decision?: "approved" | "dismissed" } };
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
      out.push({ threadId: r.thread_id, threadTitle: titles[r.thread_id] ?? "Chat", messageId: r.message_id, toolCallId: String(p.toolCallId), createdAt: r.created_at, status: decision ?? "waiting", part: { type: p.type, toolCallId: String(p.toolCallId), state: "output-available", output: p.output, decision } });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
