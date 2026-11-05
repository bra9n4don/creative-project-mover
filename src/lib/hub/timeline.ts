import type { Task } from "./types/task";

export function taskProgress(task: Pick<Task, "status" | "startedAt">): number {
  if (task.status === "done" || task.status === "verified") return 100;
  if (task.status === "in_progress" || (task.status === "blocked" && task.startedAt)) return 50;
  return 0;
}

export function projectTimeline(tasks: Task[], now = Date.now()) {
  const timestamp = (value?: string) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : undefined;
  const rows = tasks.map(task => ({ task, start: timestamp(task.startedAt), end: timestamp(task.completedAt), progress: taskProgress(task) }))
    .sort((a, b) => (a.start ?? a.end ?? Infinity) - (b.start ?? b.end ?? Infinity) || a.task.createdAt.localeCompare(b.task.createdAt));
  const dates = rows.flatMap(row => [row.start, row.end].filter((date): date is number => date !== undefined));
  const ongoing = rows.some(row => row.start !== undefined && row.end === undefined && !["done", "verified"].includes(row.task.status));
  const min = dates.length ? Math.min(...dates) : now;
  const max = Math.max(min + 86400000, ...(ongoing ? [...dates, now] : dates));
  return { rows, min, max };
}