import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRAFT_MODEL, UPDATE_MODEL } from "./model";
import { newKickoff } from "../kickoff";

const mocks = vi.hoisted(() => {
  const streamText = vi.fn();
  const state = { projects: [{ id: "existing-project", title: "CarterHub", goal: "Private project hub" }], tasks: [] };
  return { streamText, state, db: { auth: { getUser: vi.fn() }, rpc: vi.fn() } };
});
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: () => (model: string) => model }));
vi.mock("ai", () => ({ streamText: mocks.streamText, Output: { object: (value: unknown) => value } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => mocks.db }));
vi.mock("@/lib/hub/store", () => ({ readState: async () => mocks.state, project: () => mocks.state.projects[0] }));
vi.mock("./run-id.ts", () => ({
  createLovableAiGatewayRunIdFetch: () => ({ fetch: vi.fn(), waitForRunId: async () => undefined, getRunId: () => undefined }),
  getLovableAiGatewayRunId: () => undefined,
  getLovableAiGatewayResponseHeaders: (_: unknown, headers: HeadersInit) => new Headers(headers),
  withLovableAiGatewayRunIdHeader: (response: Response) => response,
}));

import { createResponsesCall } from "./responses.server";
import { handleProjectUpdate } from "./project-update.server";
import { handleKickoffDraft } from "./kickoff.server";

const request = (body: unknown) => new Request("http://localhost/api/draft", {
  method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const config = { baseURL: "https://example.test/v1", apiKey: "test-key", model: DRAFT_MODEL };

describe("Draft cost settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://example.test");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-key");
    vi.stubEnv("LOVABLE_API_KEY", "test-ai-key");
    mocks.db.auth.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    mocks.db.rpc.mockResolvedValue({ data: true });
    mocks.streamText.mockImplementation(() => ({
      output: Promise.resolve({}), fullStream: (async function* () {})(),
      toUIMessageStreamResponse: vi.fn(() => new Response()),
    }));
  });

  it("defaults to 2000 output tokens", () => {
    createResponsesCall(request({}), config, []);
    expect(mocks.streamText.mock.calls[0]?.[0].maxOutputTokens).toBe(2000);
  });
  it("does not include reasoning in browser messages", async () => {
    const call = createResponsesCall(request({}), config, []);
    await call.response();
    expect(call.result.toUIMessageStreamResponse).toHaveBeenCalledWith({ sendReasoning: false });
  });
  it("uses Haiku with 1500 tokens and no extended thinking for updates", async () => {
    const response = await handleProjectUpdate(request({ projectId: "existing-project", update: "Test password reset next." }));
    await response.text();
    expect(mocks.streamText.mock.calls[0]?.[0]).toMatchObject({
      model: "anthropic/claude-haiku-4-5", maxOutputTokens: 1500,
      providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    });
    expect(mocks.streamText.mock.calls[0]?.[0].providerOptions.anthropic).not.toHaveProperty("effort");
    expect(UPDATE_MODEL).toBe("anthropic/claude-haiku-4-5");
  });
  it("uses Sonnet with 2000 tokens and low effort for briefs", async () => {
    const response = await handleKickoffDraft(request({ mode: "brief", kickoff: { ...newKickoff(), brainstorm: "Private idea inbox" } }));
    await response.text();
    expect(mocks.streamText.mock.calls[0]?.[0]).toMatchObject({
      model: "anthropic/claude-sonnet-5", maxOutputTokens: 2000,
      providerOptions: { anthropic: { effort: "low" } },
    });
  });
  it("uses Sonnet with 3000 tokens and medium effort for plans", async () => {
    const response = await handleKickoffDraft(request({ mode: "plan", kickoff: { ...newKickoff(), brainstorm: "Private idea inbox" } }));
    await response.text();
    expect(mocks.streamText.mock.calls[0]?.[0]).toMatchObject({
      model: "anthropic/claude-sonnet-5", maxOutputTokens: 3000,
      providerOptions: { anthropic: { effort: "medium" } },
    });
  });
});