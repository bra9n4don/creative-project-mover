import { describe, expect, it } from "vitest";
import { APPROVING_LOCK_MS, applyDecision, buildChatSources, extractInboxItems } from "./inbox";

const idea = (id: string, decision?: string) => ({ type: "tool-propose_idea", toolCallId: id, state: "output-available", output: { kind: "idea", ok: true, title: id }, ...(decision ? { decision } : {}) });

describe("AI inbox", () => {
  it("derives waiting / approved / dismissed from stored decisions", () => {
    const items = extractInboxItems([{ thread_id: "t", message_id: "m", created_at: "2026-11-05T00:00:00Z", parts: [idea("a"), idea("b", "approved"), idea("c", "dismissed")] }], { t: "Chat" });
    expect(items.map(i => [i.toolCallId, i.status])).toEqual([["a", "waiting"], ["b", "approved"], ["c", "dismissed"]]);
  });
  it("skips failed suggestions and plain text", () => {
    const items = extractInboxItems([{ thread_id: "t", message_id: "m", created_at: "x", parts: [{ type: "text", text: "hi" }, { type: "tool-propose_task", toolCallId: "z", state: "output-available", output: { ok: false, error: "no" } }] }], {});
    expect(items).toHaveLength(0);
  });
});

describe("AI inbox approval links", () => {
  it("passes the created item through on approved cards", () => {
    const part = { ...idea("a", "approved"), created: { kind: "idea", id: "i1" } };
    const [item] = extractInboxItems([{ thread_id: "t", message_id: "m", created_at: "x", parts: [part] }], {});
    expect(item!.part.created).toEqual({ kind: "idea", id: "i1" });
  });
  it("treats a stale approving lock as waiting and lets it be retaken", () => {
    const part = { ...idea("a"), approvingAt: 1 };
    expect(extractInboxItems([{ thread_id: "t", message_id: "m", created_at: "x", parts: [part] }], {})[0]!.status).toBe("waiting");
    expect(applyDecision(part, "approving", undefined, 1 + APPROVING_LOCK_MS + 1).result.ok).toBe(true);
    expect(applyDecision(part, "approving", undefined, 1000).result.locked).toBe(true);
  });
  it("never overwrites an approved card", () => {
    const part = { ...idea("a", "approved"), created: { kind: "idea", id: "i1" } };
    const r = applyDecision(part, "dismissed", undefined);
    expect(r.result.alreadyApproved).toBe(true);
    expect(r.part.decision).toBe("approved");
  });
});

describe("chat source links", () => {
  it("maps only approved items with a created ref, newest approval wins", () => {
    const rows = [
      { thread_id: "old", message_id: "m1", created_at: "2026-11-01T00:00:00Z", parts: [{ ...idea("a", "approved"), created: { kind: "task_update", id: "t1" } }] },
      { thread_id: "new", message_id: "m2", created_at: "2026-11-02T00:00:00Z", parts: [{ ...idea("b", "approved"), created: { kind: "task_update", id: "t1" } }, idea("c"), { ...idea("d", "dismissed"), created: { kind: "idea", id: "i9" } }] },
    ];
    const s = buildChatSources(extractInboxItems(rows, {}));
    expect(s).toEqual({ t1: { threadId: "new", kind: "task_update" } });
  });
});
