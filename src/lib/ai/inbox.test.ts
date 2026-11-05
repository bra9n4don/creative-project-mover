import { describe, expect, it } from "vitest";
import { extractInboxItems } from "./inbox";

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
