import type { Task } from "./types/task";

/** Overdue only when the due date is before today and the task isn't finished. */
export function isTaskOverdue(t: Pick<Task, "status" | "dueDate">, today = new Date().toISOString().slice(0, 10)): boolean {
  return !!t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "verified";
}
