---
name: relay-ai-prompts
description: How Relay's AI drafts work (Kickoff brief/plan, project updates, mind map AI Expand). Use when adding or changing any AI feature, prompt, draft schema or length limit in Relay.
---

# Relay AI prompts

- All AI calls go through `createResponsesCall` in `src/lib/ai/responses.server.ts` (Lovable AI Gateway, Claude Sonnet via Messages API `DRAFT_MODEL`, streamed NDJSON, structured output via zod schema).
- Shared safety/preamble text lives in `DRAFT_PREAMBLE` in `src/lib/ai/prompts.ts`; never copy it into a new file. Wrap input payloads in `compact()` to drop empty fields.
- Send only fields the model uses (title/goal, open tasks, finished titles), never the whole workspace.
- Reasoning: `low` for briefs and project updates, `medium` only for plans.
- One click = one AI call. AI Expand drafts the brief only; the plan is a separate button.
- Every draft is editable and saved only after owner review (`saveReviewedUpdate`, explicit Kickoff step review). Never auto-save AI output.
- Limits: brief+plan 10,000 chars (`KICKOFF_BRIEF_LIMIT`), project update paste 8,000 (`UPDATE_INPUT_LIMIT`), assistant tool text 2,000 / next action 1,000 (`src/lib/mcp/schemas.ts`). Keep output schema `.max()` close to what the UI shows.
- Endpoints are owner-only; check `is_hub_owner` before calling the gateway.
- After changes: run `bunx vitest run`, then trigger one real draft to confirm it still returns.
