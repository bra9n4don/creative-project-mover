import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "./store";
import { backupFiles, gitBlobSha } from "./backup";
const mock = vi.hoisted(() => ({ fetch: vi.fn(), record: vi.fn(), owner: { backup_repo: null as string | null, backup_shas: {} as Record<string, string> } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: structuredClone(mock.owner), error: null }) }) }),
  update: (value: unknown) => { mock.record(value); return { eq: async () => ({ error: null }) }; },
}) } }));
import { pushBackup } from "./backup.server";
beforeEach(() => {
  mock.owner = { backup_repo: null, backup_shas: {} }; mock.fetch.mockReset(); mock.record.mockReset();
  vi.stubGlobal("fetch", mock.fetch); vi.stubEnv("LOVABLE_API_KEY", "synthetic-only"); vi.stubEnv("GITHUB_API_KEY", "synthetic-only");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("missing credentials returns disconnected without network or status writes", async () => {
  vi.stubEnv("GITHUB_API_KEY", "");
  expect(await pushBackup("synthetic-owner", emptyState())).toEqual({ ok: false, message: "GitHub isn't connected." });
  expect(mock.fetch).not.toHaveBeenCalled(); expect(mock.record).not.toHaveBeenCalled();
});
it("refuses a public repo when discovering the backup destination", async () => {
  mock.fetch.mockResolvedValueOnce(Response.json({ login: "synthetic" })).mockResolvedValueOnce(Response.json({ private: false, full_name: "synthetic/relay-workspace" }));
  expect(await pushBackup("synthetic-owner", emptyState())).toMatchObject({ ok: false, message: expect.stringContaining("is public") });
  expect(mock.fetch.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
  expect(mock.record).toHaveBeenCalledWith(expect.objectContaining({ last_backup_ok: false, backup_repo: null }));
});
it("must re-check privacy for a remembered repo before writing", async () => {
  mock.owner.backup_repo = "synthetic/relay-workspace";
  mock.fetch.mockImplementation(async (_url, init) => init.method === "GET" ? Response.json({ private: false, full_name: "synthetic/relay-workspace" }) : Response.json({}));
  // Desired regression contract: remembered destinations can become public after first setup.
  expect(await pushBackup("synthetic-owner", emptyState())).toMatchObject({ ok: false });
  expect(mock.fetch.mock.calls.some(([, init]) => init.method === "PUT")).toBe(false);
});
it("matching content hashes skip all network writes", async () => {
  mock.owner.backup_repo = "synthetic/relay-workspace";
  for (const [path, content] of Object.entries(backupFiles(emptyState()))) mock.owner.backup_shas[path] = await gitBlobSha(content);
  expect(await pushBackup("synthetic-owner", emptyState())).toEqual({ ok: true, message: "Already up to date." });
  expect(mock.fetch).not.toHaveBeenCalled();
});
it.each([409, 422])("refreshes remote SHA and retries a mocked %i conflict", async status => {
  mock.owner.backup_repo = "synthetic/relay-workspace";
  mock.fetch.mockResolvedValueOnce(Response.json({ private: true, full_name: "synthetic/relay-workspace" })).mockResolvedValueOnce(new Response("conflict", { status })).mockResolvedValueOnce(Response.json({ sha: "remote-sha" })).mockImplementation(async () => Response.json({}));
  expect(await pushBackup("synthetic-owner", emptyState(), { force: true })).toMatchObject({ ok: true });
  expect(JSON.parse(mock.fetch.mock.calls[3][1].body)).toMatchObject({ sha: "remote-sha" });
  expect(mock.fetch.mock.calls.filter(([, init]) => init.method === "PUT")).toHaveLength(3);
});
it("failed write returns failure and does not mark hashes successfully backed up", async () => {
  mock.owner.backup_repo = "synthetic/relay-workspace"; mock.fetch.mockImplementation(async () => new Response("Synthetic failure", { status: 500 }));
  expect(await pushBackup("synthetic-owner", emptyState())).toMatchObject({ ok: false });
  expect(mock.record).toHaveBeenCalledWith(expect.objectContaining({ last_backup_ok: false }));
  expect(mock.record.mock.calls[0][0]).not.toHaveProperty("backup_shas");
});
it("simultaneous mocked pushes settle after delayed requests without dropping file hashes", async () => {
  mock.owner.backup_repo = "synthetic/relay-workspace";
  let releaseFirstWrite: (() => void) | undefined;
  let writes = 0;
  mock.fetch.mockImplementation(async (_url, init) => {
    if (init.method === "GET") return Response.json({ private: true, full_name: "synthetic/relay-workspace" });
    writes++;
    if (writes === 1) await new Promise<void>(resolve => { releaseFirstWrite = resolve; });
    return Response.json({});
  });
  const a = pushBackup("synthetic-owner", emptyState(), { force: true });
  try {
    await vi.waitFor(() => expect(releaseFirstWrite).toBeTypeOf("function"));
    const b = pushBackup("synthetic-owner", emptyState(), { force: true });
    releaseFirstWrite?.();
    expect(await Promise.all([a, b])).toEqual([expect.objectContaining({ ok: true }), expect.objectContaining({ ok: true })]);
  } finally {
    releaseFirstWrite?.();
  }
  expect(mock.record).toHaveBeenCalledTimes(2);
  for (const [record] of mock.record.mock.calls) expect(Object.keys(record.backup_shas).sort()).toEqual(["workspace.json", "workspace.md"]);
});