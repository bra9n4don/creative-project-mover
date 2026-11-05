import { describe, expect, it, vi } from "vitest";
import * as ops from "./operations";
import { emptyState, type Actor, type HubDb, type HubState } from "./store";
import { newKickoff } from "../kickoff";

// In-memory stand-in for the hub_workspaces table, enough for mutateState's read + revision-checked write.
function fakeDb() {
  let row: { data: HubState; rev: number } | null = null;
  const db = {
    from: () => {
      const q: Record<string, unknown> = {};
      let mode: "select" | "update" = "select";
      let patch: { data: HubState; rev: number } | null = null;
      let revFilter: number | null = null;
      Object.assign(q, {
        select: () => q,
        eq: (col: string, v: unknown) => { if (col === "rev") revFilter = v as number; return q; },
        maybeSingle: async () => ({ data: row ? structuredClone(row) : null, error: null }),
        insert: async (v: { data: HubState; rev: number }) => { row = structuredClone({ data: v.data, rev: v.rev }); return { error: null }; },
        update: (v: { data: HubState; rev: number }) => { mode = "update"; patch = v; return q; },
        then: (res: (v: unknown) => void) => {
          if (mode === "update" && row && patch && revFilter === row.rev) { row = structuredClone({ data: patch.data, rev: patch.rev }); return res({ data: [{}], error: null }); }
          return res({ data: [], error: null });
        },
      });
      return q;
    },
    get state() { return row?.data ?? emptyState(); },
  };
  return db;
}

describe("guarded automation rules", () => {
  const setup = () => {
    const db = fakeDb();
    const owner: Actor = { ownerId: "o", source: "You", agent: false, db: db as unknown as HubDb };
    const agent: Actor = { ...owner, source: "Claude Code", agent: true };
    return { db, owner, agent };
  };

  it("persists optional due dates and lets the owner update or clear them without changing actual dates", async () => {
    const { db, owner } = setup();
    const p = await ops.addProject(owner, { title: "Due dates" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Ship", dueDate: "2026-11-12" });
    expect(t.dueDate).toBe("2026-11-12");
    await ops.editTask(owner, t.id, { expectedVersion: 1, dueDate: "2026-11-15" });
    expect(db.state.tasks[0]?.dueDate).toBe("2026-11-15");
    expect(db.state.tasks[0]?.startedAt).toBeUndefined();
    expect(db.state.tasks[0]?.completedAt).toBeUndefined();
    await ops.editTask(owner, t.id, { expectedVersion: 2, dueDate: null });
    expect(db.state.tasks[0]?.dueDate).toBeNull();
  });

  it("rejects impossible due dates", async () => {
    const { owner } = setup();
    const p = await ops.addProject(owner, { title: "Dates" });
    expect(() => ops.addTask(owner, { projectId: p.id, title: "Ship", dueDate: "2026-02-30" })).toThrow();
  });

  it("saves owner notes and queues assistant note changes for review", async () => {
    const { db, owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Notes" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Ship" });
    await ops.editTask(owner, t.id, { expectedVersion: 1, notes: "Waiting on API key" });
    expect(db.state.tasks[0]?.notes).toBe("Waiting on API key");
    await ops.editTask(agent, t.id, { expectedVersion: 2, notes: "Overwritten" });
    expect(db.state.tasks[0]?.notes).toBe("Waiting on API key");
    expect(db.state.approvals).toHaveLength(1);
  });

  it("saves owner checklists and queues assistant checklist changes", async () => {
    const { db, owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Checklist" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Ship" });
    await ops.editTask(owner, t.id, { expectedVersion: 1, checklist: [{ id: "a", text: "Write tests", done: true }] });
    expect(db.state.tasks[0]?.checklist).toEqual([{ id: "a", text: "Write tests", done: true }]);
    await ops.editTask(agent, t.id, { expectedVersion: 2, checklist: [] });
    expect(db.state.tasks[0]?.checklist).toHaveLength(1);
  });

  it("requires review of assistant due-date changes", async () => {
    const { db, owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Dates" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Ship" });
    await ops.editTask(agent, t.id, { expectedVersion: 1, dueDate: "2026-11-15" });
    expect(db.state.tasks[0]?.dueDate).toBeUndefined();
    const approval = db.state.approvals[0];
    if (!approval) throw new Error("Missing approval");
    await ops.decide(owner, approval.id, { decision: "approved" });
    expect(db.state.tasks[0]?.dueDate).toBe("2026-11-15");
  });

  it("records actual start and end on status transitions and preserves dates during verification", async () => {
    const { db, owner } = setup();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
      const p = await ops.addProject(owner, { title: "Timeline" });
      const t = await ops.addTask(owner, { projectId: p.id, title: "Work" });
      expect(t.startedAt).toBeUndefined();
      expect(t.completedAt).toBeUndefined();
      await ops.editTask(owner, t.id, { expectedVersion: 1, status: "in_progress" });
      expect(db.state.tasks[0]?.startedAt).toBe("2026-11-05T12:00:00.000Z");
      vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
      await ops.editTask(owner, t.id, { expectedVersion: 2, status: "done" });
      expect(db.state.tasks[0]?.completedAt).toBe("2026-11-06T12:00:00.000Z");
      vi.setSystemTime(new Date("2026-11-07T12:00:00Z"));
      await ops.editTask(owner, t.id, { expectedVersion: 3, status: "verified", evidence: "Checked" });
      expect(db.state.tasks[0]).toMatchObject({ startedAt: "2026-11-05T12:00:00.000Z", completedAt: "2026-11-06T12:00:00.000Z" });
      await ops.editTask(owner, t.id, { expectedVersion: 4, status: "in_progress" });
      expect(db.state.tasks[0]?.completedAt).toBeUndefined();
      expect(db.state.tasks[0]?.startedAt).toBe("2026-11-05T12:00:00.000Z");
    } finally { vi.useRealTimers(); }
  });

  it("does not invent a start date when work is reported done directly", async () => {
    const { db, owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Timeline" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Work" });
    await ops.editTask(agent, t.id, { expectedVersion: 1, status: "done" });
    expect(db.state.tasks[0]?.startedAt).toBeUndefined();
    expect(db.state.tasks[0]?.completedAt).toBeDefined();
    const end = db.state.tasks[0]?.completedAt;
    await ops.editTask(owner, t.id, { expectedVersion: 2, description: "Edited later" });
    expect(db.state.tasks[0]?.completedAt).toBe(end);
  });

  it("records actual dates only after a proposed status change is approved", async () => {
    const { db, owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Timeline" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Work" });
    await ops.editTask(agent, t.id, { expectedVersion: 1, title: "New title", status: "in_progress" });
    expect(db.state.tasks[0]?.startedAt).toBeUndefined();
    const approval = db.state.approvals[0];
    if (!approval) throw new Error("Missing approval");
    await ops.decide(owner, approval.id, { decision: "approved" });
    expect(db.state.tasks[0]?.startedAt).toBeDefined();
  });

  it("Kickoff export creates a project, tasks and checkpoint and plans its source idea atomically", async () => {
    const { db, owner } = setup();
    const idea = await ops.addIdea(owner, { title: "Recipe scaler" });
    const k = newKickoff();
    k.step = 5; k.sourceIdeaId = idea.id; k.brief.title = "Recipe scaler"; k.brief.goal = "Scale portions";
    k.plan.milestones = [{ title: "Working form", outcome: "Scale a recipe", tasks: [{ title: "Test calculations", description: "Double a recipe", priority: "medium" }] }];
    k.risks = "Limited time"; k.firstActions = ["Ask three cooks", "Sketch the form", "Test calculations"];
    k.review = { goal: true, scope: true, plan: true, risks: true, ready: true };
    const result = await ops.exportKickoff(owner, k);
    expect(db.state.projects[0]).toMatchObject({ id: result.projectId, title: "Recipe scaler", goal: "Scale portions" });
    expect(db.state.tasks).toHaveLength(3);
    expect(db.state.tasks.every(t => t.status === "todo" && t.projectId === result.projectId)).toBe(true);
    expect(db.state.handoffs[0]).toMatchObject({ projectId: result.projectId, nextAction: "Ask three cooks" });
    expect(db.state.ideas[0]?.status).toBe("promoted");
    await ops.exportKickoff(owner, k);
    expect(db.state.projects).toHaveLength(1);
    expect(db.state.handoffs).toHaveLength(1);
  });

  it("Kickoff export rejects an incomplete review without saving anything", () => {
    const { db, owner } = setup();
    expect(() => ops.exportKickoff(owner, newKickoff())).toThrow();
    expect(db.state.projects).toHaveLength(0);
  });

  it("autosaves unfinished answers and the exact step into one real project and handoff", async () => {
    const { db, owner } = setup();
    const k = newKickoff(); k.brainstorm = "Recipe scaler";
    const first = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: 0 });
    k.step = 1; k.clarify.goal = "Scale portions";
    const second = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: first.revision });
    expect(db.state.projects).toHaveLength(1);
    expect(db.state.projects[0]).toMatchObject({ id: second.projectId, goal: "Scale portions" });
    expect(db.state.kickoffs[0]?.data).toMatchObject({ step: 1, clarify: { goal: "Scale portions" } });
    expect(db.state.handoffs.some(h => h.projectId === second.projectId && h.summary.includes("Scale portions"))).toBe(true);
    await ops.saveKickoff(owner, { kickoff: k, expectedRevision: second.revision });
    expect(db.state.handoffs).toHaveLength(2);
  });

  it("autosaved AI drafts do not become live tasks or handoff notes before review", async () => {
    const { db, owner } = setup();
    const k = newKickoff(); k.brainstorm = "Recipe scaler"; k.step = 3;
    k.plan.milestones = [{ title: "Form", outcome: "Working form", tasks: [{ title: "Test calculations", description: "Double portions", priority: "high" }] }];
    const saved = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: 0 });
    expect(db.state.tasks).toHaveLength(0); expect(db.state.handoffs).toHaveLength(0);
    expect(db.state.kickoffs[0]?.data.plan.milestones[0]?.tasks[0]?.title).toBe("Test calculations");
    const reviewed = await ops.saveKickoff(owner, { kickoff: { ...k, step: 4 }, expectedRevision: saved.revision, reviewedStep: 3 });
    expect(db.state.tasks[0]).toMatchObject({ title: "Test calculations", projectId: saved.projectId, status: "todo" });
    expect(db.state.handoffs).toHaveLength(1);
    await ops.saveKickoff(owner, { kickoff: k, expectedRevision: reviewed.revision, reviewedStep: 3 });
    expect(db.state.tasks).toHaveLength(1); expect(db.state.handoffs).toHaveLength(1);
  });

  it("finishes launch review in the autosaved project without duplicate tasks", async () => {
    const { db, owner } = setup();
    const k = newKickoff(); k.brainstorm = "Recipe scaler"; k.brief.title = "Recipe scaler"; k.brief.goal = "Scale portions"; k.step = 3;
    k.plan.milestones = [{ title: "Form", outcome: "Working", tasks: [{ title: "Test calculations", description: "Double", priority: "medium" }] }];
    const a = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: 0, reviewedStep: 3 });
    k.step = 5; k.risks = "Limited time"; k.firstActions = ["Ask cooks", "Sketch form", "Test calculations"];
    k.review = { goal: true, scope: true, plan: true, risks: true, ready: true };
    const done = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: a.revision, reviewedStep: 5 });
    expect(done.projectId).toBe(a.projectId); expect(done.completed).toBe(true);
    expect(db.state.projects).toHaveLength(1); expect(db.state.tasks).toHaveLength(3);
    expect(db.state.handoffs.find(h => h.title.includes("Launch"))?.nextAction).toBe("Ask cooks");
  });

  it("rejects stale autosaves without overwriting the latest answers", async () => {
    const { db, owner } = setup(); const k = newKickoff(); k.brainstorm = "Original";
    await ops.saveKickoff(owner, { kickoff: k, expectedRevision: 0 });
    await expect(ops.saveKickoff(owner, { kickoff: { ...k, brainstorm: "Stale" }, expectedRevision: 0 })).rejects.toThrow(/another tab/);
    expect(db.state.kickoffs[0]?.data.brainstorm).toBe("Original");
  });

  it("agents cannot autosave Kickoff drafts", () => {
    const { agent } = setup();
    expect(() => ops.saveKickoff(agent, { kickoff: newKickoff(), expectedRevision: 0 })).toThrow(/owner.s approval/);
  });

  it("an incomplete launch review cannot complete a saved project", async () => {
    const { db, owner } = setup(); const k = newKickoff(); k.brainstorm = "Draft";
    const saved = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: 0 });
    expect(() => ops.saveKickoff(owner, { kickoff: { ...k, step: 5 }, expectedRevision: saved.revision, reviewedStep: 5 })).toThrow();
    expect(db.state.kickoffs[0]?.completed).toBe(false); expect(db.state.tasks).toHaveLength(0);
  });

  it("agents cannot export Kickoff projects", () => {
    const { agent } = setup();
    expect(() => ops.exportKickoff(agent, newKickoff())).toThrow(/owner.s approval/);
  });

  it("pasted update suggestions cannot save before owner review", async () => {
    const { db, owner } = setup();
    const p = await ops.addProject(owner, { title: "Site" });
    expect(() => ops.saveReviewedUpdate(owner, { projectId: p.id, reviewed: false, tasks: [{ title: "Test login", description: "Check success", priority: "high" }], handoff: null })).toThrow();
    expect(db.state.tasks).toHaveLength(0);
  });

  it("reviewed tasks and handoff save together as unverified todo tasks", async () => {
    const { db, owner } = setup();
    const p = await ops.addProject(owner, { title: "Site" });
    await ops.saveReviewedUpdate(owner, { projectId: p.id, reviewed: true, tasks: [{ title: "Test login", description: "Check success", priority: "high" }], handoff: { title: "Login update", summary: "Login built", nextAction: "Test login", target: "Next session" } });
    expect(db.state.tasks[0]).toMatchObject({ title: "Test login", status: "todo", evidence: "", projectId: p.id });
    expect(db.state.handoffs[0]).toMatchObject({ summary: "Login built", nextAction: "Test login", projectId: p.id });
  });

  it("agents cannot save owner-reviewed AI drafts", () => {
    const { agent } = setup();
    expect(() => ops.saveReviewedUpdate(agent, {})).toThrow(/owner.s approval/);
  });

  it("agents cannot mark a task verified", async () => {
    const { owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Site" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Ship" });
    await expect(ops.editTask(agent, t.id, { expectedVersion: 1, status: "verified", evidence: "x" })).rejects.toThrow(/Only you can verify/);
  });

  it("agent project edits go to the approval inbox instead of applying", async () => {
    const { db, owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Site", goal: "old" });
    const r = await ops.editProject(agent, p.id, { expectedVersion: 1, goal: "new" });
    expect(r).toMatchObject({ approvalRequired: true });
    expect(db.state.projects[0]!.goal).toBe("old");
    expect(db.state.approvals[0]!.status).toBe("pending");
  });

  it("agents cannot delete projects", async () => {
    const { owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Site" });
    expect(() => ops.removeProject(agent, p.id)).toThrow(/owner.s approval/);
  });

  it("a task cannot start before its prerequisites are done", async () => {
    const { owner } = setup();
    const p = await ops.addProject(owner, { title: "Site" });
    const a = await ops.addTask(owner, { projectId: p.id, title: "A" });
    const b = await ops.addTask(owner, { projectId: p.id, title: "B", dependencies: [a.id] });
    await expect(ops.editTask(owner, b.id, { expectedVersion: 1, status: "in_progress" })).rejects.toThrow(/prerequisite/);
  });

  it("stale versions are rejected instead of overwriting", async () => {
    const { owner } = setup();
    const p = await ops.addProject(owner, { title: "Site" });
    await ops.editProject(owner, p.id, { expectedVersion: 1, goal: "v2" });
    await expect(ops.editProject(owner, p.id, { expectedVersion: 1, goal: "v3" })).rejects.toThrow(/changed/);
  });
});

describe("promoteCluster", () => {
  const mk = () => { const db = fakeDb(); const owner: Actor = { ownerId: "o", source: "You", agent: false, db: db as unknown as HubDb }; return { db, owner }; };
  it("creates one planning project titled by the cluster with its named tasks", async () => {
    const { db, owner } = mk();
    await ops.promoteCluster(owner, { title: "Onboarding", outcome: "Risk: spam", tasks: [{ title: "Sign up", description: "", priority: "high" }, { title: "", description: "", priority: "medium" }] });
    expect(db.state.projects).toHaveLength(1);
    expect(db.state.projects[0]!.title).toBe("Onboarding");
    expect(db.state.projects[0]!.status).toBe("planning");
    expect(db.state.tasks.map(t => t.title)).toEqual(["Sign up"]);
  });
  it("is owner-only", async () => {
    const { owner } = mk();
    await expect(async () => ops.promoteCluster({ ...owner, agent: true }, { title: "X", outcome: "", tasks: [] })).rejects.toThrow("owner");
  });

  const setup = () => {
    const db = fakeDb();
    const owner: Actor = { ownerId: "o", source: "You", agent: false, db: db as unknown as HubDb };
    return { db, owner, agent: { ...owner, source: "Claude Code", agent: true } as Actor };
  };
  it("deleting a task closes its pending assistant proposals", async () => {
    const { db, owner, agent } = setup();
    const p = await ops.addProject(owner, { title: "Site" }) as { id: string };
    const projectId = p.id ?? db.state.projects[0]!.id;
    await ops.addTask(owner, { projectId, title: "Write copy" });
    const t = db.state.tasks[0]!;
    await ops.editTask(agent, t.id, { title: "Write better copy", expectedVersion: t.version });
    expect(db.state.approvals[0]?.status).toBe("pending");
    await ops.removeTask(owner, t.id);
    expect(db.state.approvals[0]?.status).toBe("rejected");
  });

  it("Kickoff never overwrites project details the owner edited directly", async () => {
    const { db, owner } = setup();
    const k = newKickoff(); k.brainstorm = "Recipe scaler";
    const first = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: 0 });
    const proj = db.state.projects[0]!;
    await ops.editProject(owner, proj.id, { description: "My own notes", expectedVersion: proj.version });
    k.brainstorm = "Recipe scaler v2";
    await ops.saveKickoff(owner, { kickoff: k, expectedRevision: first.revision });
    expect(db.state.projects[0]?.description).toBe("My own notes");
  });
});

describe("roadmap milestones", () => {
  const setup = () => {
    const db = fakeDb();
    const owner: Actor = { ownerId: "o", source: "You", agent: false, db: db as unknown as HubDb };
    return { db, owner };
  };
  it("deleting a milestone keeps its tasks, now unassigned", async () => {
    const { db, owner } = setup();
    const p = await ops.addProject(owner, { title: "App" });
    const m = await ops.addMilestone(owner, { projectId: p.id, title: "Beta" });
    const t = await ops.addTask(owner, { projectId: p.id, title: "Ship", milestoneId: m.id });
    expect(db.state.tasks[0]?.milestoneId).toBe(m.id);
    await ops.removeMilestone(owner, m.id);
    expect(db.state.milestones).toHaveLength(0);
    expect(db.state.tasks.find(x => x.id === t.id)?.milestoneId).toBeNull();
  });
  it("rejects a milestone from another project", async () => {
    const { owner } = setup();
    const a = await ops.addProject(owner, { title: "A" }), b = await ops.addProject(owner, { title: "B" });
    const m = await ops.addMilestone(owner, { projectId: a.id, title: "Beta" });
    await expect(ops.addTask(owner, { projectId: b.id, title: "X", milestoneId: m.id })).rejects.toThrow("Milestone not found");
  });
  it("Kickoff plan review creates one milestone per plan milestone, without duplicates on re-review", async () => {
    const { db, owner } = setup();
    const k = newKickoff(); k.brainstorm = "Recipe scaler"; k.step = 3;
    k.plan.milestones = [{ title: "Form", outcome: "Working form", tasks: [{ title: "Test calculations", description: "Double", priority: "high" }] }, { title: "Share", outcome: "Send", tasks: [{ title: "Send link", description: "To partner", priority: "low" }] }];
    const saved = await ops.saveKickoff(owner, { kickoff: k, expectedRevision: 0 });
    const r = await ops.saveKickoff(owner, { kickoff: { ...k, step: 4 }, expectedRevision: saved.revision, reviewedStep: 3 });
    expect(db.state.milestones?.map(m => m.title)).toEqual(["Form", "Share"]);
    expect(db.state.tasks[0]?.milestoneId).toBe(db.state.milestones?.[0]?.id);
    await ops.saveKickoff(owner, { kickoff: k, expectedRevision: r.revision, reviewedStep: 3 });
    expect(db.state.milestones).toHaveLength(2);
  });
});
