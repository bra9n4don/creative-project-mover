import { describe, expect, it } from "vitest";
import { buildResumeContext } from "./context";
import { emptyState } from "./store";
import { fixtureProject, fixtureTask } from "@/test/phase1-fixtures";

describe("Phase 1 assistant context compatibility", () => {
  it("is stable for equal timestamps, honors explicit focus, and leaves input untouched", () => {
    const s = emptyState(); s.projects = [fixtureProject("first"), fixtureProject("second")];
    const before = structuredClone(s);
    expect(buildResumeContext(s).focus?.project.id).toBe("first");
    expect(buildResumeContext(s)).toEqual(buildResumeContext(s));
    expect(buildResumeContext(s, "second").focus?.project.id).toBe("second");
    expect(buildResumeContext(s, "missing").focus).toBeNull();
    expect(s).toEqual(before);
  });
  it("handles an empty workspace and missing checkpoints honestly", () => {
    expect(buildResumeContext(emptyState())).toMatchObject({ focus: null, otherProjectCount: 0, otherProjects: [], ideas: [] });
    const s = emptyState(); s.projects = [fixtureProject()];
    s.tasks = [{ ...fixtureTask("blocked"), dependencies: ["missing"] }, fixtureTask("ready")];
    expect(buildResumeContext(s).focus).toMatchObject({ checkpoint: null, whereYouLeftOff: "No checkpoint saved yet.", nextAction: "ready" });
  });
  it("preserves IDs, versions, dependencies and milestone links while clipping details", () => {
    const s = emptyState(); s.projects = [fixtureProject()];
    s.tasks = [{ ...fixtureTask(), description: "d".repeat(301), dependencies: ["missing"], milestoneId: "m" }];
    s.milestones = [{ id: "m", projectId: "p", title: "m".repeat(121), outcome: "", order: 0, version: 9, createdAt: "", updatedAt: "" }];
    expect(buildResumeContext(s).focus?.openTasks[0]).toMatchObject({ id: "t", version: 3, dependencies: ["missing"], milestoneId: "m", description: "d".repeat(300) + "…" });
    expect(buildResumeContext(s).focus?.milestones[0]).toMatchObject({ id: "m", version: 9, title: "m".repeat(120) + "…", progress: "0/1" });
  });
  it("omits notes, evidence, connection tokens, and non-focus task details", () => {
    const s = emptyState(); s.projects = [fixtureProject("p"), fixtureProject("other", "2026-01-01")];
    s.tasks = [{ ...fixtureTask(), notes: "PRIVATE_NOTE_SENTINEL", evidence: "PRIVATE_EVIDENCE_SENTINEL" }, { ...fixtureTask("foreign", "other"), description: "OTHER_DETAIL_SENTINEL" }];
    s.connections[0].tokenPrefix = "TOKEN_SENTINEL";
    const serialized = JSON.stringify(buildResumeContext(s));
    for (const sentinel of ["PRIVATE_NOTE_SENTINEL", "PRIVATE_EVIDENCE_SENTINEL", "OTHER_DETAIL_SENTINEL", "TOKEN_SENTINEL"]) expect(serialized).not.toContain(sentinel);
  });
  it("retains only the last fifteen finished titles, clipped at 120 characters", () => {
    const s = emptyState(); s.projects = [fixtureProject()];
    s.tasks = Array.from({ length: 20 }, (_, i) => ({ ...fixtureTask(`finished-${i}`), status: i % 2 ? "done" : "verified", title: `${i}:` + "x".repeat(140) }));
    const c = buildResumeContext(s).focus;
    expect(c?.finishedTaskCount).toBe(20); expect(c?.finishedTaskTitles).toHaveLength(15);
    expect(c?.finishedTaskTitles[0]?.startsWith("5:")).toBe(true);
    expect(c?.finishedTaskTitles.every(t => t.length === 121)).toBe(true);
  });
  it.each([1, 10, 25, 100])("records a chars/4 baseline for %i synthetic tasks", n => {
    const s = emptyState(); s.projects = [fixtureProject()];
    s.tasks = Array.from({ length: n }, (_, i) => ({ ...fixtureTask(`t-${String(i).padStart(3, "0")}`), description: "x".repeat(400) }));
    const c = buildResumeContext(s);
    const chars = JSON.stringify(c).length;
    console.info(`PHASE1_CONTEXT_BASELINE tasks=${n} chars=${chars} roughTokens=${Math.ceil(chars / 4)}`);
    expect(c.focus?.openTaskCount).toBe(n); expect(c.focus?.openTasks).toHaveLength(Math.min(n, 25));
    const capped = structuredClone(s); capped.tasks = capped.tasks.slice(0, 25);
    if (n === 100) expect(chars - JSON.stringify(buildResumeContext(capped)).length).toBe(1);
    expect(chars).toBeGreaterThan(400); expect(chars).toBeLessThan(16000);
  });
});