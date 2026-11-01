import { z } from "zod";

// Strict wire schema: required fields, no constraints unsupported by providers.
export const updateDraftSchema = z.object({
  tasks: z.array(z.object({ title: z.string(), description: z.string(), priority: z.enum(["low", "medium", "high"]) }).strict()),
  handoff: z.object({ title: z.string(), summary: z.string(), nextAction: z.string(), target: z.string() }).strict(),
}).strict();
export type UpdateDraft = z.infer<typeof updateDraftSchema>;
export const reviewedUpdateSchema = z.object({
  projectId: z.string().min(1),
  tasks: z.array(z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(10000), priority: z.enum(["low", "medium", "high"]) })).max(20),
  handoff: z.object({ title: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(15000), nextAction: z.string().trim().min(1).max(10000), target: z.string().max(100) }).nullable(),
  reviewed: z.literal(true),
}).refine(d => d.tasks.length > 0 || d.handoff !== null, "Select at least one task or handoff.");