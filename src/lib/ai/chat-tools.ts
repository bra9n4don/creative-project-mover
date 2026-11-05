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
});
export const proposeTaskUpdateInput = z.object({
  taskId: z.string().min(1).describe("Exact task id from context"),
  status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
  title: z.string().min(1).max(200).optional(),
});
export const proposeIdeaInput = z.object({ title: z.string().min(1).max(200), description: z.string().max(600).optional() });

export type Proposal =
  | { kind: "task"; ok: true; projectId: string; projectTitle: string; title: string; description?: string; priority?: "low" | "medium" | "high" }
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
  return { kind: "task", ok: true, projectId: p.id, projectTitle: p.title, title: i.title, ...(i.description ? { description: i.description } : {}), ...(i.priority ? { priority: i.priority } : {}) };
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
