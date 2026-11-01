import { HubError, mutateState, audit, requireOwner, type Actor } from "./store";
import { clients } from "./clients";

export async function hashToken(token: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Resolve a dedicated per-tool Relay credential to an agent actor. Only hashes are stored. */
export async function agentActorFromRequest(request: Request): Promise<Actor> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer relay_")) throw new HubError(401, "Send Authorization: Bearer relay_<credential> from Connections.");
  const token = authorization.slice(7);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const hash = await hashToken(token);
  const { data: key } = await supabaseAdmin.from("hub_agent_keys").select("*").eq("hash", hash).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!key) throw new HubError(401, "Invalid, revoked, or expired Relay credential.");
  const { data: owner } = await supabaseAdmin.from("hub_owner").select("user_id").eq("id", "personal").maybeSingle();
  if (owner?.user_id !== key.owner_id) throw new HubError(403, "Credential is not authorized for this personal hub.");
  const client = clients.find(c => c.id === key.client_id);
  if (!client) throw new HubError(403, "Unknown AI tool.");
  await supabaseAdmin.from("hub_agent_keys").update({ last_seen: new Date().toISOString() }).eq("owner_id", key.owner_id).eq("client_id", key.client_id);
  return { ownerId: key.owner_id, agent: true, source: client.name, db: supabaseAdmin };
}

export async function issueToken(actor: Actor, clientId: string) {
  requireOwner(actor);
  const client = clients.find(c => c.id === clientId);
  if (!client) throw new HubError(404, "Unknown AI tool.");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `relay_${[...bytes].map(b => b.toString(16).padStart(2, "0")).join("")}`;
  const expiresAt = new Date(Date.now() + 90 * 86400_000).toISOString();
  const { error } = await actor.db.from("hub_agent_keys").upsert(
    { owner_id: actor.ownerId, client_id: clientId, hash: await hashToken(token), prefix: token.slice(0, 12), expires_at: expiresAt, last_seen: null },
    { onConflict: "owner_id,client_id" },
  );
  if (error) throw new HubError(500, error.message);
  await mutateState(actor, s => audit(s, actor, `Configured ${client.name}`, "Credential issued. Waiting for the tool's first authenticated request.", "", "connection"));
  return { token, expiresAt };
}

export async function revokeToken(actor: Actor, clientId: string) {
  requireOwner(actor);
  await actor.db.from("hub_agent_keys").delete().eq("owner_id", actor.ownerId).eq("client_id", clientId);
  await mutateState(actor, s => audit(s, actor, `Revoked access: ${clients.find(c => c.id === clientId)?.name ?? clientId}`, "", "", "connection"));
  return { ok: true, message: "Credential revoked. The tool can no longer access this hub." };
}
