import { randomUUID } from "./store";
import { reviewedUpdateSchema } from "./update-draft";
import { kickoffExportSchema, kickoffMarkdown, saveKickoffSchema, stepIssue, kickoffSteps } from "../kickoff";
import {
  CreateProjectBody, UpdateProjectBody, CreateIdeaBody, UpdateIdeaBody,
  CreateTaskBody, UpdateTaskBody, CreateHandoffBody, DecideApprovalBody,
} from "./api-zod";
import { type Actor, type HubState, HubError, mutateState, audit, project, checkVersion, validateRepository, validateDependencies, requireOwner, ok } from "./store";

export function addProject(actor: Actor, input: unknown) {
  const data = CreateProjectBody.parse(input); validateRepository(data.repository);
  return mutateState(actor, s => {
    const now = new Date().toISOString();
    const p: HubState["projects"][number] = { id: randomUUID(), title: data.title.trim(), description: data.description ?? "", goal: data.goal ?? "", status: "planning", priority: data.priority ?? "medium", repository: data.repository ?? "", color: data.color ?? "teal", version: 1, createdAt: now, updatedAt: now };
    if (!p.title) throw new HubError(400, "A project title is required.");
    s.projects.unshift(p); audit(s, actor, `Created project: ${p.title}`, "A place to save your progress and next step.", p.id, "project");
    return p;
  });
}
function queueChange(s: HubState, actor: Actor, projectId: string, changes: object, description: string) {
  const p = project(s, projectId);
  const id = randomUUID();
  s.approvals.unshift({ id, projectId, projectTitle: p.title, title: `Proposed changes to ${p.title}`, description, source: actor.source, status: "pending", changes: JSON.stringify(changes, null, 2), createdAt: new Date().toISOString() });
  audit(s, actor, "Plan change awaiting your approval", description, projectId, "approval");
  return { ...ok("Saved to your approval inbox. The current plan is unchanged.", id), approvalRequired: true };
}
export function editProject(actor: Actor, id: string, input: unknown) {
  const data = UpdateProjectBody.parse(input); validateRepository(data.repository);
  return mutateState(actor, s => {
    const p = project(s, id); checkVersion(p.version, data.expectedVersion);
    if (actor.agent) return queueChange(s, actor, id, { type: "project", ...data }, "Review the proposed plan, goal or priority changes.");
    const { expectedVersion: _, ...patch } = data;
    Object.assign(p, patch, { version: p.version + 1, updatedAt: new Date().toISOString() });
    audit(s, actor, `Updated project: ${p.title}`, Object.keys(patch).join(", "), id, "project");
    return ok("Project saved.", id);
  });
}
export function removeProject(actor: Actor, id: string) {
  requireOwner(actor);
  return mutateState(actor, s => {
    const p = project(s, id);
    s.projects = s.projects.filter(p => p.id !== id);
    s.tasks = s.tasks.filter(t => t.projectId !== id);
    s.handoffs = s.handoffs.filter(h => h.projectId !== id);
    s.kickoffs = s.kickoffs.filter(k => k.projectId !== id);
    s.approvals.filter(a => a.projectId === id && a.status === "pending").forEach(a => { a.status = "rejected"; });
    audit(s, actor, `Deleted project: ${p.title}`, "Project tasks and checkpoints were removed. This audit record remains.", id, "delete");
    return ok("Project and its tasks and checkpoints deleted.");
  });
}
export function addIdea(actor: Actor, input: unknown) {
  const data = CreateIdeaBody.parse(input);
  return mutateState(actor, s => {
    if (!data.title.trim()) throw new HubError(400, "An idea title is required.");
    const idea: HubState["ideas"][number] = { id: randomUUID(), title: data.title.trim(), description: data.description ?? "", status: "inbox", tags: data.tags ?? [], source: actor.source, createdAt: new Date().toISOString() };
    s.ideas.unshift(idea); audit(s, actor, `Captured idea: ${idea.title}`, "", "", "idea");
    return idea;
  });
}
export function editIdea(actor: Actor, id: string, input: unknown) {
  const data = UpdateIdeaBody.parse(input);
  return mutateState(actor, s => {
    const idea = s.ideas.find(i => i.id === id);
    if (!idea) throw new HubError(404, "Idea not found");
    if (idea.status === "promoted") throw new HubError(409, "This idea is already a project.");
    Object.assign(idea, data); audit(s, actor, `Updated idea: ${idea.title}`, "", "", "idea");
    return ok("Idea saved.", id);
  });
}
export function removeIdea(actor: Actor, id: string) {
  requireOwner(actor);
  return mutateState(actor, s => {
    const idea = s.ideas.find(i => i.id === id);
    if (!idea) throw new HubError(404, "Idea not found");
    s.ideas = s.ideas.filter(i => i.id !== id);
    audit(s, actor, `Deleted idea: ${idea.title}`, "", "", "delete"); return ok("Idea deleted.");
  });
}
export function promote(actor: Actor, id: string) {
  requireOwner(actor);
  return mutateState(actor, s => {
    const idea = s.ideas.find(i => i.id === id);
    if (!idea) throw new HubError(404, "Idea not found");
    if (idea.status === "promoted") throw new HubError(409, "This idea is already a project.");
    const now = new Date().toISOString(), projectId = randomUUID();
    s.projects.unshift({ id: projectId, title: idea.title, description: idea.description, goal: "", status: "planning", priority: "medium", repository: "", color: "teal", version: 1, createdAt: now, updatedAt: now });
    idea.status = "promoted";
    audit(s, actor, `Turned idea into project: ${idea.title}`, "", projectId, "project");
    return ok("Your idea is now a project.", projectId);
  });
}
export function addTask(actor: Actor, input: unknown) {
  const data = CreateTaskBody.parse(input);
  return mutateState(actor, s => {
    project(s, data.projectId);
    const id = randomUUID();
    validateDependencies(s, data.projectId, id, data.dependencies ?? []);
    if (!data.title.trim()) throw new HubError(400, "A task title is required.");
    const now = new Date().toISOString();
    const t: HubState["tasks"][number] = { id, projectId: data.projectId, title: data.title.trim(), description: data.description ?? "", status: "todo", priority: data.priority ?? "medium", agent: actor.agent ? actor.source : data.agent ?? "", evidence: "", dependencies: data.dependencies ?? [], version: 1, createdAt: now, updatedAt: now };
    s.tasks.push(t); audit(s, actor, `Added next step: ${t.title}`, "", t.projectId, "task");
    return t;
  });
}
export function editTask(actor: Actor, id: string, input: unknown) {
  const data = UpdateTaskBody.parse(input);
  return mutateState(actor, s => {
    const t = s.tasks.find(t => t.id === id);
    if (!t) throw new HubError(404, "Task not found");
    checkVersion(t.version, data.expectedVersion);
    if (actor.agent && data.status === "verified") throw new HubError(403, "Only you can verify completion. Agents can report done with evidence.");
    if (data.dependencies) validateDependencies(s, t.projectId, id, data.dependencies);
    if (actor.agent && (data.priority !== undefined || data.title !== undefined || data.description !== undefined || data.dependencies !== undefined)) {
      return queueChange(s, actor, t.projectId, { type: "task", taskId: id, ...data }, `Review proposed changes to task: ${t.title}`);
    }
    const dependencies = data.dependencies ?? t.dependencies;
    if (["in_progress", "done", "verified"].includes(data.status ?? "")) {
      if (dependencies.some(d => !s.tasks.some(dep => dep.id === d && ["done", "verified"].includes(dep.status)))) throw new HubError(409, "Finish the prerequisite tasks first.");
    }
    if (data.status === "verified" && !(data.evidence ?? t.evidence).trim()) throw new HubError(400, "Add supporting evidence before verifying a task.");
    const { expectedVersion: _, ...patch } = data;
    Object.assign(t, patch, { version: t.version + 1, updatedAt: new Date().toISOString() });
    audit(s, actor, `${t.status === "verified" ? "Verified" : "Updated"} task: ${t.title}`, data.evidence ?? data.status ?? "", t.projectId, "task");
    return ok("Progress saved.", id);
  });
}
export function removeTask(actor: Actor, id: string) {
  requireOwner(actor);
  return mutateState(actor, s => {
    const t = s.tasks.find(t => t.id === id);
    if (!t) throw new HubError(404, "Task not found");
    if (s.tasks.some(other => other.dependencies.includes(id))) throw new HubError(409, "Remove this task from other tasks' dependencies before deleting it.");
    s.tasks = s.tasks.filter(t => t.id !== id);
    audit(s, actor, `Deleted task: ${t.title}`, "", t.projectId, "delete"); return ok("Task deleted.");
  });
}
export function addHandoff(actor: Actor, input: unknown) {
  const data = CreateHandoffBody.parse(input);
  return mutateState(actor, s => {
    project(s, data.projectId);
    const h = { ...data, id: randomUUID(), source: actor.source, target: data.target ?? "Next session", createdAt: new Date().toISOString() };
    s.handoffs.unshift(h); audit(s, actor, `Saved checkpoint: ${h.title}`, h.nextAction, h.projectId, "checkpoint");
    const p = project(s, h.projectId); p.updatedAt = h.createdAt;
    return h;
  });
}
/** Explicit owner review commits the entire draft and audit event together. */
export function saveReviewedUpdate(actor: Actor, input: unknown) {
  requireOwner(actor);
  const data = reviewedUpdateSchema.parse(input);
  return mutateState(actor, s => {
    const p = project(s, data.projectId);
    const now = new Date().toISOString();
    const tasks = data.tasks.map(t => ({ ...t, id: randomUUID(), projectId: p.id, status: "todo" as const, agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now }));
    s.tasks.push(...tasks);
    const handoff = data.handoff ? { ...data.handoff, projectId: p.id, id: randomUUID(), source: "You · AI-assisted", createdAt: now } : null;
    if (handoff) s.handoffs.unshift(handoff);
    p.updatedAt = now;
    audit(s, actor, "Saved reviewed project update", `${tasks.length} tasks${handoff ? " and a handoff" : ""}`, p.id, "checkpoint");
    return { tasks, handoff };
  });
}
export function decide(actor: Actor, id: string, input: unknown) {
  requireOwner(actor);
  const data = DecideApprovalBody.parse(input);
  return mutateState(actor, s => {
    const a = s.approvals.find(a => a.id === id);
    if (!a) throw new HubError(404, "Proposal not found");
    if (a.status !== "pending") throw new HubError(409, "This proposal already has a decision.");
    if (data.decision === "approved") {
      const changes = JSON.parse(a.changes);
      const p = project(s, a.projectId);
      if (changes.type === "project") {
        const update = UpdateProjectBody.parse(changes); checkVersion(p.version, update.expectedVersion);
        const { expectedVersion: _, ...patch } = update;
        Object.assign(p, patch, { version: p.version + 1, updatedAt: new Date().toISOString() });
      } else {
        const t = s.tasks.find(t => t.id === changes.taskId && t.projectId === a.projectId);
        if (!t) throw new HubError(404, "Proposed task no longer exists.");
        const update = UpdateTaskBody.parse(changes); checkVersion(t.version, update.expectedVersion);
        if (update.dependencies) validateDependencies(s, t.projectId, t.id, update.dependencies);
        if (update.status === "verified" && !(update.evidence ?? t.evidence).trim()) throw new HubError(400, "Verification requires evidence.");
        if (["in_progress", "done", "verified"].includes(update.status ?? "") && (update.dependencies ?? t.dependencies).some(d => !s.tasks.some(dep => dep.id === d && ["done", "verified"].includes(dep.status)))) throw new HubError(409, "Prerequisites are not complete.");
        const { expectedVersion: _, ...patch } = update;
        Object.assign(t, patch, { version: t.version + 1, updatedAt: new Date().toISOString() });
      }
    }
    a.status = data.decision;
    audit(s, actor, `${data.decision === "approved" ? "Approved" : "Rejected"} plan change`, a.description, a.projectId, "approval");
    return ok(`Proposal ${data.decision}.`);
  });
}

export function exportKickoff(actor: Actor, input: unknown) {
  requireOwner(actor);
  const k = kickoffExportSchema.parse(input);
  return mutateState(actor, s => {
    // Stable checkpoint id makes retry/resume safe without a second project.
    const existing = s.activity.find(a => a.kind === "kickoff" && a.description === k.id);
    if (existing) {
      project(s, existing.projectId);
      return { projectId: existing.projectId };
    }
    const idea = k.sourceIdeaId ? s.ideas.find(i => i.id === k.sourceIdeaId) : undefined;
    if (k.sourceIdeaId && !idea) throw new HubError(409, "The source idea was removed. Resume without it or choose another idea.");
    if (idea?.status === "promoted") throw new HubError(409, "This idea is already a project.");
    const id = randomUUID(), now = new Date().toISOString();
    const markdown = kickoffMarkdown(k);
    if (markdown.length > 15000) throw new HubError(400, "Shorten your brief and plan to 15,000 characters before exporting.");
    s.projects.unshift({ id, title: k.brief.title.trim(), goal: k.brief.goal, description: markdown.slice(0, 10000), status: "planning", priority: "medium", repository: "", color: "teal", version: 1, createdAt: now, updatedAt: now });
    for (const m of k.plan.milestones) for (const t of m.tasks) s.tasks.push({ id: randomUUID(), projectId: id, title: t.title.trim(), description: `${m.title}\n${t.description}`.slice(0, 10000), priority: t.priority, status: "todo", agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now });
    for (const title of k.firstActions) if (!s.tasks.some(t => t.projectId === id && t.title.toLowerCase() === title.trim().toLowerCase())) s.tasks.push({ id: randomUUID(), projectId: id, title: title.trim(), description: "First action this week", priority: "high", status: "todo", agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now });
    s.handoffs.unshift({ id: randomUUID(), projectId: id, title: "Kickoff checkpoint", summary: markdown, nextAction: k.firstActions[0], target: "Next session", source: "You · Kickoff", createdAt: now });
    if (idea) idea.status = "promoted"; // Relay's existing planned-idea status.
    audit(s, actor, "Exported reviewed Kickoff", k.id, id, "kickoff");
    return { projectId: id };
  });
}

/** Draft answers persist immediately; AI-derived live records require an explicit step review. */
export function saveKickoff(actor: Actor, input: unknown) {
  requireOwner(actor);
  const { kickoff: k, expectedRevision, reviewedStep } = saveKickoffSchema.parse(input);
  if (reviewedStep !== undefined) {
    const issue = stepIssue({ ...k, step: reviewedStep });
    if (issue) throw new HubError(400, issue);
    if (reviewedStep === 5) kickoffExportSchema.parse(k);
  }
  return mutateState(actor, s => {
    let record = s.kickoffs.find(r => r.data.id === k.id);
    if ((record?.revision ?? 0) !== expectedRevision) throw new HubError(409, "This Kickoff changed in another tab. Resume the saved project before editing again.");
    if (record?.completed) throw new HubError(409, "This Kickoff is complete. Edit its project directly.");
    const now = new Date().toISOString();
    if (!record) {
      if (k.exportedProjectId || s.activity.some(a => a.kind === "kickoff" && a.description === k.id)) throw new HubError(409, "This checkpoint has already been exported. Open its project instead.");
      const idea = k.sourceIdeaId ? s.ideas.find(i => i.id === k.sourceIdeaId) : undefined;
      if (k.sourceIdeaId && (!idea || idea.status === "promoted")) throw new HubError(409, "Choose an available idea before saving.");
      const projectId = randomUUID();
      s.projects.unshift({ id: projectId, title: idea?.title ?? (k.brainstorm.trim().split("\n")[0]?.slice(0, 150) || "Untitled Kickoff"), description: k.brainstorm, goal: "", status: "planning", priority: "medium", repository: "", color: "teal", version: 1, createdAt: now, updatedAt: now });
      record = { data: k, projectId, revision: 0, completed: false, updatedAt: now, taskIds: {}, handoffIds: {} };
      s.kickoffs.push(record);
      if (idea) idea.status = "promoted";
      audit(s, actor, "Started Kickoff project", k.id, projectId, "kickoff-start");
    }
    const p = project(s, record.projectId);
    // Autosave never puts an unreviewed AI brief or plan into live project context.
    if (k.step <= 1) { p.description = k.brainstorm; p.goal = k.clarify.goal; }
    if (reviewedStep === 2 || reviewedStep === 5) {
      p.title = k.brief.title.trim(); p.goal = k.brief.goal;
      p.description = kickoffMarkdown({ ...k, plan: { milestones: [] } });
    }
    const upsertTasks = (group: string, items: { title: string; description: string; priority: "low" | "medium" | "high" }[]) => {
      for (const [i, item] of items.entries()) {
        const key = `${group}:${i}`;
        const existing = s.tasks.find(t => t.id === record?.taskIds[key]);
        if (existing) {
          if (existing.title !== item.title.trim() || existing.description !== item.description || existing.priority !== item.priority) {
            if (existing.status !== "todo" || existing.dependencies.length || s.tasks.some(t => t.dependencies.includes(existing.id))) throw new HubError(409, "A Kickoff task is already in use. Edit it from the project instead.");
            Object.assign(existing, item, { title: item.title.trim(), version: existing.version + 1, updatedAt: now });
          }
        } else {
          const id = randomUUID(); record.taskIds[key] = id;
          s.tasks.push({ ...item, title: item.title.trim(), id, projectId: p.id, status: "todo", agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now });
        }
      }
      const removed = Object.keys(record.taskIds).filter(key => key.startsWith(`${group}:`) && Number(key.split(":")[1]) >= items.length);
      for (const key of removed) {
        const id = record.taskIds[key], task = s.tasks.find(t => t.id === id);
        if (!id) continue;
        if (task && (task.status !== "todo" || task.dependencies.length || s.tasks.some(t => t.dependencies.includes(id)))) throw new HubError(409, "A removed Kickoff task is already in use. Edit it from the project instead.");
        s.tasks = s.tasks.filter(t => t.id !== id); delete record.taskIds[key];
      }
    };
    if (reviewedStep === 3 || reviewedStep === 5) upsertTasks("plan", k.plan.milestones.flatMap(m => m.tasks.map(t => ({ ...t, description: `${m.title}\n${m.outcome}\n${t.description}` }))));
    if (reviewedStep === 4 || reviewedStep === 5) upsertTasks("actions", k.firstActions.filter(title => !k.plan.milestones.some(m => m.tasks.some(t => t.title.trim().toLowerCase() === title.trim().toLowerCase()))).map(title => ({ title, description: "First action this week", priority: "high" as const })));
    const step = reviewedStep ?? k.step;
    if (reviewedStep !== undefined || [0, 1, 4].includes(step)) {
      const summary = step === 0 ? k.brainstorm : step === 1 ? Object.entries(k.clarify).map(([key, value]) => `${key}: ${value}`).join("\n\n") : step === 2 ? kickoffMarkdown({ ...k, plan: { milestones: [] }, risks: "", firstActions: ["", "", ""] }) : step === 3 ? k.plan.milestones.map(m => `${m.title}\n${m.outcome}\n${m.tasks.map(t => t.title).join("\n")}`).join("\n\n") : step === 4 ? `Risks\n${k.risks}\n\nFirst actions\n${k.firstActions.join("\n")}` : kickoffMarkdown(k);
      const id = record.handoffIds[String(step)] ?? randomUUID();
      record.handoffIds[String(step)] = id;
      const handoff = { id, projectId: p.id, title: `Kickoff · ${kickoffSteps[step]}`, summary, nextAction: step === 5 ? k.firstActions[0] : `Continue Kickoff: ${kickoffSteps[Math.min(step + 1, 5)]}`, target: "Next session", source: "You · Kickoff", createdAt: now };
      const old = s.handoffs.find(h => h.id === id);
      if (old) Object.assign(old, handoff); else s.handoffs.unshift(handoff);
    }
    record.revision++; record.updatedAt = now;
    record.completed = reviewedStep === 5;
    record.data = { ...k, exportedProjectId: record.completed ? p.id : null };
    p.version++; p.updatedAt = now;
    if (reviewedStep !== undefined) audit(s, actor, `Saved Kickoff: ${kickoffSteps[reviewedStep]}`, k.id, p.id, "kickoff-step");
    return record;
  });
}
