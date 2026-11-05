import { z } from "zod";

/** Client-safe import rules shared by the Import page, AI drafting, GitHub and assistant tools. */
export const IMPORT_TEXT_LIMIT = 60000;
export const IMPORT_MAX_TASKS = 50;
export const IMPORT_MAX_IDEAS = 20;
export const importSources = ["chatgpt", "claude", "perplexity", "assistant", "github", "other"] as const;
export type ImportSource = (typeof importSources)[number];
export const sourceLabels: Record<ImportSource, string> = { chatgpt: "ChatGPT", claude: "Claude", perplexity: "Perplexity", assistant: "Assistant", github: "GitHub", other: "Other chat" };

const priority = z.enum(["low", "medium", "high"]);
const draftTask = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(4000), priority, issueNumber: z.number().int().optional() });
const draftIdea = z.object({ title: z.string().trim().min(1).max(150), description: z.string().max(2000) });
const handoff = z.object({ title: z.string().trim().min(1).max(200), summary: z.string().trim().min(1).max(15000), nextAction: z.string().trim().min(1).max(2000), target: z.string().max(100) });

/** The editable content of an import: what the owner reviews before anything is saved. */
export const importContentSchema = z.object({
  project: z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(20000), goal: z.string().max(2000) }),
  tasks: z.array(draftTask).max(IMPORT_MAX_TASKS),
  ideas: z.array(draftIdea).max(IMPORT_MAX_IDEAS),
  handoff: handoff.nullable(),
});
export type ImportContent = z.infer<typeof importContentSchema>;

export const syncChangesSchema = z.object({
  close: z.array(z.object({ taskId: z.string(), title: z.string(), issueNumber: z.number().int() })).max(100),
  rename: z.array(z.object({ taskId: z.string(), from: z.string(), title: z.string().max(200), issueNumber: z.number().int() })).max(100),
});

export const importDraftSchema = z.object({
  id: z.string(),
  kind: z.enum(["new", "sync"]),
  source: z.enum(importSources),
  sourceDetail: z.string().max(200),
  repo: z.string().max(200).optional(),
  keepSynced: z.boolean(),
  matchProjectId: z.string().nullable(),
  targetProjectId: z.string().optional(),
  content: importContentSchema,
  changes: syncChangesSchema.optional(),
  trimmed: z.boolean().optional(),
  createdAt: z.string(),
});
export type ImportDraft = z.infer<typeof importDraftSchema>;

/** Per-project GitHub link; issues map issue number -> task id and the task version when CarterHub last wrote it. */
export const githubLinkSchema = z.object({
  projectId: z.string(), repo: z.string(), lastSyncedAt: z.string().nullable(),
  issues: z.record(z.string(), z.object({ taskId: z.string(), version: z.number().int(), title: z.string() })),
});
export type GithubLink = z.infer<typeof githubLinkSchema>;

/** Input for creating a draft (owner, assistant or GitHub). */
export const createImportSchema = z.object({
  source: z.enum(importSources),
  sourceDetail: z.string().max(200).default(""),
  repo: z.string().max(200).optional(),
  keepSynced: z.boolean().default(false),
  content: importContentSchema,
  trimmed: z.boolean().optional(),
});

export const approveImportSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(["new", "merge"]),
  targetProjectId: z.string().optional(),
  content: importContentSchema.optional(),
  keepSynced: z.boolean().optional(),
});

/** Strict wire schema for the AI draft (no unsupported constraints). */
export const aiImportSchema = z.object({
  project: z.object({ title: z.string(), description: z.string(), goal: z.string() }).strict(),
  tasks: z.array(z.object({ title: z.string(), description: z.string(), priority }).strict()),
  ideas: z.array(z.object({ title: z.string(), description: z.string() }).strict()),
  handoff: z.object({ title: z.string(), summary: z.string(), nextAction: z.string(), target: z.string() }).strict(),
}).strict();

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/** Suggest an existing project by repo or a close title match; the owner still decides. */
export function findMatch(projects: { id: string; title: string; repository: string }[], title: string, repo?: string) {
  if (repo) { const r = projects.find(p => p.repository && p.repository.toLowerCase() === repo.toLowerCase()); if (r) return r.id; }
  const t = norm(title);
  if (!t) return null;
  const hit = projects.find(p => { const n = norm(p.title); return n === t || (n.length > 3 && t.length > 3 && (n.includes(t) || t.includes(n))); });
  return hit?.id ?? null;
}

/** Keep the most recent part of very long chats. */
export function capChat(text: string, limit = IMPORT_TEXT_LIMIT) {
  const clean = text.trim();
  return clean.length <= limit ? { text: clean, trimmed: false } : { text: clean.slice(clean.length - limit), trimmed: true };
}

type GptNode = { message?: { author?: { role?: string }; content?: { parts?: unknown[] }; create_time?: number | null } | null };
type GptConversation = { title?: string; mapping?: Record<string, GptNode>; create_time?: number };
/** ChatGPT conversations.json -> list of {title, text}. Claude exports use chat_messages. */
export function parseExport(json: unknown): { title: string; text: string }[] {
  const list = Array.isArray(json) ? json : [json];
  const out: { title: string; text: string }[] = [];
  for (const c of list as (GptConversation & { name?: string; chat_messages?: { sender?: string; text?: string }[] })[]) {
    if (c?.mapping) {
      const msgs = Object.values(c.mapping).map(n => n.message).filter((m): m is NonNullable<GptNode["message"]> => !!m && !!m.content?.parts?.length)
        .sort((a, b) => (a.create_time ?? 0) - (b.create_time ?? 0))
        .map(m => `${m.author?.role ?? "user"}: ${(m.content?.parts ?? []).filter(p => typeof p === "string").join("\n")}`).filter(l => l.split(": ")[1]?.trim());
      out.push({ title: c.title || "Untitled chat", text: msgs.join("\n\n") });
    } else if (c?.chat_messages) {
      out.push({ title: c.name || "Untitled chat", text: c.chat_messages.map(m => `${m.sender ?? "user"}: ${m.text ?? ""}`).join("\n\n") });
    }
  }
  return out.filter(c => c.text.trim());
}
