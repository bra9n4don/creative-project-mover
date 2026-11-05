import { describe, expect, it } from "vitest";
import { calendarDays, dateKey, deadlineMove } from "./planner";
import { effectiveDue, upcomingMilestones } from "./milestones";

describe("milestone planner scheduling", () => {
  it("covers the full month in Monday-first weeks including leap day", () => {
    const days = calendarDays(new Date(2028, 1, 15, 12));
    expect(dateKey(days[0] ?? new Date(0))).toBe("2028-01-31");
    expect(dateKey(days[days.length - 1] ?? new Date(0))).toBe("2028-03-05");
    expect(days.map(dateKey)).toContain("2028-02-29");
    expect(days.length % 7).toBe(0);
  });
  it("saves a drop with the current version, and skips unchanged dates", () => {
    const m = { id: "m", version: 4, targetDate: "2026-11-15" };
    expect(deadlineMove(m, "2026-12-03")).toEqual({ id: "m", data: { expectedVersion: 4, targetDate: "2026-12-03" } });
    expect(deadlineMove(m, "2026-11-15")).toBeNull();
    expect(deadlineMove(m, "undated")).toBeNull();
    expect(deadlineMove(m, null)?.data.targetDate).toBeNull();
  });
  it("updates dashboard ordering and inherited deadlines without changing explicit task dates or history", () => {
    const m = { id: "m", title: "Beta", version: 2, targetDate: "2026-11-20" };
    const patch = deadlineMove(m, "2026-11-08");
    const updated = { ...m, ...patch?.data };
    const other = { id: "other", title: "Launch", targetDate: "2026-11-15" };
    const task = { milestoneId: "m", status: "todo", startedAt: "2026-11-02T14:00:00Z" };
    expect(upcomingMilestones([m, other], [task], "2026-11-05").map(x => x.milestone.id)).toEqual(["other", "m"]);
    expect(upcomingMilestones([updated, other], [task], "2026-11-05").map(x => x.milestone.id)).toEqual(["m", "other"]);
    expect(effectiveDue(task, [updated])?.date).toBe("2026-11-08");
    expect(effectiveDue({ ...task, dueDate: "2026-12-01" }, [updated])?.date).toBe("2026-12-01");
    expect(task).toEqual({ milestoneId: "m", status: "todo", startedAt: "2026-11-02T14:00:00Z" });
    const cleared = { ...updated, ...deadlineMove(updated, null)?.data };
    expect(upcomingMilestones([cleared], [task])).toEqual([]);
    expect(effectiveDue(task, [cleared])).toBeNull();
  });
});