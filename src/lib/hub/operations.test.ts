import { describe, expect, it } from "vitest";
import * as ops from "./operations";
import { emptyState, type Actor, type HubDb, type HubState } from "./store";

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
    await expect(ops.removeProject(agent, p.id)).rejects.toThrow(/owner's approval/);
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
