import { describe, expect, it } from "vitest";
import * as ops from "./operations";
import { emptyState, type Actor, type HubDb, type HubState } from "./store";
import { capChat, findMatch, parseExport } from "./imports";

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

const content = { project: { title: "Meal Planner", description: "d", goal: "g" }, tasks: [{ title: "Buy domain", description: "", priority: "high" as const }], ideas: [{ title: "Recipe AI", description: "" }], handoff: null };
const setup = () => {
  const db = fakeDb();
  const owner: Actor = { ownerId: "o", source: "You", agent: false, db: db as unknown as HubDb };
  return { db, owner, agent: { ...owner, source: "ChatGPT", agent: true } as Actor };
};

describe("imports", () => {
  it("assistant drafts never touch projects until the owner approves", async () => {
    const { db, owner, agent } = setup();
    const r = await ops.createImportDraft(agent, { source: "chatgpt", content });
    expect(db.state.projects).toHaveLength(0);
    expect(db.state.tasks).toHaveLength(0);
    expect(() => ops.approveImport(agent, { id: r.draftId, mode: "new" })).toThrow();
    await ops.approveImport(owner, { id: r.draftId, mode: "new" });
    expect(db.state.projects.map(p => p.title)).toEqual(["Meal Planner"]);
    expect(db.state.tasks).toHaveLength(1);
    expect(db.state.ideas).toHaveLength(1);
    expect(db.state.imports).toHaveLength(0);
  });
  it("merge adds to the chosen project without duplicating task titles", async () => {
    const { db, owner } = setup();
    const p = await ops.addProject(owner, { title: "Meal planner app" });
    await ops.addTask(owner, { projectId: p.id, title: "Buy domain" });
    const r = await ops.createImportDraft(owner, { source: "claude", content: { ...content, tasks: [...content.tasks, { title: "Design logo", description: "", priority: "low" as const }] } });
    expect(db.state.imports?.[0]?.matchProjectId).toBe(p.id);
    await ops.approveImport(owner, { id: r.draftId, mode: "merge", targetProjectId: p.id });
    expect(db.state.projects).toHaveLength(1);
    expect(db.state.tasks.map(t => t.title).sort()).toEqual(["Buy domain", "Design logo"]);
  });
  it("GitHub sync suggestions skip tasks the owner edited", async () => {
    const { db, owner } = setup();
    const r = await ops.createImportDraft(owner, { source: "github", repo: "me/app", keepSynced: true, content: { ...content, ideas: [], tasks: [{ title: "Bug A", description: "", priority: "medium" as const, issueNumber: 1 }, { title: "Bug B", description: "", priority: "medium" as const, issueNumber: 2 }] } });
    await ops.approveImport(owner, { id: r.draftId, mode: "new" });
    const [a, b] = db.state.tasks;
    await ops.editTask(owner, b!.id, { expectedVersion: 1, title: "Bug B (mine)" });
    await ops.mutateStateForTest(owner, s => ops.queueSyncSuggestions(s, s.githubLinks![0]!, [
      { number: 1, title: "Bug A", body: "", open: false }, { number: 2, title: "Bug B", body: "", open: false }, { number: 3, title: "Bug C", body: "", open: true },
    ], new Date().toISOString()));
    const sync = db.state.imports![0]!;
    expect(sync.kind).toBe("sync");
    expect(db.state.tasks).toHaveLength(2);
    await ops.approveImport(owner, { id: sync.id, mode: "merge" });
    const tasks = db.state.tasks;
    expect(tasks.find(t => t.id === a!.id)?.status).toBe("done");
    expect(tasks.find(t => t.id === b!.id)?.status).toBe("todo");
    expect(tasks.some(t => t.title === "Bug C")).toBe(true);
  });
  it("caps long chats to the most recent 60,000 characters", () => {
    const r = capChat("x".repeat(10) + "y".repeat(60000));
    expect(r.trimmed).toBe(true);
    expect(r.text).toHaveLength(60000);
    expect(r.text.startsWith("y")).toBe(true);
  });
  it("matches by repo or similar name", () => {
    const ps = [{ id: "1", title: "Grocery list", repository: "" }, { id: "2", title: "Other", repository: "me/app" }];
    expect(findMatch(ps, "grocery-list")).toBe("1");
    expect(findMatch(ps, "Totally new", "me/app")).toBe("2");
    expect(findMatch(ps, "Totally new")).toBeNull();
  });
  it("reads ChatGPT and Claude exports", () => {
    const gpt = [{ title: "Plan", mapping: { a: { message: { author: { role: "user" }, content: { parts: ["hi"] }, create_time: 1 } } } }];
    expect(parseExport(gpt)).toEqual([{ title: "Plan", text: "user: hi" }]);
    expect(parseExport([{ name: "C", chat_messages: [{ sender: "human", text: "yo" }] }])[0]?.text).toBe("human: yo");
  });
});
