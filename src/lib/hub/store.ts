import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod/v4";
import type { Database } from "@/integrations/supabase/types";
import { GetHubStateResponse } from "./api-zod";
import { clients, policy } from "./clients";
import { mindMapSchema, savedKickoffSchema, type SavedKickoff } from "../kickoff";
import { z as zod } from "zod";
import { importDraftSchema, githubLinkSchema, type ImportDraft, type GithubLink } from "./imports";
export const savedMindMapSchema = zod.object({ map: mindMapSchema, title: zod.string().max(200), revision: zod.number().int(), updatedAt: zod.string() });
export type SavedMindMap = zod.infer<typeof savedMindMapSchema>;

export type HubState = z.infer<typeof GetHubStateResponse> & { kickoffs: SavedKickoff[]; mindMap?: SavedMindMap; imports?: ImportDraft[]; githubLinks?: GithubLink[] };
function parseState(data: unknown): HubState {
  const raw = data as { kickoffs?: unknown[]; mindMap?: unknown; imports?: unknown[]; githubLinks?: unknown[] };
  return {
    ...GetHubStateResponse.parse(data), kickoffs: (raw.kickoffs ?? []).map(k => savedKickoffSchema.parse(k)),
    ...(raw.mindMap ? { mindMap: savedMindMapSchema.parse(raw.mindMap) } : {}),
    imports: (raw.imports ?? []).map(i => importDraftSchema.parse(i)),
    githubLinks: (raw.githubLinks ?? []).map(l => githubLinkSchema.parse(l)),
  };
}
export type HubDb = SupabaseClient<Database>;
/** db is RLS-scoped for the signed-in owner, or the admin client after a verified agent credential. */
export type Actor = { ownerId: string; source: string; agent: boolean; db: HubDb };
export class HubError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const randomUUID = () => crypto.randomUUID();

export function emptyState(): HubState {
  return {
    projects: [], tasks: [], ideas: [], handoffs: [], approvals: [], activity: [], kickoffs: [],
    connections: clients.map(c => ({ ...c, status: "not_configured" as const, lastSeen: null, expiresAt: null, tokenPrefix: null })),
    policy, summary: { activeProjects: 0, openTasks: 0, pendingApprovals: 0, capturedIdeas: 0, verifiedConnections: 0, completedTasks: 0 },
  };
}
export function summarize(s: HubState): HubState {
  s.summary = {
    activeProjects: s.projects.filter(p => p.status === "active").length,
    openTasks: s.tasks.filter(t => !["done", "verified"].includes(t.status)).length,
    pendingApprovals: s.approvals.filter(a => a.status === "pending").length,
    capturedIdeas: s.ideas.filter(i => !["archived", "promoted"].includes(i.status)).length,
    verifiedConnections: s.connections.filter(c => c.status === "verified").length,
    completedTasks: s.tasks.filter(t => ["done", "verified"].includes(t.status)).length,
  };
  return s;
}
export function audit(s: HubState, actor: Pick<Actor, "source">, title: string, description = "", projectId = "", kind = "update", url = "") {
  s.activity.unshift({ id: randomUUID(), title, description, source: actor.source, projectId, kind, url, createdAt: new Date().toISOString() });
}
export async function readState(db: HubDb, ownerId: string) {
  const { data, error } = await db.from("hub_workspaces").select("data").eq("owner_id", ownerId).maybeSingle();
  if (error) throw new HubError(500, error.message);
  return data ? parseState(data.data) : emptyState();
}
/**
 * The workspace is one aggregate: an edit and its audit events are written together.
 * Concurrent writers are serialized with an optimistic revision check and retried.
 */
/** Every successful save also refreshes the private GitHub backup; a backup failure never blocks the save. */
async function backup(ownerId: string, state: HubState) {
  if (process.env.VITEST || !process.env.LOVABLE_API_KEY || !process.env.GITHUB_API_KEY) return;
  try { await (await import("./backup.server")).pushBackup(ownerId, state); }
  catch (e) { console.error("GitHub backup failed", e); }
}
export async function mutateState<T>(actor: Actor, fn: (s: HubState) => T): Promise<T> {
  const { db, ownerId } = actor;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row, error } = await db.from("hub_workspaces").select("data, rev").eq("owner_id", ownerId).maybeSingle();
    if (error) throw new HubError(500, error.message);
    const state = row ? parseState(row.data) : emptyState();
    const result = fn(state);
    const data = summarize(state) as unknown as Database["public"]["Tables"]["hub_workspaces"]["Insert"]["data"];
    if (!row) {
      const { error: insErr } = await db.from("hub_workspaces").insert({ owner_id: ownerId, data, rev: 1 });
      if (!insErr) { await backup(ownerId, state); return result; }
      if (insErr.code !== "23505") throw new HubError(500, insErr.message);
      continue;
    }
    const { data: updated, error: upErr } = await db.from("hub_workspaces")
      .update({ data, rev: row.rev + 1, updated_at: new Date().toISOString() })
      .eq("owner_id", ownerId).eq("rev", row.rev).select("owner_id");
    if (upErr) throw new HubError(500, upErr.message);
    if (updated && updated.length) { await backup(ownerId, state); return result; }
  }
  throw new HubError(409, "This record changed. Refresh the current plan before editing it.");
}
export function requireOwner(actor: Actor) {
  if (actor.agent) throw new HubError(403, "This operation requires the signed-in owner's approval in the web dashboard.");
}
export function project(s: HubState, id: string) {
  const p = s.projects.find(p => p.id === id);
  if (!p) throw new HubError(404, "Project not found");
  return p;
}
export function checkVersion(current: number, expected: number) {
  if (current !== expected) throw new HubError(409, "This record changed. Refresh the current plan before editing it.");
}
export function validateRepository(repository: string | undefined) {
  if (repository && !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) throw new HubError(400, "Repository must use owner/repository format.");
}
export function validateDependencies(s: HubState, projectId: string, id: string, deps: string[]) {
  const visiting = new Set<string>([id]);
  const walk = (dep: string) => {
    if (visiting.has(dep)) throw new HubError(400, "Task dependencies cannot contain cycles.");
    const t = s.tasks.find(t => t.id === dep && t.projectId === projectId);
    if (!t) throw new HubError(400, "Dependencies must be tasks in the same project.");
    visiting.add(dep); t.dependencies.forEach(walk); visiting.delete(dep);
  };
  deps.forEach(walk);
}
export const ok = (message: string, id?: string) => ({ ok: true, message, ...(id ? { id } : {}) });
