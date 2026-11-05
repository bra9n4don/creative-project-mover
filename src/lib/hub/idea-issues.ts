import { z } from "zod";
import type { Idea } from "./types";

/** One chosen repo whose issues mirror into Ideas; links map issues <-> ideas so nothing duplicates. */
export const ideaIssueLinkSchema = z.object({ ideaId: z.string(), number: z.number().int(), url: z.string() });
export const ideaIssuesSchema = z.object({
  repo: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  links: z.array(ideaIssueLinkSchema),
});
export type IdeaIssues = z.infer<typeof ideaIssuesSchema>;
export type IdeaIssueLink = z.infer<typeof ideaIssueLinkSchema>;
export const REPO_RE = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
export const emptyIdeaIssues = (): IdeaIssues => ({ repo: null, lastSyncedAt: null, links: [] });

type Issue = { number: number; title: string; body: string; url: string };
/** Adds an inbox idea for every open issue not yet linked. Never edits or deletes existing ideas. */
export function mergeIssuesIntoIdeas(ideas: Idea[], cfg: IdeaIssues, issues: Issue[], now: string, newId: () => string) {
  const known = new Set(cfg.links.map(l => l.number));
  let added = 0;
  for (const i of issues) {
    if (known.has(i.number)) continue;
    const id = newId();
    ideas.unshift({ id, title: i.title.slice(0, 200), description: i.body.slice(0, 4000), status: "inbox", tags: ["github"], source: `GitHub #${i.number}`, createdAt: now });
    cfg.links.push({ ideaId: id, number: i.number, url: i.url });
    known.add(i.number); added++;
  }
  cfg.lastSyncedAt = now;
  return added;
}
