import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, Output, type ModelMessage } from "ai";
import { updateDraftSchema } from "@/lib/hub/update-draft";
import type { z } from "zod";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.ts";

/** Claude model used for every Relay draft (Kickoff brief/plan, project updates). */
export const DRAFT_MODEL = "anthropic/claude-sonnet-5";

export function createResponsesCall<T = z.infer<typeof updateDraftSchema>>(
  request: Request,
  config: { baseURL: string; apiKey: string; model: string; reasoningEffort?: "low" | "medium" | "high" },
  messages: ModelMessage[],
  instructions?: string,
  schema?: z.ZodType<T>,
) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  let upstreamFailure: { status: number; message: string } | null = null;
  const provider = createAnthropic({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const response = await runIdFetch.fetch(input, init);
      if (!response.ok) {
        const body = await response.clone().json().catch(() => null);
        upstreamFailure = { status: response.status, message: body?.message ?? body?.error?.message ?? `Lovable AI request failed (${response.status}).` };
      }
      return response;
    },
  });
  const result = streamText({
    model: provider(config.model),
    ...(instructions ? { system: instructions } : {}),
    messages,
    maxRetries: 0,
    maxOutputTokens: 16000,
    output: Output.object({ schema: schema ?? updateDraftSchema as unknown as z.ZodType<T> }),
    abortSignal: request.signal,
    providerOptions: {
      anthropic: {
        thinking: { type: "adaptive" },
        effort: config.reasoningEffort ?? "medium",
        structuredOutputMode: "outputFormat",
      },
    },
  });
  return {
    result,
    runIdFetch,
    getFailure: () => upstreamFailure,
    response: () =>
      withLovableAiGatewayRunIdHeader(result.toUIMessageStreamResponse({ sendReasoning: true }), runIdFetch),
  };
}
