import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./operations";
import { getState } from "./context";
import { demoState } from "./demo";
import { HubError, readState, type Actor, type HubDb } from "./store";
import { issueToken, revokeToken } from "./agent-auth.server";
import { listRepos, syncAndRecord } from "./github.server";
import { pushBackup } from "./backup.server";

/** Thrown errors keep the HTTP-like status so the UI can explain conflicts and denials. */
function toError(e: unknown): never {
  if (e instanceof HubError) throw new Error(JSON.stringify({ status: e.status, message: e.message }));
  if (e instanceof Error && e.name === "ZodError" && "issues" in e) throw new Error(JSON.stringify({ status: 400, message: (e as unknown as { issues: { path: PropertyKey[]; message: string }[] }).issues.map(i => `${i.path.map(String).join(".")}: ${i.message}`).join("; ") }));
  throw e;
}

async function ownerActor(ctx: { supabase: unknown; userId: string }): Promise<Actor> {
  const db = ctx.supabase as HubDb;
  const { data: isOwner, error } = await db.rpc("claim_hub");
  if (error) throw new HubError(500, error.message);
  if (!isOwner) throw new HubError(403, "This is a single-user personal workspace. Only its owner can access it. If you just signed up, confirm your email first.");
  return { ownerId: ctx.userId, agent: false, source: "You", db };
}

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);
const idOnly = z.object({ id: z.string().min(1) });
const idData = z.object({ id: z.string().min(1), data: z.unknown() });
const dataOnly = z.object({ data: z.unknown() });

const run = <T,>(fn: () => Promise<T>) => fn().catch(toError);

export const getDemoStateFn = createServerFn({ method: "GET" }).handler(async () => demoState());

// The 15-second refresh only needs recent history; older activity stays stored.
export const ACTIVITY_REFRESH_LIMIT = 200;
export const getHubStateFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(({ context }) => run(async () => {
    const s = await getState(await ownerActor(context));
    return { ...s, activity: s.activity.slice(0, ACTIVITY_REFRESH_LIMIT) };
  }));

export const createProjectFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.addProject(await ownerActor(context), data.data)));
export const updateProjectFn = authed.inputValidator(idData).handler(({ context, data }) => run(async () => ops.editProject(await ownerActor(context), data.id, data.data)));
export const deleteProjectFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => ops.removeProject(await ownerActor(context), data.id)));
export const createIdeaFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.addIdea(await ownerActor(context), data.data)));
export const updateIdeaFn = authed.inputValidator(idData).handler(({ context, data }) => run(async () => ops.editIdea(await ownerActor(context), data.id, data.data)));
export const deleteIdeaFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => ops.removeIdea(await ownerActor(context), data.id)));
export const promoteIdeaFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => ops.promote(await ownerActor(context), data.id)));
export const createTaskFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.addTask(await ownerActor(context), data.data)));
export const updateTaskFn = authed.inputValidator(idData).handler(({ context, data }) => run(async () => ops.editTask(await ownerActor(context), data.id, data.data)));
export const deleteTaskFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => ops.removeTask(await ownerActor(context), data.id)));
export const createHandoffFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.addHandoff(await ownerActor(context), data.data)));
export const saveReviewedUpdateFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.saveReviewedUpdate(await ownerActor(context), data.data)));
export const exportKickoffFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.exportKickoff(await ownerActor(context), data.data)));
export const saveKickoffFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.saveKickoff(await ownerActor(context), data.data)));
export const saveMindMapFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.saveMindMap(await ownerActor(context), data.data)));
export const promoteClusterFn = authed.inputValidator(dataOnly).handler(({ context, data }) => run(async () => ops.promoteCluster(await ownerActor(context), data.data)));
export const getMindMapFn = authed.handler(({ context }) => run(async () => {
  const actor = await ownerActor(context);
  return (await readState(actor.db, actor.ownerId)).mindMap ?? null;
}));
export const getKickoffsFn = authed.handler(({ context }) => run(async () => {
  const actor = await ownerActor(context);
  return (await readState(actor.db, actor.ownerId)).kickoffs;
}));
export const decideApprovalFn = authed.inputValidator(idData).handler(({ context, data }) => run(async () => ops.decide(await ownerActor(context), data.id, data.data)));
export const issueAgentTokenFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => issueToken(await ownerActor(context), data.id)));
export const revokeAgentTokenFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => revokeToken(await ownerActor(context), data.id)));
export const listGithubReposFn = authed.handler(({ context }) => run(async () => listRepos(await ownerActor(context))));
export const syncGithubFn = authed.handler(({ context }) => run(async () => syncAndRecord(await ownerActor(context), "manual")));

export const getSyncStatusFn = authed.handler(({ context }) => run(async () => {
  const actor = await ownerActor(context);
  const { data } = await actor.db.from("hub_owner").select("github_sync_enabled, last_sync_at, last_sync_ok, last_sync_message, last_sync_trigger, backup_repo, last_backup_at, last_backup_ok, last_backup_message").eq("user_id", actor.ownerId).maybeSingle();
  return {
    githubConnected: !!(process.env.LOVABLE_API_KEY && process.env.GITHUB_API_KEY),
    autoSyncEnabled: !!data?.github_sync_enabled,
    lastSyncAt: data?.last_sync_at ?? null, lastSyncOk: data?.last_sync_ok ?? null,
    lastSyncMessage: data?.last_sync_message ?? null, lastSyncTrigger: data?.last_sync_trigger ?? null,
    intervalMinutes: 60,
    backupRepo: data?.backup_repo ?? null, lastBackupAt: data?.last_backup_at ?? null,
    lastBackupOk: data?.last_backup_ok ?? null, lastBackupMessage: data?.last_backup_message ?? null,
  };
}));

export const backupNowFn = authed.handler(({ context }) => run(async () => {
  const actor = await ownerActor(context);
  if (actor.agent) throw new HubError(403, "Only the owner can run a backup.");
  const r = await pushBackup(actor.ownerId, await readState(actor), { force: true });
  if (!r.ok) throw new HubError(502, r.message);
  return { ok: true, message: r.message };
}));
