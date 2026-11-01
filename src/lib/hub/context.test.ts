import { describe, expect, it } from "vitest";
import { buildResumeContext } from "./context";
import { emptyState, type HubState } from "./store";

const proj = (id: string, updatedAt: string) => ({ id, title: id, description: "long", goal: "g", status: "active", priority: "medium", repository: "", color: "", version: 1, createdAt: updatedAt, updatedAt }) as HubState["projects"][number];
const task = (id: string, projectId: string, status: string, description = "") => ({ id, projectId, title: id, description, status, priority: "medium", agent: "", evidence: "", dependencies: [], version: 1, createdAt: "", updatedAt: "" }) as HubState["tasks"][number];

function state(): HubState {
  const s = emptyState();
  s.projects = [proj("old", "2026-01-01"), proj("recent", "2026-06-01")];
  s.tasks = [task("t-open", "recent", "todo", "x".repeat(1000)), task("t-done", "recent", "done"), task("t-other", "old", "todo")];
  s.activity = Array.from({ length: 12 }, (_, i) => ({ id: `a${i}`, title: `a${i}`, description: "d", source: "s", kind: "k", projectId: "recent", url: "", createdAt: "" }));
  return s;
}

describe("assistant resume context", () => {
  it("details only the most recent project and summarizes the rest", () => {
    const c = buildResumeContext(state());
    expect(c.focus?.project.id).toBe("recent");
    expect(c.otherProjects.map(p => p.id)).toEqual(["old"]);
  });
  it("lists open tasks with ids and versions, finished tasks as titles only", () => {
    const c = buildResumeContext(state());
    expect(c.focus?.openTasks.map(t => [t.id, t.version])).toEqual([["t-open", 1]]);
    expect(c.focus?.finishedTaskTitles).toEqual(["t-done"]);
  });
  it("caps task descriptions at 300 characters and activity at 5 items", () => {
    const c = buildResumeContext(state());
    expect(c.focus?.openTasks[0]?.description?.length).toBe(301);
    expect(c.focus?.recentActivity).toHaveLength(5);
  });
  it("returns the requested project when projectId is given", () => {
    const c = buildResumeContext(state(), "old");
    expect(c.focus?.project.id).toBe("old");
    expect(c.otherProjects).toEqual([]);
  });
});

describe("assistant context caps", () => {
  it("lists at most 25 open tasks and 20 other projects, with full counts", () => {
    const s = state();
    s.tasks.push(...Array.from({ length: 40 }, (_, i) => task(`o${i}`, "recent", "todo")));
    s.projects.push(...Array.from({ length: 30 }, (_, i) => proj(`p${i}`, "2026-02-01")));
    const c = buildResumeContext(s);
    expect(c.focus?.openTasks).toHaveLength(25);
    expect(c.focus?.openTaskCount).toBe(41);
    expect(c.otherProjects).toHaveLength(20);
    expect(c.otherProjectCount).toBe(31);
  });
});
