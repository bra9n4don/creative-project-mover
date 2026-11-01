import { z } from "zod";

// Tool-facing input shapes. The hub operations re-validate with the exact API limits.
const priority = z.enum(["low", "medium", "high"]).optional().describe("Priority.");

export const ASSISTANT_TEXT_LIMIT = 2000;
export const ASSISTANT_NEXT_ACTION_LIMIT = 1000;

export const ideaShape = {
  title: z.string().min(1).max(150).describe("Short idea title."),
  description: z.string().max(2000).optional().describe("Details."),
  tags: z.array(z.string().max(50)).max(12).optional().describe("Tags."),
};

export const taskShape = {
  projectId: z.string().describe("Project ID from get_context."),
  title: z.string().min(1).max(150).describe("Task title."),
  description: z.string().max(2000).optional().describe("Details."),
  priority,
  dependencies: z.array(z.string()).max(50).optional().describe("IDs of tasks that must finish first."),
};

export const updateTaskShape = {
  id: z.string().min(1).describe("Task ID."),
  expectedVersion: z.number().int().min(1).describe("The task's current version from get_context."),
  status: z.enum(["todo", "in_progress", "blocked", "done"]).optional().describe("New status. Only the owner can verify."),
  evidence: z.string().max(2000).optional().describe("Real evidence of the work done."),
  title: z.string().min(1).max(150).optional().describe("Proposed new title (needs owner approval)."),
  description: z.string().max(2000).optional().describe("Proposed new description (needs owner approval)."),
  priority: z.enum(["low", "medium", "high"]).optional().describe("Proposed new priority (needs owner approval)."),
};

export const checkpointShape = {
  projectId: z.string().describe("Project ID from get_context."),
  title: z.string().min(1).max(150).describe("Checkpoint title."),
  summary: z.string().min(1).max(2000).describe("What actually happened."),
  nextAction: z.string().min(1).max(1000).describe("One small next action."),
  target: z.string().max(100).optional().describe("Who picks this up next."),
};
