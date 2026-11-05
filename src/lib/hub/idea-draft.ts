import { z } from "zod";

// Strict wire schema: required fields, no constraints unsupported by providers.
export const ideaDraftSchema = z.object({
  summary: z.string(),
  tasks: z.array(z.object({ title: z.string(), description: z.string() }).strict()),
  risks: z.array(z.string()),
  openQuestions: z.array(z.string()),
}).strict();
export type IdeaDraft = z.infer<typeof ideaDraftSchema>;

export const reviewedIdeaDraftSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  tasks: z.array(z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(600) })).max(6),
  risks: z.array(z.string().trim().min(1).max(300)).max(5),
  openQuestions: z.array(z.string().trim().min(1).max(300)).max(5),
});
export type ReviewedIdeaDraft = z.infer<typeof reviewedIdeaDraftSchema>;

export const IDEA_INPUT_LIMIT = 4000;
