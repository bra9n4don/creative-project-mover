import { effectiveDue, upcomingMilestones, describe, expect, it } from "vitest";
import { milestoneProgress } from "./milestones";
import { proposeMilestoneUpdate, proposeTask } from "@/lib/ai/chat-tools";
import { emptyState } from "./store";

describe("milestone progress", () => {
  const m = { id: "m", targetDate: "2026-11-01" };
  it("is done tasks over all tasks", () => {
    expect(milestoneProgress(m, [{ status: "done", milestoneId: "m" }, { status: "todo", milestoneId: "m" }, { status: "done", milestoneId: "x" }], "2026-10-01")).toMatchObject({ done: 1, total: 2, percent: 50, overdue: false, complete: false });
  });
  it("is overdue only when past target with unfinished work", () => {
    expect(milestoneProgress(m, [{ status: "todo", milestoneId: "m" }], "2026-11-02").overdue).toBe(true);
    expect(milestoneProgress(m, [{ status: "verified", milestoneId: "m" }], "2026-11-02")).toMatchObject({ overdue: false, complete: true });
    expect(milestoneProgress({ id: "m", targetDate: null }, [{ status: "todo", milestoneId: "m" }], "2030-01-01").overdue).toBe(false);
  });
});

describe("milestone proposals", () => {
  it("reject unknown milestone ids", () => {
    const s = emptyState();
    s.projects.push({ id: "p", title: "P", description: "", goal: "", status: "planning", priority: "medium", repository: "", color: "teal", version: 1, createdAt: "", updatedAt: "" });
    expect(proposeTask(s, { projectId: "p", title: "T", milestoneId: "nope" }).ok).toBe(false);
    expect(proposeMilestoneUpdate(s, { milestoneId: "nope", title: "X" }).ok).toBe(false);
  });
});

describe("milestone dates on tasks and dashboard", () => {
  const ms = [{ id: "m1", title: "Beta", targetDate: "2026-12-01" }, { id: "m2", title: "Later", targetDate: null }];
  it("uses the task's own due date first, then the milestone target", () => {
    expect(effectiveDue({ dueDate: "2026-11-20", milestoneId: "m1" }, ms)).toEqual({ date: "2026-11-20", from: "task" });
    expect(effectiveDue({ milestoneId: "m1" }, ms)).toEqual({ date: "2026-12-01", from: "milestone", milestoneTitle: "Beta" });
    expect(effectiveDue({ milestoneId: "m2" }, ms)).toBeNull();
  });
  it("lists unfinished dated milestones soonest first", () => {
    const list = upcomingMilestones([{ id: "a", targetDate: "2026-12-01" }, { id: "b", targetDate: "2026-11-01" }, { id: "c", targetDate: null }, { id: "d", targetDate: "2026-10-01" }], [{ status: "done", milestoneId: "d" }], "2026-11-05");
    expect(list.map(x => x.milestone.id)).toEqual(["b", "a"]);
    expect(list[0]?.progress.overdue).toBe(true);
  });
});
