import { describe, expect, it } from "vitest";
import { CHAT_HISTORY_LIMIT, CHAT_OUTPUT_TOKENS, proposeIdea, proposeTask, proposeTaskUpdate, threadTitle } from "./chat-tools";
import type { HubState } from "@/lib/hub/store";

const state = { projects: [{ id: "p1", title: "Alpha" }], tasks: [{ id: "t1", title: "Ship", version: 3 }] } as unknown as HubState;

describe("chat proposals never write and validate ids", () => {
  it("returns a suggestion without changing the workspace", () => {
    const before = JSON.stringify(state);
    expect(proposeTask(state, { projectId: "p1", title: "New" })).toMatchObject({ ok: true, kind: "task", projectTitle: "Alpha" });
    expect(proposeIdea(state, { title: "Idea" })).toMatchObject({ ok: true, kind: "idea" });
    expect(JSON.stringify(state)).toBe(before);
  });
  it("rejects unknown project and task ids", () => {
    expect(proposeTask(state, { projectId: "nope", title: "x" }).ok).toBe(false);
    expect(proposeTaskUpdate(state, { taskId: "nope", status: "done" }).ok).toBe(false);
  });
  it("rejects a task change with nothing to change", () => {
    expect(proposeTaskUpdate(state, { taskId: "t1" }).ok).toBe(false);
  });
  it("caps history at 40 messages and replies at 1500 tokens", () => {
    expect(CHAT_HISTORY_LIMIT).toBe(40);
    expect(CHAT_OUTPUT_TOKENS).toBe(1500);
  });
  it("titles threads from the first message, max 60 chars", () => {
    expect(threadTitle("a".repeat(80))).toHaveLength(60);
    expect(threadTitle("  ")).toBe("New chat");
  });
});
