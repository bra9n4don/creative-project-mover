import { format, startOfDay, subDays } from "date-fns";
import type { Project, Task } from "./types";

export const finishedTask = (task: Pick<Task, "status">) => task.status === "done" || task.status === "verified";
export function inactiveTask(task: Pick<Task, "status" | "updatedAt">, now: Date) {
  return !finishedTask(task) && new Date(task.updatedAt).getTime() <= now.getTime() - 7 * 86_400_000;
}

export function dashboardData(projects: Project[], tasks: Task[], days: number, now: Date) {
  const ids = new Set(projects.map(p => p.id));
  const scoped = tasks.filter(t => ids.has(t.projectId));
  const daily = Array.from({ length: days }, (_, i) => {
    const date = subDays(startOfDay(now), days - i - 1);
    return { date: format(date, "yyyy-MM-dd"), label: format(date, "MMM d"), added: 0, updated: 0 };
  });
  const buckets = new Map(daily.map(d => [d.date, d]));
  for (const task of scoped) {
    for (const field of ["createdAt", "updatedAt"] as const) {
      const date = new Date(task[field]);
      if (Number.isNaN(date.getTime()) || date > now) continue;
      const bucket = buckets.get(format(date, "yyyy-MM-dd"));
      if (bucket) bucket[field === "createdAt" ? "added" : "updated"]++;
    }
  }
  const rows = projects.map(project => {
    const list = scoped.filter(t => t.projectId === project.id);
    const done = list.filter(finishedTask).length;
    return { project, total: list.length, done, open: list.length - done, inactive: list.filter(t => inactiveTask(t, now)).length, pct: list.length ? Math.round(done / list.length * 100) : 0 };
  }).sort((a, b) => b.inactive - a.inactive || b.open - a.open || a.project.title.localeCompare(b.project.title));
  const done = scoped.filter(finishedTask).length;
  return { daily, rows, total: scoped.length, done, open: scoped.length - done, inactive: scoped.filter(t => inactiveTask(t, now)).length, pct: scoped.length ? Math.round(done / scoped.length * 100) : 0 };
}