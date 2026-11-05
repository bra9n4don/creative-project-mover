import { z } from "zod";
import { randomUUID } from "./store";
import { reviewedUpdateSchema } from "./update-draft";
import { kickoffExportSchema, kickoffMarkdown, saveKickoffSchema, mindMapSchema, stepIssue, kickoffSteps, kickoffSizeIssue } from "../kickoff";
import {
  CreateProjectBody, UpdateProjectBody, CreateIdeaBody, UpdateIdeaBody,
  CreateTaskBody, UpdateTaskBody, CreateHandoffBody, DecideApprovalBody,
} from "./api-zod";
import { createImportSchema, approveImportSchema, findMatch, sourceLabels, IMPORT_MAX_TASKS, type ImportDraft, type ImportContent, type GithubLink } from "./imports";
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
const clusterSchema = z.object({ title: z.string().trim().min(1).max(200), outcome: z.string().max(2000), tasks: z.array(z.object({ title: z.string().max(200), description: z.string().max(2000), priority: z.enum(["low", "medium", "high"]) })).max(20) });
/** Mind map cluster -> planning project with its branch tasks, saved in one write. Owner-only, explicit click. */
export function promoteCluster(actor: Actor, input: unknown) {
  requireOwner(actor);
  const c = clusterSchema.parse(input);
  return mutateState(actor, s => {
    const now = new Date().toISOString(), projectId = randomUUID();
    s.projects.unshift({ id: projectId, title: c.title, description: c.outcome, goal: "", status: "planning", priority: "medium", repository: "", color: "teal", version: 1, createdAt: now, updatedAt: now });
    const tasks = c.tasks.filter(t => t.title.trim());
    for (const t of tasks) s.tasks.push({ id: randomUUID(), projectId, title: t.title.trim(), description: t.description, priority: t.priority, status: "todo", agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now });
    audit(s, actor, `Turned mind map cluster into project: ${c.title}`, `${tasks.length} tasks`, projectId, "project");
    return ok(`"${c.title}" is now a project with ${tasks.length} tasks.`, projectId);
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
    if (data.dueDate !== undefined) t.dueDate = data.dueDate;
    s.tasks.push(t); audit(s, actor, `Added next step: ${t.title}`, "", t.projectId, "task");
    return t;
  });
}
/** Track real transitions only; never infer historical dates from creation or edits. */
function applyTaskPatch(t: HubState["tasks"][number], patch: Partial<HubState["tasks"][number]>) {
  const now = new Date().toISOString();
  if (patch.status && patch.status !== t.status) {
    if (patch.status === "in_progress" && !t.startedAt) t.startedAt = now;
    if (["done", "verified"].includes(patch.status)) {
      if (!["done", "verified"].includes(t.status)) t.completedAt = now;
    } else {
      delete t.completedAt;
    }
  }
  Object.assign(t, patch, { version: t.version + 1, updatedAt: now });
}

export function editTask(actor: Actor, id: string, input: unknown) {
  const data = UpdateTaskBody.parse(input);
  return mutateState(actor, s => {
    const t = s.tasks.find(t => t.id === id);
    if (!t) throw new HubError(404, "Task not found");
    checkVersion(t.version, data.expectedVersion);
    if (actor.agent && data.status === "verified") throw new HubError(403, "Only you can verify completion. Agents can report done with evidence.");
    if (data.dependencies) validateDependencies(s, t.projectId, id, data.dependencies);
    if (actor.agent && (data.priority !== undefined || data.title !== undefined || data.description !== undefined || data.dependencies !== undefined || data.dueDate !== undefined)) {
      return queueChange(s, actor, t.projectId, { type: "task", taskId: id, ...data }, `Review proposed changes to task: ${t.title}`);
    }
    const dependencies = data.dependencies ?? t.dependencies;
    if (["in_progress", "done", "verified"].includes(data.status ?? "")) {
      if (dependencies.some(d => !s.tasks.some(dep => dep.id === d && ["done", "verified"].includes(dep.status)))) throw new HubError(409, "Finish the prerequisite tasks first.");
    }
    if (data.status === "verified" && !(data.evidence ?? t.evidence).trim()) throw new HubError(400, "Add supporting evidence before verifying a task.");
    const { expectedVersion: _, ...patch } = data;
    applyTaskPatch(t, patch);
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
    closeTaskApprovals(s, id);
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
        applyTaskPatch(t, patch);
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
    if (s.kickoffs.some(r => r.data.id === k.id)) throw new HubError(409, "This Kickoff already has a project. Complete it in the Kickoff wizard instead.");
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
    const tooLong = kickoffSizeIssue(k); if (tooLong) throw new HubError(400, tooLong);
    s.projects.unshift({ id, title: k.brief.title.trim(), goal: k.brief.goal, description: markdown, status: "planning", priority: "medium", repository: "", color: "teal", version: 1, createdAt: now, updatedAt: now });
    for (const m of k.plan.milestones) for (const t of m.tasks) s.tasks.push({ id: randomUUID(), projectId: id, title: t.title.trim(), description: `${m.title}\n${t.description}`.slice(0, 10000), priority: t.priority, status: "todo", agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now });
    for (const title of k.firstActions) if (!s.tasks.some(t => t.projectId === id && t.title.toLowerCase() === title.trim().toLowerCase())) s.tasks.push({ id: randomUUID(), projectId: id, title: title.trim(), description: "First action this week", priority: "high", status: "todo", agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now });
    s.handoffs.unshift({ id: randomUUID(), projectId: id, title: "Kickoff checkpoint", summary: markdown, nextAction: k.firstActions[0], target: "Next session", source: "You · Kickoff", createdAt: now });
    if (idea) idea.status = "promoted"; // Relay's existing planned-idea status.
    audit(s, actor, "Exported reviewed Kickoff", k.id, id, "kickoff");
    return { projectId: id };
  });
}

/** Draft answers persist immediately; AI-derived live records require an explicit step review. */
const saveMindMapSchema = z.object({ map: mindMapSchema, title: z.string().max(200), expectedRevision: z.number().int().min(0) });
/** Standalone brainstorm map: one per workspace, optimistic revision so two tabs can't overwrite each other. */
export function saveMindMap(actor: Actor, input: unknown) {
  requireOwner(actor);
  const { map, title, expectedRevision } = saveMindMapSchema.parse(input);
  return mutateState(actor, s => {
    const current = s.mindMap?.revision ?? 0;
    if (current !== expectedRevision) throw new HubError(409, "Your mind map changed in another tab. Reload to see the latest version.");
    s.mindMap = { map, title, revision: current + 1, updatedAt: new Date().toISOString() };
    return s.mindMap;
  });
}
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
      s.projects.unshift({ id: projectId, title: idea?.title ?? (k.brainstorm.split("\n").map(l => l.replace(/^[\s#>*-]+|\[(Feature|Risk|Question)\]\s*/g, "").trim()).find(l => l && l !== "Mind map")?.slice(0, 150) || "Untitled Kickoff"), description: k.brainstorm, goal: "", status: "planning", priority: "medium", repository: "", color: "teal", version: 1, createdAt: now, updatedAt: now });
      record = { data: k, projectId, revision: 0, completed: false, updatedAt: now, taskIds: {}, handoffIds: {}, projectVersion: 1 };
      s.kickoffs.push(record);
      if (idea) idea.status = "promoted";
      audit(s, actor, "Started Kickoff project", k.id, projectId, "kickoff-start");
    }
    const p = project(s, record.projectId);
    // Never overwrite project details the owner edited directly after Kickoff last wrote them.
    const untouched = p.version === (record.projectVersion ?? p.version);
    const writeProject = (patch: Partial<typeof p>) => {
      Object.assign(p, patch);
    };
    // Autosave never puts an unreviewed AI brief or plan into live project context.
    if (k.step <= 1 && untouched && (p.description !== k.brainstorm || p.goal !== k.clarify.goal)) writeProject({ description: k.brainstorm, goal: k.clarify.goal });
    if (reviewedStep === 2 || reviewedStep === 5) {
      if (!untouched) throw new HubError(409, "You edited this project directly. Kickoff won't overwrite your changes. Update the project from its page instead.");
      writeProject({ title: k.brief.title.trim(), goal: k.brief.goal,
        description: reviewedStep === 5 ? kickoffMarkdown(k) : kickoffMarkdown({ ...k, plan: { milestones: [] }, risks: "", firstActions: ["", "", ""] }) });
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
        closeTaskApprovals(s, id);
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
    if (untouched) record.projectVersion = p.version;
    if (reviewedStep !== undefined) audit(s, actor, `Saved Kickoff: ${kickoffSteps[reviewedStep]}`, k.id, p.id, "kickoff-step");
    return record;
  });
}

/** Pending proposals for a deleted task can never be approved, so close them out. */
function closeTaskApprovals(s: HubState, taskId: string) {
  for (const a of s.approvals) {
    if (a.status !== "pending") continue;
    try { if (JSON.parse(a.changes).taskId === taskId) a.status = "rejected"; } catch { /* malformed proposal: leave as is */ }
  }
}

// ---------- Imports (chatbots, assistants, GitHub) ----------
const newTask = (projectId: string, t: { title: string; description: string; priority: "low" | "medium" | "high" }, now: string) =>
  ({ id: randomUUID(), projectId, title: t.title.trim(), description: t.description, priority: t.priority, status: "todo" as const, agent: "", evidence: "", dependencies: [], version: 1, createdAt: now, updatedAt: now });

/** Creates a pending draft only; nothing reaches projects/tasks until the owner approves. Agents may call this. */
export function createImportDraft(actor: Actor, input: unknown) {
  const data = createImportSchema.parse(input);
  if (data.repo) validateRepository(data.repo);
  return mutateState(actor, s => {
    s.imports ??= [];
    if (s.imports.length >= 50) throw new HubError(409, "Your import inbox is full. Approve or discard some drafts first.");
    const draft: ImportDraft = { id: randomUUID(), kind: "new", source: data.source, sourceDetail: data.sourceDetail || (actor.agent ? actor.source : ""), keepSynced: !!data.repo && data.keepSynced,
      matchProjectId: findMatch(s.projects, data.content.project.title, data.repo), content: data.content, createdAt: new Date().toISOString(),
      ...(data.repo ? { repo: data.repo } : {}), ...(data.trimmed ? { trimmed: true } : {}) };
    s.imports.unshift(draft);
    audit(s, actor, `Import draft ready to review: ${data.content.project.title}`, "Nothing is saved until you approve it.", "", "import");
    return { ...ok("Saved to the CarterHub import inbox for the owner to review. Nothing was added to projects yet.", draft.id), draftId: draft.id };
  });
}

export function discardImport(actor: Actor, id: string) {
  requireOwner(actor);
  return mutateState(actor, s => {
    const d = (s.imports ?? []).find(i => i.id === id);
    if (!d) throw new HubError(404, "Import draft not found");
    s.imports = (s.imports ?? []).filter(i => i.id !== id);
    audit(s, actor, `Discarded import: ${d.content.project.title}`, "", d.targetProjectId ?? "", "import");
    return ok("Import discarded.");
  });
}

/** Owner approval saves the reviewed draft (create or merge) and its audit event in one write. */
export function approveImport(actor: Actor, input: unknown) {
  requireOwner(actor);
  const data = approveImportSchema.parse(input);
  return mutateState(actor, s => {
    const d = (s.imports ?? []).find(i => i.id === data.id);
    if (!d) throw new HubError(404, "Import draft not found");
    const now = new Date().toISOString();
    const content = data.content ?? d.content;
    if (d.kind === "sync") return applySync(s, actor, d, content, now);
    let p: HubState["projects"][number];
    if (data.mode === "merge") {
      if (!data.targetProjectId) throw new HubError(400, "Choose the project to merge into.");
      p = project(s, data.targetProjectId);
      if (d.repo && !p.repository) p.repository = d.repo;
      p.version++; p.updatedAt = now;
    } else {
      p = { id: randomUUID(), title: content.project.title.trim(), description: content.project.description, goal: content.project.goal, status: "planning", priority: "medium", repository: d.repo ?? "", color: "teal", version: 1, createdAt: now, updatedAt: now };
      s.projects.unshift(p);
    }
    const existing = new Set(s.tasks.filter(t => t.projectId === p.id).map(t => t.title.toLowerCase()));
    const link = d.repo && (data.keepSynced ?? d.keepSynced) ? upsertLink(s, p.id, d.repo, now) : null;
    let added = 0;
    for (const t of content.tasks) {
      if (existing.has(t.title.trim().toLowerCase())) continue;
      const task = newTask(p.id, t, now); s.tasks.push(task); added++;
      if (link && t.issueNumber !== undefined) link.issues[String(t.issueNumber)] = { taskId: task.id, version: 1, title: task.title };
    }
    for (const i of content.ideas) s.ideas.unshift({ id: randomUUID(), title: i.title.trim(), description: i.description, status: "inbox", tags: ["imported"], source: sourceLabels[d.source], createdAt: now });
    if (content.handoff) s.handoffs.unshift({ ...content.handoff, id: randomUUID(), projectId: p.id, source: `You · Imported from ${sourceLabels[d.source]}`, createdAt: now });
    s.imports = (s.imports ?? []).filter(i => i.id !== d.id);
    audit(s, actor, `${data.mode === "merge" ? "Merged import into" : "Imported project"}: ${p.title}`, `${added} tasks, ${content.ideas.length} ideas from ${sourceLabels[d.source]}${link ? " · GitHub sync on" : ""}`, p.id, "import");
    return ok(data.mode === "merge" ? `Merged into ${p.title}.` : `${p.title} imported.`, p.id);
  });
}

function upsertLink(s: HubState, projectId: string, repo: string, now: string) {
  s.githubLinks ??= [];
  let link = s.githubLinks.find(l => l.projectId === projectId);
  if (!link) { link = { projectId, repo, lastSyncedAt: now, issues: {} }; s.githubLinks.push(link); }
  link.repo = repo;
  return link;
}

/** Sync suggestions never overwrite a task the owner changed since CarterHub last wrote it. */
function applySync(s: HubState, actor: Actor, d: ImportDraft, content: ImportContent, now: string) {
  const p = project(s, d.targetProjectId ?? "");
  const link = s.githubLinks?.find(l => l.projectId === p.id);
  if (!link) throw new HubError(409, "This project is no longer linked to GitHub.");
  let added = 0, closed = 0, renamed = 0, skipped = 0;
  for (const t of content.tasks) {
    if (t.issueNumber !== undefined && link.issues[String(t.issueNumber)]) continue;
    const task = newTask(p.id, t, now); s.tasks.push(task); added++;
    if (t.issueNumber !== undefined) link.issues[String(t.issueNumber)] = { taskId: task.id, version: 1, title: task.title };
  }
  for (const c of d.changes?.close ?? []) {
    const t = s.tasks.find(x => x.id === c.taskId), m = link.issues[String(c.issueNumber)];
    if (!t || !m || t.version !== m.version) { skipped++; continue; }
    applyTaskPatch(t, { status: "done", evidence: t.evidence || `GitHub issue #${c.issueNumber} was closed.` }); m.version = t.version; closed++;
  }
  for (const r of d.changes?.rename ?? []) {
    const t = s.tasks.find(x => x.id === r.taskId), m = link.issues[String(r.issueNumber)];
    if (!t || !m || t.version !== m.version) { skipped++; continue; }
    applyTaskPatch(t, { title: r.title }); m.version = t.version; m.title = r.title; renamed++;
  }
  s.imports = (s.imports ?? []).filter(i => i.id !== d.id);
  audit(s, actor, `Applied GitHub changes: ${p.title}`, `${added} new, ${closed} closed, ${renamed} renamed${skipped ? `, ${skipped} skipped because you edited them` : ""}`, p.id, "sync");
  return ok(`Applied GitHub changes to ${p.title}.${skipped ? ` ${skipped} skipped because you edited those tasks.` : ""}`, p.id);
}

export function unlinkRepo(actor: Actor, projectId: string) {
  requireOwner(actor);
  return mutateState(actor, s => {
    const p = project(s, projectId);
    s.githubLinks = (s.githubLinks ?? []).filter(l => l.projectId !== projectId);
    s.imports = (s.imports ?? []).filter(i => !(i.kind === "sync" && i.targetProjectId === projectId));
    audit(s, actor, `Stopped GitHub issue sync: ${p.title}`, "", projectId, "sync");
    return ok("GitHub issue sync turned off for this project.");
  });
}

export type IssueSnapshot = { number: number; title: string; body: string; open: boolean };
/** Pure diff for the hourly sync: replaces any earlier pending suggestion for the project. */
export function queueSyncSuggestions(s: HubState, link: GithubLink, issues: IssueSnapshot[], now: string) {
  const p = s.projects.find(x => x.id === link.projectId);
  if (!p) return false;
  const tasks = issues.filter(i => i.open && !link.issues[String(i.number)]).slice(0, IMPORT_MAX_TASKS)
    .map(i => ({ title: i.title.slice(0, 200), description: `GitHub issue #${i.number}\n${i.body}`.slice(0, 4000), priority: "medium" as const, issueNumber: i.number }));
  const close: NonNullable<ImportDraft["changes"]>["close"] = [], rename: NonNullable<ImportDraft["changes"]>["rename"] = [];
  for (const i of issues) {
    const m = link.issues[String(i.number)]; if (!m) continue;
    const t = s.tasks.find(x => x.id === m.taskId); if (!t) continue;
    if (!i.open && !["done", "verified"].includes(t.status)) close.push({ taskId: t.id, title: t.title, issueNumber: i.number });
    else if (i.title.slice(0, 200) !== m.title) rename.push({ taskId: t.id, from: m.title, title: i.title.slice(0, 200), issueNumber: i.number });
  }
  link.lastSyncedAt = now;
  s.imports = (s.imports ?? []).filter(d => !(d.kind === "sync" && d.targetProjectId === p.id));
  if (!tasks.length && !close.length && !rename.length) return false;
  s.imports.unshift({ id: randomUUID(), kind: "sync", source: "github", sourceDetail: link.repo, repo: link.repo, keepSynced: true, matchProjectId: p.id, targetProjectId: p.id,
    content: { project: { title: p.title, description: "", goal: "" }, tasks, ideas: [], handoff: null }, changes: { close: close.slice(0, 100), rename: rename.slice(0, 100) }, createdAt: now });
  return true;
}
