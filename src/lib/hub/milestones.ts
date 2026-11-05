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
