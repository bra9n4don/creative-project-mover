import { describe, expect, it } from "vitest";
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
});
