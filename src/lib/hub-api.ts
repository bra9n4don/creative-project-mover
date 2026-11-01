import { useMutation, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as fns from "./hub/hub.functions";
export * from "./hub/types";
import type { HubState, Project, Task, Idea, Handoff, ProjectInput, ProjectUpdate, IdeaInput, IdeaUpdate, TaskInput, TaskUpdate, HandoffInput, DecisionInput, TokenResult, ActionResult, GithubRepo } from "./hub/types";

/** Server errors carry {status, message}; expose them like the original HTTP client did. */
export class HubClientError extends Error {
  constructor(public status: number, message: string, public data: { error: string }) { super(message); }
}
function wrap<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  return async (...a: A) => {
    try { return await fn(...a); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      try {
        const p = JSON.parse(msg) as { status: number; message: string };
        if (typeof p.status === "number") throw new HubClientError(p.status, p.message, { error: p.message });
      } catch (inner) { if (inner instanceof HubClientError) throw inner; }
      if (/unauthorized/i.test(msg)) throw new HubClientError(401, msg, { error: msg });
      throw e;
    }
  };
}

type QOpts<T> = { query?: Partial<UseQueryOptions<T>> };
export const getGetHubStateQueryKey = () => ["hub", "state"] as const;
export const getGetDemoStateQueryKey = () => ["hub", "demo"] as const;
export const getListGithubReposQueryKey = () => ["hub", "github", "repos"] as const;

export function useGetHubState(o: QOpts<HubState> = {}) {
  const fn = useServerFn(fns.getHubStateFn);
  return useQuery({ queryKey: getGetHubStateQueryKey(), queryFn: wrap(() => fn() as Promise<HubState>), ...o.query } as UseQueryOptions<HubState>);
}
export function useGetDemoState(o: QOpts<HubState> = {}) {
  const fn = useServerFn(fns.getDemoStateFn);
  return useQuery({ queryKey: getGetDemoStateQueryKey(), queryFn: wrap(() => fn() as Promise<HubState>), ...o.query } as UseQueryOptions<HubState>);
}
export function useListGithubRepos(o: QOpts<GithubRepo[]> = {}) {
  const fn = useServerFn(fns.listGithubReposFn);
  return useQuery({ queryKey: getListGithubReposQueryKey(), queryFn: wrap(() => fn() as Promise<GithubRepo[]>), ...o.query } as UseQueryOptions<GithubRepo[]>);
}
export function useHealthCheck(o: QOpts<{ status: string }> = {}) {
  return useQuery({ queryKey: ["health"], queryFn: async () => { const r = await fetch("/api/public/healthz"); if (!r.ok) throw new Error("down"); return r.json() as Promise<{ status: string }>; }, ...o.query } as UseQueryOptions<{ status: string }>);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mut<V, R>(serverFn: any) {
  return () => {
    const fn = useServerFn(serverFn) as (a: { data: V }) => Promise<R>;
    return useMutation<R, HubClientError, V>({ mutationFn: wrap((v: V) => fn({ data: v })) });
  };
}
type WithData<T> = { data: T };
type WithId = { id: string };
type IdData<T> = WithId & WithData<T>;

export const useCreateProject = mut<WithData<ProjectInput>, Project>(fns.createProjectFn);
export const useUpdateProject = mut<IdData<ProjectUpdate>, ActionResult>(fns.updateProjectFn);
export const useDeleteProject = mut<WithId, ActionResult>(fns.deleteProjectFn);
export const useCreateIdea = mut<WithData<IdeaInput>, Idea>(fns.createIdeaFn);
export const useUpdateIdea = mut<IdData<IdeaUpdate>, ActionResult>(fns.updateIdeaFn);
export const useDeleteIdea = mut<WithId, ActionResult>(fns.deleteIdeaFn);
export const usePromoteIdea = mut<WithId, ActionResult>(fns.promoteIdeaFn);
export const useCreateTask = mut<WithData<TaskInput>, Task>(fns.createTaskFn);
export const useUpdateTask = mut<IdData<TaskUpdate>, ActionResult>(fns.updateTaskFn);
export const useDeleteTask = mut<WithId, ActionResult>(fns.deleteTaskFn);
export const useCreateHandoff = mut<WithData<HandoffInput>, Handoff>(fns.createHandoffFn);
export const useDecideApproval = mut<IdData<DecisionInput>, ActionResult>(fns.decideApprovalFn);
export const useIssueAgentToken = mut<WithId, TokenResult>(fns.issueAgentTokenFn);
export const useRevokeAgentToken = mut<WithId, ActionResult>(fns.revokeAgentTokenFn);
export function useSyncGithub() {
  const fn = useServerFn(fns.syncGithubFn);
  return useMutation<ActionResult, HubClientError, void>({ mutationFn: wrap(() => fn() as Promise<ActionResult>) });
}

export type GithubSyncStatus = { githubConnected: boolean; autoSyncEnabled: boolean; lastSyncAt: string | null; lastSyncOk: boolean | null; lastSyncMessage: string | null; lastSyncTrigger: string | null; intervalMinutes: number };
export function useGithubSyncStatus(o: QOpts<GithubSyncStatus> = {}) {
  const fn = useServerFn(fns.getSyncStatusFn);
  return useQuery({ queryKey: ["hub", "github", "sync-status"], queryFn: wrap(() => fn() as Promise<GithubSyncStatus>), ...o.query } as UseQueryOptions<GithubSyncStatus>);
}
