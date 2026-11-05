import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyState, mutateState, validateDependencies } from "./store";
import { fixtureTask, memoryWorkspace } from "@/test/phase1-fixtures";

const backup = vi.hoisted(() => vi.fn());
vi.mock("./backup.server", () => ({ pushBackup: backup }));
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); })); backup.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Phase 1 dependency traversal", () => {
  it.each(["unknown", "foreign", "nested unknown", "nested foreign", "self", "cycle"])("rejects %s dependencies", kind => {
    const s = emptyState();
    const a = fixtureTask("a"), b = fixtureTask("b"), foreign = fixtureTask("foreign", "other");
    s.tasks = [a, b, foreign];
    let deps = [kind === "foreign" ? "foreign" : "unknown"];
    if (kind.startsWith("nested")) { a.dependencies = [kind === "nested foreign" ? "foreign" : "unknown"]; deps = ["a"]; }
    if (kind === "self") deps = ["new"];
    if (kind === "cycle") { a.dependencies = ["b"]; b.dependencies = ["a"]; deps = ["a"]; }
    const before = structuredClone(s);
    expect(() => validateDependencies(s, "p", "new", deps)).toThrow(kind === "self" || kind === "cycle" ? /cycles/ : /same project/);
    expect(s).toEqual(before);
  });
  it("accepts empty dependencies and shared acyclic branches without mutation", () => {
    const s = emptyState();
    s.tasks = [fixtureTask("a"), fixtureTask("b"), fixtureTask("c")];
    s.tasks[0].dependencies = ["c"]; s.tasks[1].dependencies = ["c"];
    expect(() => validateDependencies(s, "p", "new", [])).not.toThrow();
    expect(() => validateDependencies(s, "p", "new", ["a", "b"])).not.toThrow();
  });
});

describe("Phase 1 mocked workspace save", () => {
  it("a rejected backup does not undo committed data", async () => {
    vi.stubEnv("VITEST", ""); vi.stubEnv("LOVABLE_API_KEY", "synthetic-only"); vi.stubEnv("GITHUB_API_KEY", "synthetic-only");
    backup.mockRejectedValue(new Error("Synthetic backup failure"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = memoryWorkspace();
    await expect(mutateState(db.actor, s => { s.tasks.push(fixtureTask()); return "saved"; })).resolves.toBe("saved");
    expect(db.state.tasks.map(t => t.id)).toEqual(["t"]);
    expect(backup).toHaveBeenCalledOnce(); expect(logged).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("optimistic retries do not duplicate logical records", async () => {
    const db = memoryWorkspace(emptyState(), 2);
    await mutateState(db.actor, s => { s.tasks.push(fixtureTask()); });
    expect(db.update).toHaveBeenCalledTimes(3); expect(db.state.tasks).toHaveLength(1);
  });
  it("exhausted conflicts refuse the write after five attempts", async () => {
    const db = memoryWorkspace(emptyState(), 5);
    await expect(mutateState(db.actor, s => { s.tasks.push(fixtureTask()); })).rejects.toMatchObject({ status: 409 });
    expect(db.update).toHaveBeenCalledTimes(5); expect(db.state.tasks).toHaveLength(0);
  });
});