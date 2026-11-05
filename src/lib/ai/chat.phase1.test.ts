import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "@/lib/hub/store";
import { fixtureProject, fixtureTask } from "@/test/phase1-fixtures";
const mock = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), rpc: vi.fn(), from: vi.fn(), writes: vi.fn(), stream: vi.fn(), read: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mock.client }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: () => () => "synthetic-model" }));
vi.mock("ai", () => ({ streamText: mock.stream, tool: (value: unknown) => value, stepCountIs: () => 3, convertToModelMessages: async (value: unknown) => value }));
vi.mock("@/lib/hub/store", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/hub/store")>(), readState: mock.read }));
import { handleChat } from "./chat.server";
const threadId = "00000000-0000-4000-8000-000000000001";
const request = (auth = true) => new Request("https://example.test/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer synthetic-not-a-real-token" } : {}) }, body: JSON.stringify({ threadId, message: { id: "synthetic-message", role: "user", parts: [{ type: "text", text: "Synthetic question" }] } }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://example.test"); vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "synthetic-key"); vi.stubEnv("LOVABLE_API_KEY", "synthetic-ai-key");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
  mock.user.mockResolvedValue({ data: { user: { id: "synthetic-owner" } }, error: null }); mock.rpc.mockResolvedValue({ data: true });
  mock.from.mockImplementation((table: string) => {
    const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data: { id: threadId, owner_id: "synthetic-owner", title: "Existing" }, error: null }),
      upsert: async (value: unknown) => { mock.writes(table, "upsert", value); return { error: null }; },
      update: (value: unknown) => { mock.writes(table, "update", value); return { eq: async () => ({ error: null }) }; } };
    return q;
  });
  mock.client.mockReturnValue({ auth: { getUser: mock.user }, rpc: mock.rpc, from: mock.from });
  const s = emptyState(); s.projects = [fixtureProject()]; s.tasks = [fixtureTask()];
  s.milestones = [{ id: "m", projectId: "p", title: "Milestone", outcome: "", order: 0, version: 2, createdAt: "", updatedAt: "" }];
  mock.read.mockResolvedValue(s); mock.stream.mockReturnValue({ toUIMessageStreamResponse: () => new Response("Synthetic stream") });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("missing authorization rejects before creating a client or saving anything", async () => {
  expect((await handleChat(request(false))).status).toBe(401);
  expect(mock.client).not.toHaveBeenCalled(); expect(mock.writes).not.toHaveBeenCalled(); expect(mock.stream).not.toHaveBeenCalled();
});
it("invalid session rejects before querying workspace ownership or messages", async () => {
  mock.user.mockResolvedValue({ data: { user: null }, error: { message: "synthetic" } });
  expect((await handleChat(request())).status).toBe(401);
  expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.from).not.toHaveBeenCalled(); expect(mock.stream).not.toHaveBeenCalled();
});
it("non-owner rejects before message reads, writes, or AI", async () => {
  mock.rpc.mockResolvedValue({ data: false });
  expect((await handleChat(request())).status).toBe(403);
  expect(mock.from).not.toHaveBeenCalled(); expect(mock.stream).not.toHaveBeenCalled();
});
it("all five server-wired proposal tools remain non-writing", async () => {
  const response = await handleChat(request()); expect(response.status).toBe(200);
  const tools = mock.stream.mock.calls[0][0].tools;
  const stateBefore = structuredClone(await mock.read.mock.results[0].value);
  const writesBefore = mock.writes.mock.calls.length;
  const inputs = { propose_task: { projectId: "p", title: "New" }, propose_task_update: { taskId: "t", title: "Changed", milestoneId: "m" }, propose_milestone: { projectId: "p", title: "New milestone" }, propose_milestone_update: { milestoneId: "m", targetDate: "2026-11-10" }, propose_idea: { title: "New idea" } };
  for (const [name, input] of Object.entries(inputs)) expect(await tools[name].execute(input)).toMatchObject({ ok: true });
  expect(mock.writes).toHaveBeenCalledTimes(writesBefore);
  expect(await mock.read.mock.results[0].value).toEqual(stateBefore);
  expect(mock.writes.mock.calls.every(([table]) => ["hub_chat_messages", "hub_chat_threads"].includes(table))).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
});