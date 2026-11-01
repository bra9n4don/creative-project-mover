import { z } from "zod";

export const kickoffSteps = ["Brainstorm", "Clarify", "Define", "Plan", "Risks & first actions", "Launch review"] as const;
export const clarifyFields = ["goal", "audience", "scope", "budget", "timeline", "timeAvailable", "risks", "unknowns"] as const;
const text = z.string().max(10000);
export const briefSchema = z.object({ title: z.string(), goal: z.string(), audience: z.string(), scope: z.string(), outOfScope: z.string(), success: z.string(), constraints: z.string(), unknowns: z.string() }).strict();
export const planSchema = z.object({ milestones: z.array(z.object({ title: z.string(), outcome: z.string(), tasks: z.array(z.object({ title: z.string(), description: z.string(), priority: z.enum(["low", "medium", "high"]) }).strict()) }).strict()) }).strict();
export type Brief = z.infer<typeof briefSchema>;
export type KickoffPlan = z.infer<typeof planSchema>;
export const kickoffSchema = z.object({
  version: z.literal(1),
  id: z.string().uuid(),
  step: z.number().int().min(0).max(5),
  sourceIdeaId: z.string().nullable(),
  brainstorm: text,
  clarify: z.object({ goal: text, audience: text, scope: text, budget: text, timeline: text, timeAvailable: text, risks: text, unknowns: text }),
  brief: z.object({ title: z.string().max(150), goal: text, audience: text, scope: text, outOfScope: text, success: text, constraints: text, unknowns: text }),
  plan: z.object({ milestones: z.array(z.object({ title: z.string().max(200), outcome: text, tasks: z.array(z.object({ title: z.string().max(200), description: text, priority: z.enum(["low", "medium", "high"]) })).max(20) })).max(8) }),
  risks: text,
  firstActions: z.tuple([z.string().max(200), z.string().max(200), z.string().max(200)]),
  review: z.object({ goal: z.boolean(), scope: z.boolean(), plan: z.boolean(), risks: z.boolean(), ready: z.boolean() }),
  exportedProjectId: z.string().nullable(),
  mindMap: z.object({
    nodes: z.array(z.object({ id: z.string().max(64), label: z.string().max(200), kind: z.enum(["idea", "feature", "risk", "question"]), x: z.number(), y: z.number() }).strict()).max(150),
    edges: z.array(z.object({ id: z.string().max(140), source: z.string().max(64), target: z.string().max(64) }).strict()).max(300),
  }).strict().optional(),
}).strict();
export type MindMap = NonNullable<z.infer<typeof kickoffSchema>["mindMap"]>;
const MAP_START = "## Mind map";
/** Indented outline of the map (roots = nodes with no parent), tagged by kind. */
export function mindMapOutline(m: MindMap): string {
  const parent = new Map(m.edges.map(e => [e.target, e.source]));
  const kids = (id: string | null) => m.nodes.filter(n => (parent.get(n.id) ?? null) === id && (id !== null || !parent.has(n.id)));
  const tag = { idea: "", feature: "[Feature] ", risk: "[Risk] ", question: "[Question] " } as const;
  const seen = new Set<string>();
  const walk = (id: string | null, depth: number): string[] => kids(id).flatMap(n => {
    if (seen.has(n.id) || !n.label.trim()) return [];
    seen.add(n.id);
    return [`${"  ".repeat(depth)}- ${tag[n.kind]}${n.label.trim()}`, ...walk(n.id, depth + 1)];
  });
  return walk(null, 0).join("\n");
}
/** Replace (or append) the mind map section of the brainstorm text, keeping typed notes. */
export function syncBrainstorm(brainstorm: string, m: MindMap): string {
  const i = brainstorm.indexOf(MAP_START);
  const notes = (i >= 0 ? brainstorm.slice(0, i) : brainstorm).trimEnd();
  const outline = mindMapOutline(m);
  return outline ? `${notes ? notes + "\n\n" : ""}${MAP_START}\n${outline}` : notes;
}
export type Kickoff = z.infer<typeof kickoffSchema>;
export const savedKickoffSchema = z.object({
  data: kickoffSchema, projectId: z.string(), revision: z.number().int(),
  completed: z.boolean(), updatedAt: z.string(),
  taskIds: z.record(z.string()), handoffIds: z.record(z.string()),
});
export type SavedKickoff = z.infer<typeof savedKickoffSchema>;
export const saveKickoffSchema = z.object({
  kickoff: kickoffSchema, expectedRevision: z.number().int().min(0),
  reviewedStep: z.number().int().min(0).max(5).optional(),
});
export function newKickoff(): Kickoff {
  return { version: 1, id: crypto.randomUUID(), step: 0, sourceIdeaId: null, brainstorm: "", clarify: { goal: "", audience: "", scope: "", budget: "", timeline: "", timeAvailable: "", risks: "", unknowns: "" }, brief: { title: "", goal: "", audience: "", scope: "", outOfScope: "", success: "", constraints: "", unknowns: "" }, plan: { milestones: [] }, risks: "", firstActions: ["", "", ""], review: { goal: false, scope: false, plan: false, risks: false, ready: false }, exportedProjectId: null };
}
export function checkpointCode(k: Kickoff): string {
  const bytes = new TextEncoder().encode(JSON.stringify(kickoffSchema.parse(k)));
  return "RELAY1." + btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""));
}
export function restoreCheckpoint(input: string): Kickoff {
  if (input.length > CHECKPOINT_LIMIT) throw new Error("Checkpoint is too large.");
  const raw = input.trim();
  try {
    const json = raw.startsWith("RELAY1.") ? new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(raw.slice(7)), c => c.charCodeAt(0))) : raw;
    return kickoffSchema.parse(JSON.parse(json));
  } catch { throw new Error("This is not a valid Relay Kickoff checkpoint. Use a version 1 checkpoint file or code."); }
}
/** Shared limits: exported brief becomes the project notes, which hold up to 10,000 characters. */
export const KICKOFF_BRIEF_LIMIT = 10000;
// Largest valid kickoff, as base64 code, stays below this, so any checkpoint the wizard makes can be restored.
export const CHECKPOINT_LIMIT = 12_000_000;
export function kickoffSizeIssue(k: Kickoff): string | null {
  const n = kickoffMarkdown(k).length;
  return n > KICKOFF_BRIEF_LIMIT ? `Your brief and plan are ${n.toLocaleString("en-US")} characters; shorten them to ${KICKOFF_BRIEF_LIMIT.toLocaleString("en-US")} so they fit in the project notes.` : null;
}
export function stepIssue(k: Kickoff): string | null {
  if (k.step === 0 && !k.brainstorm.trim()) return "Add your ideas before continuing.";
  if (k.step === 1 && clarifyFields.some(f => !k.clarify[f].trim())) return 'Answer each question, or write "not sure yet".';
  if (k.step === 2 && (!k.brief.title.trim() || !k.brief.goal.trim())) return "Give your brief a title and goal.";
  if (k.step === 3 && (!k.plan.milestones.length || k.plan.milestones.some(m => !m.title.trim() || !m.tasks.length || m.tasks.some(t => !t.title.trim())))) return "Add a named milestone with at least one named task to each milestone.";
  if (k.step === 4 && (!k.risks.trim() || k.firstActions.some(a => !a.trim()))) return "Note your risks and all three first actions.";
  return null;
}
export function kickoffMarkdown(k: Kickoff): string {
  return [`# ${k.brief.title || "Project brief"}`, `## Goal\n${k.brief.goal}`, `## Audience\n${k.brief.audience}`, `## Scope\n${k.brief.scope}`, `## Out of scope\n${k.brief.outOfScope}`, `## Success criteria\n${k.brief.success}`, `## Constraints\n${k.brief.constraints}`, `## Unknowns\n${k.brief.unknowns}`, `## Milestones\n${k.plan.milestones.map((m, i) => `### ${i + 1}. ${m.title}\n${m.outcome}\n${m.tasks.map(t => `- [ ] ${t.title} (${t.priority})\n  ${t.description}`).join("\n")}`).join("\n\n")}`, `## Risks\n${k.risks}`, `## First actions this week\n${k.firstActions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`, `## Readiness\n${Object.entries(k.review).map(([key, done]) => `- [${done ? "x" : " "}] ${key}`).join("\n")}`].join("\n\n");
}
export const kickoffExportSchema = kickoffSchema.refine(k => k.step === 5 && Object.values(k.review).every(Boolean), "Complete the launch review before exporting.").refine(k => k.brief.title.trim() && k.brief.goal.trim() && k.plan.milestones.length > 0 && k.plan.milestones.every(m => m.title.trim() && m.tasks.length > 0 && m.tasks.every(t => t.title.trim())) && k.risks.trim() && k.firstActions.every(a => a.trim()), "Complete the brief, plan, risks and three first actions before exporting.").refine(k => !kickoffSizeIssue(k), "Shorten your brief and plan before exporting.");