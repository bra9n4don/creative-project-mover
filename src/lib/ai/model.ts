/**
 * Single source of truth for the AI drafting model shown in the UI.
 * Client-safe: no server-only imports. src/lib/ai/responses.server.ts imports DRAFT_MODEL from here.
 */
export const DRAFT_MODEL = "anthropic/claude-sonnet-5";
export const DRAFT_MODEL_LABEL = "Claude Sonnet";
