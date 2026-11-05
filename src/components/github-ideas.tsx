import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Github, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import * as fns from "@/lib/hub/hub.functions";
import type { IdeaIssues } from "@/lib/hub/idea-issues";
import { getGetHubStateQueryKey, useListGithubRepos } from "@/lib/hub-api";
import { btn, field } from "@/components/kit";

const KEY = ["hub", "github", "idea-issues"] as const;
const msg = (e: unknown) => { const m = e instanceof Error ? e.message : String(e); try { return (JSON.parse(m) as { message: string }).message; } catch { return m; } };

export function useIdeaIssues() {
  const fn = useServerFn(fns.getIdeaIssuesFn);
  return useQuery({ queryKey: KEY, queryFn: () => fn() as Promise<IdeaIssues> });
}

export function GithubIdeasBar() {
  const qc = useQueryClient();
  const cfg = useIdeaIssues();
  const repos = useListGithubRepos();
  const setRepo = useServerFn(fns.setIdeaIssueRepoFn);
  const sync = useServerFn(fns.syncIdeaIssuesFn);
  const refresh = () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: getGetHubStateQueryKey() }); };
  const pick = useMutation({ mutationFn: (repo: string | null) => setRepo({ data: { repo } }), onSuccess: refresh, onError: e => toast.error(msg(e)) });
  const run = useMutation({
    mutationFn: () => sync() as Promise<{ added: number }>,
    onSuccess: r => { refresh(); toast.success(r.added ? `${r.added} new issue${r.added === 1 ? "" : "s"} added to Ideas` : "No new issues"); },
    onError: e => toast.error(msg(e)),
  });
  const repo = cfg.data?.repo ?? "";
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 text-sm" data-testid="github-ideas-bar">
      <Github className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">GitHub issues</span>
      <select aria-label="Repository for ideas" className={`${field} h-8 w-auto min-w-0 max-w-[16rem] py-0`} value={repo} disabled={pick.isPending || repos.isLoading}
        onChange={e => pick.mutate(e.target.value || null)} data-testid="select-idea-repo">
        <option value="">{repos.isLoading ? "Loading repos…" : "Not synced"}</option>
        {(repos.data ?? []).map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
        {repo && !(repos.data ?? []).some(r => r.name === repo) && <option value={repo}>{repo}</option>}
      </select>
      {repo && (
        <button className={btn.ghost} disabled={run.isPending} onClick={() => run.mutate()} data-testid="button-sync-idea-issues">
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${run.isPending ? "animate-spin" : ""}`} />Sync now
        </button>
      )}
      <span className="text-xs text-muted-foreground">{repo ? "New open issues land in Inbox; also checked hourly." : "Pick a repo to bring its issues in as ideas."}</span>
    </div>
  );
}

export function IdeaIssueButton({ ideaId, cfg }: { ideaId: string; cfg: IdeaIssues | undefined }) {
  const qc = useQueryClient();
  const create = useServerFn(fns.createIssueFromIdeaFn);
  const m = useMutation({
    mutationFn: () => create({ data: { id: ideaId } }) as Promise<{ number: number; url: string }>,
    onSuccess: r => { qc.invalidateQueries({ queryKey: KEY }); toast.success(`Created issue #${r.number}`); },
    onError: e => toast.error(msg(e)),
  });
  if (!cfg?.repo) return null;
  const link = cfg.links.find(l => l.ideaId === ideaId);
  if (link) return <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-secondary" data-testid={`link-issue-${ideaId}`}><ExternalLink className="h-3.5 w-3.5" />#{link.number}</a>;
  return <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-secondary" disabled={m.isPending} onClick={() => m.mutate()} data-testid={`button-create-issue-${ideaId}`}><Github className="h-3.5 w-3.5" />{m.isPending ? "Creating…" : "Create issue"}</button>;
}
