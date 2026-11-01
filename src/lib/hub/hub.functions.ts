import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import * as ops from "./operations";
import { getState } from "./context";
import { demoState } from "./demo";
import { HubError, type Actor, type HubDb } from "./store";
import { issueToken, revokeToken } from "./agent-auth.server";
import { listRepos, syncRepos } from "./github.server";

/** Thrown errors keep the HTTP-like status so the UI can explain conflicts and denials. */
function toError(e: unknown): never {
  if (e instanceof HubError) throw new Error(JSON.stringify({ status: e.status, message: e.message }));
  if (e instanceof z.ZodError) throw new Error(JSON.stringify({ status: 400, message: e.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") }));
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

export const getHubStateFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(({ context }) => run(async () => getState(await ownerActor(context))));

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
export const decideApprovalFn = authed.inputValidator(idData).handler(({ context, data }) => run(async () => ops.decide(await ownerActor(context), data.id, data.data)));
export const issueAgentTokenFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => issueToken(await ownerActor(context), data.id)));
export const revokeAgentTokenFn = authed.inputValidator(idOnly).handler(({ context, data }) => run(async () => revokeToken(await ownerActor(context), data.id)));
export const listGithubReposFn = authed.handler(({ context }) => run(async () => listRepos(await ownerActor(context))));
export const syncGithubFn = authed.handler(({ context }) => run(async () => syncRepos(await ownerActor(context))));
