import { z } from "zod";

/** Project roadmap milestone, stored in the workspace aggregate's `milestones[]`. */
export const milestoneSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  outcome: z.string(),
  targetDate: z.iso.date().nullable().optional(),
  order: z.number().int(),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

export const createMilestoneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  outcome: z.string().max(2000).optional(),
  targetDate: z.iso.date().nullable().optional(),
});
export const updateMilestoneSchema = z.object({
  expectedVersion: z.number().int().min(1),
  title: z.string().trim().min(1).max(200).optional(),
  outcome: z.string().max(2000).optional(),
  targetDate: z.iso.date().nullable().optional(),
});
export const reorderMilestonesSchema = z.object({ projectId: z.string().min(1), ids: z.array(z.string()).max(100) });

type TaskLike = { status: string; milestoneId?: string | null };
export type MilestoneProgress = { done: number; total: number; percent: number; complete: boolean; overdue: boolean };

/** Progress = finished tasks / all tasks. Overdue only when the target date has passed and work remains. */
export function milestoneProgress(m: Pick<Milestone, "id" | "targetDate">, tasks: TaskLike[], today = new Date().toISOString().slice(0, 10)): MilestoneProgress {
  const mine = tasks.filter(t => t.milestoneId === m.id);
  const done = mine.filter(t => t.status === "done" || t.status === "verified").length;
  const total = mine.length;
  const complete = total > 0 && done === total;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0, complete, overdue: !complete && !!m.targetDate && m.targetDate < today };
}

export const MILESTONE_CONTEXT_LIMIT = 12;

/** A task's own due date wins; otherwise it falls back to its milestone's target date (shown, never saved to the task). */
export function effectiveDue(task: { dueDate?: string | null; milestoneId?: string | null }, milestones: Pick<Milestone, "id" | "title" | "targetDate">[]): { date: string; from: "task" | "milestone"; milestoneTitle?: string } | null {
  if (task.dueDate) return { date: task.dueDate, from: "task" };
  const m = task.milestoneId ? milestones.find(x => x.id === task.milestoneId) : undefined;
  return m?.targetDate ? { date: m.targetDate, from: "milestone", milestoneTitle: m.title } : null;
}

/** Dated milestones that still have work left, soonest first (overdue ones lead). */
export function upcomingMilestones<M extends Pick<Milestone, "id" | "targetDate">>(milestones: M[], tasks: TaskLike[], today = new Date().toISOString().slice(0, 10)): Array<{ milestone: M; progress: MilestoneProgress }> {
  return milestones.filter(m => m.targetDate).map(m => ({ milestone: m, progress: milestoneProgress(m, tasks, today) }))
    .filter(x => !x.progress.complete).sort((a, b) => a.milestone.targetDate!.localeCompare(b.milestone.targetDate!));
}

/** Groups tasks under their milestone (roadmap order), then a trailing "No milestone" group (milestone: null) when any task has none. */
export function groupTasksByMilestone<T extends TaskLike, M extends Pick<Milestone, "id" | "targetDate">>(tasks: T[], milestones: M[], allTasks: TaskLike[] = tasks): Array<{ milestone: M | null; tasks: T[]; progress: MilestoneProgress | null }> {
  const groups: Array<{ milestone: M | null; tasks: T[]; progress: MilestoneProgress | null }> = milestones.map(m => ({ milestone: m, tasks: tasks.filter(t => t.milestoneId === m.id), progress: milestoneProgress(m, allTasks) }));
  const loose = tasks.filter(t => !t.milestoneId || !milestones.some(m => m.id === t.milestoneId));
  if (loose.length) groups.push({ milestone: null, tasks: loose, progress: null });
  return groups;
}
