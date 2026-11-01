import { describe, expect, it } from "vitest";
import { newKickoff, checkpointCode, restoreCheckpoint, kickoffExportSchema, stepIssue } from "./kickoff";

describe("Kickoff checkpoints and readiness", () => {
  it.each([0, 1, 2, 3, 4, 5])("file and resume code preserve answers and exact step %i", step => {
    const k = { ...newKickoff(), step, brainstorm: "Café project 🚀", risks: "Limited time" };
    k.clarify.goal = "Build a useful planner";
    k.brief.title = "My draft";
    expect(restoreCheckpoint(JSON.stringify(k))).toEqual(k);
    expect(restoreCheckpoint(checkpointCode(k))).toEqual(k);
  });
  it("restores Unicode answers and the exact paused step from a code", () => {
    const k = { ...newKickoff(), step: 3, brainstorm: "Café project 🚀" };
    expect(restoreCheckpoint(checkpointCode(k))).toEqual(k);
  });
  it("restores a downloaded JSON checkpoint", () => {
    const k = { ...newKickoff(), step: 4, firstActions: ["Ask", "Design", "Test"] as [string, string, string] };
    expect(restoreCheckpoint(JSON.stringify(k))).toEqual(k);
  });
  it("rejects invalid versions and malformed codes", () => {
    expect(() => restoreCheckpoint(JSON.stringify({ ...newKickoff(), version: 2 }))).toThrow();
    expect(() => restoreCheckpoint("RELAY1.garbage")).toThrow();
  });
  it('allows "not sure yet" for each clarify question', () => {
    const k = newKickoff(); k.step = 1;
    for (const key of Object.keys(k.clarify) as (keyof typeof k.clarify)[]) k.clarify[key] = "not sure yet";
    expect(stepIssue(k)).toBeNull();
  });
  it("requires three first actions", () => {
    const k = newKickoff(); k.step = 4; k.risks = "Time"; k.firstActions = ["Ask", "Build", ""];
    expect(stepIssue(k)).not.toBeNull();
  });
  it("blocks export before a completed launch review", () => {
    expect(kickoffExportSchema.safeParse(newKickoff()).success).toBe(false);
  });
});