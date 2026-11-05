import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ops from "./operations";
import { emptyState } from "./store";
import { newKickoff } from "../kickoff";
import { fixtureProject, fixtureTask, memoryWorkspace } from "@/test/phase1-fixtures";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); })); });
afterEach(() => vi.unstubAllGlobals());

describe("Phase 1 approval retries and milestone operations", () => {
  it("repeated Kickoff export returns the same project without duplicate tasks or checkpoints", async () => {
    const db = memoryWorkspace(); const k = newKickoff();
    k.step = 5; k.brief.title = "Synthetic project"; k.brief.goal = "Synthetic goal";
    k.plan.milestones = [{ title: "Launch", outcome: "Ready", tasks: [{ title: "Test", description: "", priority: "medium" }] }];
    k.risks = "Synthetic risk"; k.firstActions = ["Ask", "Sketch", "Test"];
    k.review = { goal: true, scope: true, plan: true, risks: true, ready: true };
    const first = await ops.exportKickoff(db.actor, k);
    expect(await ops.exportKickoff(db.actor, k)).toEqual(first);
    expect(db.state.projects).toHaveLength(1); expect(db.state.tasks).toHaveLength(3); expect(db.state.handoffs).toHaveLength(1);
  });
  it("re-reviewed Kickoff plan preserves task/milestone/checkpoint IDs", async () => {
    const db = memoryWorkspace(); const k = newKickoff(); k.brainstorm = "Synthetic"; k.step = 3;
    k.plan.milestones = [{ title: "Launch", outcome: "Ready", tasks: [{ title: "Test", description: "", priority: "medium" }] }];
    const first = await ops.saveKickoff(db.actor, { kickoff: k, expectedRevision: 0, reviewedStep: 3 });
    const before = db.state;
    await ops.saveKickoff(db.actor, { kickoff: k, expectedRevision: first.revision, reviewedStep: 3 });
    for (const key of ["tasks", "milestones", "handoffs"] as const) expect(db.state[key]?.map(r => r.id)).toEqual(before[key]?.map(r => r.id));
    expect(db.state.tasks[0].milestoneId).toBe(db.state.milestones?.[0]?.id);
  });
  it("repeat import approval refuses a removed draft without duplicating records", async () => {
    const db = memoryWorkspace();
    const draft = await ops.createImportDraft(db.actor, { source: "chatgpt", content: { project: { title: "Synthetic", description: "", goal: "" }, tasks: [{ title: "Test", description: "", priority: "medium" }], ideas: [{ title: "Idea", description: "" }], handoff: null } });
    await ops.approveImport(db.actor, { id: draft.draftId, mode: "new" }); const before = db.state;
    await expect(ops.approveImport(db.actor, { id: draft.draftId, mode: "new" })).rejects.toMatchObject({ status: 404 });
    expect(db.state).toEqual(before); expect(db.state.projects).toHaveLength(1); expect(db.state.tasks).toHaveLength(1); expect(db.state.ideas).toHaveLength(1);
  });
  it("rejects unknown dependencies on create and cycles on edit without a partial save", async () => {
    const s = emptyState(); s.projects = [fixtureProject()]; s.tasks = [fixtureTask("a"), { ...fixtureTask("b"), dependencies: ["a"] }];
    const db = memoryWorkspace(s);
    await expect(ops.addTask(db.actor, { projectId: "p", title: "Invalid", dependencies: ["missing"] })).rejects.toMatchObject({ status: 400 });
    await expect(ops.editTask(db.actor, "a", { expectedVersion: 3, dependencies: ["b"] })).rejects.toMatchObject({ status: 400 });
    expect(db.state).toEqual(s);
  });
  it("milestone edits reject stale versions, and deletion clears assignment while preserving task due date", async () => {
    const s = emptyState(); s.projects = [fixtureProject()]; const db = memoryWorkspace(s);
    const m = await ops.addMilestone(db.actor, { projectId: "p", title: "Synthetic", targetDate: "2026-11-10" });
    await ops.addTask(db.actor, { projectId: "p", title: "Task", milestoneId: m.id, dueDate: "2026-11-09" });
    await ops.editMilestone(db.actor, m.id, { expectedVersion: 1, targetDate: "2026-11-12" });
    await expect(ops.editMilestone(db.actor, m.id, { expectedVersion: 1, title: "Stale" })).rejects.toMatchObject({ status: 409 });
    await ops.removeMilestone(db.actor, m.id);
    expect(db.state.tasks[0]).toMatchObject({ milestoneId: null, dueDate: "2026-11-09" }); expect(db.state.milestones).toHaveLength(0);
  });
  it("deleting one project removes only its milestones and tasks", async () => {
    const s = emptyState(); s.projects = [fixtureProject("p"), fixtureProject("other")]; const db = memoryWorkspace(s);
    await ops.addMilestone(db.actor, { projectId: "p", title: "Remove" });
    const keep = await ops.addMilestone(db.actor, { projectId: "other", title: "Keep" });
    await ops.addTask(db.actor, { projectId: "other", title: "Keep task", milestoneId: keep.id });
    await ops.removeProject(db.actor, "p");
    expect(db.state.milestones?.map(m => m.id)).toEqual([keep.id]); expect(db.state.tasks).toHaveLength(1);
  });
});