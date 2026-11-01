import { readState, summarize, type Actor } from "./store";
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
  const s = await getState(actor);
  const projects = projectId ? s.projects.filter(p => p.id === projectId) : s.projects;
  return {
    policy: s.policy,
    projects: projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(p => {
      const checkpoints = s.handoffs.filter(h => h.projectId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const tasks = s.tasks.filter(t => t.projectId === p.id);
      const last = checkpoints[0];
      const next = tasks.find(t => t.status === "in_progress") ?? tasks.find(t => t.status === "todo" && t.dependencies.every(d => tasks.some(t => t.id === d && ["done", "verified"].includes(t.status))));
      return {
        project: p,
        whereYouLeftOff: last?.summary ?? "No checkpoint saved yet.",
        nextAction: last?.nextAction ?? next?.title ?? "Save a checkpoint with your progress and one next action.",
        checkpoint: last ?? null, tasks,
        blockers: tasks.filter(t => t.status === "blocked"),
        pendingChanges: s.approvals.filter(a => a.projectId === p.id && a.status === "pending"),
        recentActivity: s.activity.filter(a => a.projectId === p.id).slice(0, 10),
      };
    }),
    ideas: s.ideas.filter(i => i.status === "inbox"),
    instructions: "At session start read this context. Before switching projects or ending work, save a checkpoint with completed work, blockers, evidence, and exactly one next action. Do not invent progress or claim a fresh session has read previous conversations.",
  };
}
