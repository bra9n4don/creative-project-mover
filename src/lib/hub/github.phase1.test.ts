import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "./store";
import { emptyIdeaIssues } from "./idea-issues";
import { fixtureProject, memoryWorkspace } from "@/test/phase1-fixtures";
const mock = vi.hoisted(() => ({ fetch: vi.fn(), record: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ update: (value: unknown) => { mock.record(value); return { eq: async () => ({ error: null }) }; } }) } }));
import { syncAndRecord, syncIdeaIssues } from "./github.server";
beforeEach(() => {
  mock.fetch.mockReset(); mock.record.mockReset();
  vi.stubEnv("LOVABLE_API_KEY", "synthetic-only"); vi.stubEnv("GITHUB_API_KEY", "synthetic-only");
  vi.stubGlobal("fetch", mock.fetch); vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const withRepo = () => { const s = emptyState(); s.ideaIssues = { ...emptyIdeaIssues(), repo: "synthetic/repo" }; return memoryWorkspace(s); };
it("direct issue sync surfaces failure without changing ideas", async () => {
  const db = withRepo(); mock.fetch.mockResolvedValue(new Response("Synthetic failure", { status: 403 }));
  await expect(syncIdeaIssues(db.actor)).rejects.toMatchObject({ status: 403 });
  expect(db.state.ideas).toHaveLength(0); expect(db.update).not.toHaveBeenCalled();
});
it("overall sync must not report success when selected Ideas issue sync fails", async () => {
  const db = withRepo(); mock.fetch.mockResolvedValue(new Response("Synthetic failure", { status: 503 }));
  // Desired regression contract: the user must see a failed sync, not a successful one.
  await expect(syncAndRecord(db.actor, "manual")).rejects.toMatchObject({ status: 502 });
  expect(mock.record).toHaveBeenCalledWith(expect.objectContaining({ last_sync_ok: false }));
});
it("repeat issue sync through revision conflicts imports once and preserves owner edits", async () => {
  const s = emptyState(); s.ideaIssues = { ...emptyIdeaIssues(), repo: "synthetic/repo" }; const db = memoryWorkspace(s, 1);
  mock.fetch.mockImplementation(async () => Response.json([{ number: 7, title: "Issue", body: "Body", html_url: "https://example.test/7", state: "open" }, { number: 8, title: "PR", pull_request: {} }]));
  expect(await syncIdeaIssues(db.actor)).toEqual({ added: 1 });
  expect(await syncIdeaIssues(db.actor)).toEqual({ added: 0 });
  expect(db.state.ideas).toHaveLength(1); expect(db.state.ideaIssues?.links).toHaveLength(1);
  expect(db.update).toHaveBeenCalledTimes(3);
  expect(mock.fetch.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
});
it("records repository activity failure and rethrows without workspace mutation", async () => {
  const s = emptyState(); s.projects = [{ ...fixtureProject(), repository: "synthetic/repo" }]; const db = memoryWorkspace(s);
  mock.fetch.mockImplementation(async () => new Response("Synthetic failure", { status: 500 }));
  await expect(syncAndRecord(db.actor, "automatic")).rejects.toMatchObject({ status: 502 });
  expect(mock.record).toHaveBeenCalledWith(expect.objectContaining({ last_sync_ok: false, last_sync_trigger: "automatic" }));
  expect(db.update).not.toHaveBeenCalled();
});