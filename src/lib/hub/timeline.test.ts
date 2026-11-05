import { expect, it } from "vitest";
import { projectTimeline, taskProgress } from "./timeline";
import type { Task } from "./types/task";

it.each([["todo", 0], ["in_progress", 50], ["done", 100], ["verified", 100], ["blocked", 0]] as const)("%s has %i percent status progress", (status, expected) => {
  expect(taskProgress({ status })).toBe(expected);
});

it("blocked work retains its started progress", () => {
  expect(taskProgress({ status: "blocked", startedAt: "2026-11-05T12:00:00Z" })).toBe(50);
});

const task: Task = { id: "t", projectId: "p", title: "Work", description: "", status: "in_progress", priority: "medium", agent: "", evidence: "", dependencies: [], version: 1, createdAt: "2026-11-01T12:00:00Z", updatedAt: "2026-11-05T12:00:00Z" };

it("does not infer historical task dates from createdAt or updatedAt", () => {
  const result = projectTimeline([task], Date.parse("2026-11-06T12:00:00Z"));
  expect(result.rows[0]?.start).toBeUndefined();
  expect(result.rows[0]?.end).toBeUndefined();
});

it("orders dated tasks first and extends unfinished work to today", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  const result = projectTimeline([task, { ...task, id: "started", startedAt: "2026-11-05T12:00:00Z" }], now);
  expect(result.rows.map(row => row.task.id)).toEqual(["started", "t"]);
  expect(result.min).toBe(Date.parse("2026-11-05T12:00:00Z"));
  expect(result.max).toBe(now);
});