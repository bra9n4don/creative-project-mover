import { readState, summarize, type Actor, type HubState } from "./store";
import { clients } from "./clients";

export async function getState(actor: Actor) {
  const state = await readState(actor.db, actor.ownerId);
  const { data: keys } = await actor.db.from("hub_agent_keys").select("client_id, prefix, expires_at, last_seen").eq("owner_id", actor.ownerId);
  state.connections = clients.map(c => {
    const key = (keys ?? []).find(k => k.client_id === c.id);
    const valid = key && new Date(key.expires_at).getTime() > Date.now();
    return {
      ...c,
      status: valid ? (key.last_seen ? ("verified" as const) : ("configured" as const)) : ("not_configured" as const),
      lastSeen: key?.last_seen ?? null, tokenPrefix: key?.prefix ?? null, expiresAt: key?.expires_at ?? null,
    };
  });
  return summarize(state);
}
export async function getResumeContext(actor: Actor, projectId?: string) {
  return buildResumeContext(await getState(actor), projectId);
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
const CLOSED = ["done", "verified"];

/** Compact context for assistants: full detail for one focus project, one-line summaries for the rest. */
export function buildResumeContext(s: HubState, projectId?: string) {
  const sorted = [...s.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const focus = projectId ? sorted.find(p => p.id === projectId) : sorted[0];
  const others = projectId ? [] : sorted.slice(1);
  const detail = (p: HubState["projects"][number]) => {
    const checkpoints = s.handoffs.filter(h => h.projectId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const tasks = s.tasks.filter(t => t.projectId === p.id);
    const last = checkpoints[0];
    const next = tasks.find(t => t.status === "in_progress") ?? tasks.find(t => t.status === "todo" && t.dependencies.every(d => tasks.some(t => t.id === d && CLOSED.includes(t.status))));
    const open = tasks.filter(t => !CLOSED.includes(t.status));
    return {
      project: { id: p.id, title: p.title, goal: p.goal, status: p.status, priority: p.priority, version: p.version, repository: p.repository || undefined },
      whereYouLeftOff: last?.summary ?? "No checkpoint saved yet.",
      nextAction: last?.nextAction ?? next?.title ?? "Save a checkpoint with your progress and one next action.",
      checkpoint: last ? { title: last.title, nextAction: last.nextAction, createdAt: last.createdAt } : null,
      openTasks: open.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, version: t.version, description: t.description ? clip(t.description, 300) : undefined, dependencies: t.dependencies.length ? t.dependencies : undefined })),
      finishedTaskTitles: tasks.filter(t => CLOSED.includes(t.status)).map(t => t.title),
      pendingChanges: s.approvals.filter(a => a.projectId === p.id && a.status === "pending").length,
      recentActivity: s.activity.filter(a => a.projectId === p.id).slice(0, 5).map(a => ({ title: a.title, source: a.source, createdAt: a.createdAt })),
    };
  };
  return {
    policy: s.policy,
    focus: focus ? detail(focus) : null,
    otherProjects: others.map(p => ({ id: p.id, title: p.title, status: p.status, updatedAt: p.updatedAt })),
    ideas: s.ideas.filter(i => i.status === "inbox").slice(0, 10).map(i => ({ id: i.id, title: i.title })),
    instructions: "Read this at session start. Pass projectId for another project's details. Before switching projects or ending work, save a checkpoint with completed work, blockers, evidence, and exactly one next action. Do not invent progress.",
  };
}
