import { describe, expect, it } from "vitest";
import { isTaskOverdue } from "./task-due";

describe("task overdue tag", () => {
  it("only flags unfinished tasks past their due date", () => {
    expect(isTaskOverdue({ status: "todo", dueDate: "2026-11-01" }, "2026-11-05")).toBe(true);
    expect(isTaskOverdue({ status: "done", dueDate: "2026-11-01" }, "2026-11-05")).toBe(false);
    expect(isTaskOverdue({ status: "todo", dueDate: "2026-11-05" }, "2026-11-05")).toBe(false);
    expect(isTaskOverdue({ status: "todo", dueDate: null }, "2026-11-05")).toBe(false);
  });
});
