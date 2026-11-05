import { describe, expect, it } from "vitest";
import { effectiveDue, groupTasksByMilestone, milestoneProgress } from "./milestones";

describe("Phase 1 milestone boundaries", () => {
  it("0/0 is never complete, even for a passed deadline", () => {
    expect(milestoneProgress({ id: "m", targetDate: "2026-11-01" }, [], "2026-11-05")).toEqual({ done: 0, total: 0, percent: 0, complete: false, overdue: true });
  });
  it.each([["2026-11-04", true], ["2026-11-05", false], ["2026-11-06", false]])("uses a strict passed-date comparison for %s", (targetDate, overdue) => {
    expect(milestoneProgress({ id: "m", targetDate }, [{ milestoneId: "m", status: "todo" }], "2026-11-05").overdue).toBe(overdue);
  });
  it("counts done and verified, rounds percent, and ignores unrelated assignments", () => {
    const tasks = [{ status: "done", milestoneId: "m" }, { status: "verified", milestoneId: "m" }, { status: "in_progress", milestoneId: "m" }, { status: "done", milestoneId: "other" }];
    expect(milestoneProgress({ id: "m", targetDate: "2026-11-01" }, tasks, "2026-11-05")).toEqual({ done: 2, total: 3, percent: 67, complete: false, overdue: true });
    tasks[2].status = "done";
    expect(milestoneProgress({ id: "m", targetDate: "2026-11-01" }, tasks, "2026-11-05")).toMatchObject({ percent: 100, complete: true, overdue: false });
  });
  it("groups each assignment exactly once; missing milestones fall back to no milestone", () => {
    const tasks = [{ id: "a", status: "done", milestoneId: "m" }, { id: "b", status: "todo", milestoneId: "missing" }, { id: "c", status: "todo" }];
    const groups = groupTasksByMilestone(tasks, [{ id: "m" }, { id: "empty" }]);
    expect(groups.map(g => g.tasks.map(t => t.id))).toEqual([["a"], [], ["b", "c"]]);
    expect(groups[2].progress).toBeNull();
    expect(groups[1].progress).toMatchObject({ total: 0, complete: false });
  });
  it("inherits dates without mutation, gives explicit due dates precedence, and tolerates dangling assignments", () => {
    const task = { milestoneId: "m", dueDate: null };
    const milestones = [{ id: "m", title: "Milestone", targetDate: "2026-11-10" }];
    expect(effectiveDue(task, milestones)).toMatchObject({ date: "2026-11-10", from: "milestone" });
    expect(task.dueDate).toBeNull();
    expect(effectiveDue({ ...task, dueDate: "2026-11-09" }, milestones)).toEqual({ date: "2026-11-09", from: "task" });
    expect(effectiveDue({ milestoneId: "missing" }, milestones)).toBeNull();
  });
});