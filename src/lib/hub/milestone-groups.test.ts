import { describe, expect, it } from "vitest";
import { groupTasksByMilestone } from "./milestones";
import { buildTaskChatTouches, type InboxItem } from "@/lib/ai/inbox";
import { removeProject } from "./operations";

const ms = [{ id: "m1", targetDate: "2026-12-01" }, { id: "m2", targetDate: null }];
describe("task list milestone groups", () => {
  it("groups by milestone with done/total and puts unassigned tasks in a bar-less No milestone group", () => {
    const tasks = [{ status: "done", milestoneId: "m1" }, { status: "todo", milestoneId: "m1" }, { status: "todo", milestoneId: null }];
    const g = groupTasksByMilestone(tasks, ms);
    expect(g.map(x => [x.milestone?.id ?? null, x.tasks.length, x.progress?.done ?? null, x.progress?.total ?? null])).toEqual([["m1", 2, 1, 2], ["m2", 0, 0, 0], [null, 1, null, null]]);
  });
  it("has no No milestone group when every task is assigned", () => {
    expect(groupTasksByMilestone([{ status: "todo", milestoneId: "m2" }], ms).some(x => x.milestone === null)).toBe(false);
  });
});

const item = (thread: string, title: string, at: string, id: string, kind: "task" | "task_update" | "idea" = "task", status: InboxItem["status"] = "approved"): InboxItem =>
  ({ threadId: thread, threadTitle: title, messageId: "m", toolCallId: at, createdAt: at, status, part: { type: "tool-propose_task", toolCallId: at, state: "output-available", created: { kind, id } } });
describe("dashboard From chat pill", () => {
  it("shows the newest chat and counts other chats as +N", () => {
    const t = buildTaskChatTouches([item("a", "Old", "2026-11-01", "t1"), item("b", "New", "2026-11-04", "t1", "task_update"), item("a", "Old", "2026-11-02", "t1", "task_update")]);
    expect(t.t1).toEqual({ threadId: "b", threadTitle: "New", others: 1 });
  });
  it("ignores ideas, unapproved cards and deleted chats", () => {
    const t = buildTaskChatTouches([item("a", "A", "1", "i1", "idea"), item("a", "A", "2", "t2", "task", "waiting"), item("gone", "G", "3", "t3")], new Set(["a"]));
    expect(t).toEqual({});
  });
});
