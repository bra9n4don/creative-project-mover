import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { HubError, type Actor, type HubDb } from "@/lib/hub/store";
import { supabaseForUser } from "./supabase";

/**
 * Connected assistants act for the signed-in owner but keep agent guardrails
 * (no verifying, deleting or applying plan changes without the owner).
 */
export async function assistantActor(ctx: ToolContext): Promise<Actor> {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) throw new ToolError("Sign in to Relay to use this tool.");
  const db = supabaseForUser(ctx) as unknown as HubDb;
  const { data: isOwner } = await db.rpc("is_hub_owner", { _uid: userId });
  if (!isOwner) throw new ToolError("This account doesn't own the Relay workspace. Claim it on the Setup page first.");
  // Name the assistant (e.g. "Claude", "ChatGPT") from its OAuth client so usage can be told apart.
  let source = "Connected assistant";
  const clientId = ctx.getClientId();
  if (clientId) {
    const { data: name } = await db.rpc("hub_oauth_client_name", { _client_id: clientId });
    if (typeof name === "string" && name.trim()) source = name.trim().slice(0, 60);
  }
  const { data: ownerId } = await db.rpc("hub_owner_uid");
  if (!ownerId) throw new ToolError("This account isn't linked to the Relay workspace.");
  return { ownerId: ownerId as string, agent: true, source, db };
}

export async function runHub<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (e) {
    if (e instanceof ToolError) throw e;
    if (e instanceof HubError) throw new ToolError(e.message);
    if (e instanceof Error && e.name === "ZodError") throw new ToolError(`Invalid input: ${e.message}`);
    throw e;
  }
}

export const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value) }] });
