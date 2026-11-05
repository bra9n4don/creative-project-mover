import { describe, expect, it } from "vitest";
import { dashboardData, inactiveTask } from "./dashboard";
import type { Project, Task } from "./types";

const now = new Date("2026-11-05T12:00:00Z");
const task = (patch: Partial<Task> = {}): Task => ({ id: "t", projectId: "p", title: "Task", description: "", status: "todo", priority: "medium", agent: "", evidence: "", dependencies: [], version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...patch });
const project: Project = { id: "p", title: "Project", description: "", goal: "", status: "active", priority: "medium", repository: "", color: "teal", version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString() };

describe("dashboard", () => {
  it("flags unfinished tasks unchanged for exactly seven days, but not recent or finished tasks", () => {
    expect(inactiveTask(task({ updatedAt: "2026-10-29T12:00:00Z" }), now)).toBe(true);
    expect(inactiveTask(task({ updatedAt: "2026-10-29T12:00:01Z" }), now)).toBe(false);
    for (const status of ["done", "verified"] as const) expect(inactiveTask(task({ status, updatedAt: "2026-10-01T00:00:00Z" }), now)).toBe(false);
  });
  it("counts added and latest-updated tasks on their calendar days and fills empty days", () => {
    const data = dashboardData([project], [task({ createdAt: "2026-11-04T12:00:00Z" })], 7, now);
    expect(data.daily).toHaveLength(7);
    expect(data.daily.find(d => d.date === "2026-11-04")?.added).toBe(1);
    expect(data.daily.find(d => d.date === "2026-11-05")?.updated).toBe(1);
    expect(data.daily[0]?.added).toBe(0);
  });
  it("scopes progress to selected projects and counts done and verified as finished", () => {
    const data = dashboardData([project], [task({ status: "done" }), task({ status: "verified" }), task(), task({ projectId: "other" })], 7, now);
    expect(data.total).toBe(3);
    expect(data.done).toBe(2);
    expect(data.pct).toBe(67);
    expect(data.rows[0]?.open).toBe(1);
    expect(dashboardData([], [], 7, now).pct).toBe(0);
  });
});