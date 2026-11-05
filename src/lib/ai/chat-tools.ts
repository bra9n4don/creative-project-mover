import { z } from "zod";
import type { HubState } from "@/lib/hub/store";

/** Chat limits shared by the server route and tests. */
export const CHAT_HISTORY_LIMIT = 40;
export const CHAT_INPUT_LIMIT = 4000;
export const CHAT_OUTPUT_TOKENS = 1500;

export const proposeTaskInput = z.object({
  projectId: z.string().min(1).describe("Exact project id from context"),
  title: z.string().min(1).max(200),
  description: z.string().max(600).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  milestoneId: z.string().optional().describe("Exact milestone id from context, if the task belongs to one"),
});
export const proposeMilestoneInput = z.object({
  projectId: z.string().min(1).describe("Exact project id from context"),
  title: z.string().min(1).max(200),
  outcome: z.string().max(600).optional(),
  targetDate: z.iso.date().optional().describe("YYYY-MM-DD"),
});
export const proposeMilestoneUpdateInput = z.object({
  milestoneId: z.string().min(1).describe("Exact milestone id from context"),
  title: z.string().min(1).max(200).optional(),
  targetDate: z.iso.date().optional().describe("New target date, YYYY-MM-DD"),
});
export const proposeTaskUpdateInput = z.object({
  taskId: z.string().min(1).describe("Exact task id from context"),
  status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
  title: z.string().min(1).max(200).optional(),
});
export const proposeIdeaInput = z.object({ title: z.string().min(1).max(200), description: z.string().max(600).optional() });

export type Proposal =
  | { kind: "task"; ok: true; projectId: string; projectTitle: string; title: string; description?: string; priority?: "low" | "medium" | "high"; milestoneId?: string; milestoneTitle?: string }
  | { kind: "milestone"; ok: true; projectId: string; projectTitle: string; title: string; outcome?: string; targetDate?: string }
  | { kind: "milestone_update"; ok: true; milestoneId: string; milestoneTitle: string; title?: string; targetDate?: string }
  | { kind: "task_update"; ok: true; taskId: string; taskTitle: string; status?: string; title?: string }
  | { kind: "idea"; ok: true; title: string; description?: string }
  | { ok: false; error: string };

/**
 * Proposal tools never write. They validate ids against the workspace and
 * return a suggestion the owner must approve in the chat UI.
 */
export function proposeTask(s: HubState, i: z.infer<typeof proposeTaskInput>): Proposal {
  const p = s.projects.find(p => p.id === i.projectId);
  if (!p) return { ok: false, error: "Unknown project id." };
  const m = i.milestoneId ? (s.milestones ?? []).find(m => m.id === i.milestoneId && m.projectId === p.id) : undefined;
  if (i.milestoneId && !m) return { ok: false, error: "Unknown milestone id for this project." };
  return { kind: "task", ok: true, projectId: p.id, projectTitle: p.title, title: i.title, ...(i.description ? { description: i.description } : {}), ...(i.priority ? { priority: i.priority } : {}), ...(m ? { milestoneId: m.id, milestoneTitle: m.title } : {}) };
}
export function proposeMilestone(s: HubState, i: z.infer<typeof proposeMilestoneInput>): Proposal {
  const p = s.projects.find(p => p.id === i.projectId);
  if (!p) return { ok: false, error: "Unknown project id." };
  return { kind: "milestone", ok: true, projectId: p.id, projectTitle: p.title, title: i.title, ...(i.outcome ? { outcome: i.outcome } : {}), ...(i.targetDate ? { targetDate: i.targetDate } : {}) };
}
export function proposeMilestoneUpdate(s: HubState, i: z.infer<typeof proposeMilestoneUpdateInput>): Proposal {
  const m = (s.milestones ?? []).find(m => m.id === i.milestoneId);
  if (!m) return { ok: false, error: "Unknown milestone id." };
  if (!i.title && !i.targetDate) return { ok: false, error: "Nothing to change." };
  return { kind: "milestone_update", ok: true, milestoneId: m.id, milestoneTitle: m.title, ...(i.title ? { title: i.title } : {}), ...(i.targetDate ? { targetDate: i.targetDate } : {}) };
}
export function proposeTaskUpdate(s: HubState, i: z.infer<typeof proposeTaskUpdateInput>): Proposal {
  const t = s.tasks.find(t => t.id === i.taskId);
  if (!t) return { ok: false, error: "Unknown task id." };
  if (!i.status && !i.title) return { ok: false, error: "Nothing to change." };
  return { kind: "task_update", ok: true, taskId: t.id, taskTitle: t.title, ...(i.status ? { status: i.status } : {}), ...(i.title ? { title: i.title } : {}) };
}
export function proposeIdea(_s: HubState, i: z.infer<typeof proposeIdeaInput>): Proposal {
  return { kind: "idea", ok: true, title: i.title, ...(i.description ? { description: i.description } : {}) };
}

export function threadTitle(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}...` : t || "New chat";
}
