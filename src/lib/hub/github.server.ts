import { HubError, type Actor, mutateState, audit, ok, requireOwner, readState } from "./store";

// Read-only GitHub access through the linked GitHub connection (credentials never reach the browser).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";
async function github<T>(path: string, init?: { method: "POST"; body: unknown }): Promise<T> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const githubKey = process.env.GITHUB_API_KEY;
  if (!lovableKey || !githubKey) throw new HubError(503, "GitHub isn't connected yet. Connect GitHub to enable repository sync.");
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": githubKey, Accept: "application/vnd.github+json", ...(init ? { "Content-Type": "application/json" } : {}) },
    ...(init ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`GitHub request failed [${response.status}]: ${body}`);
    throw new HubError(response.status === 401 || response.status === 403 ? 403 : 502, `GitHub request failed (${response.status}). Check the connected GitHub account and its permissions.`);
  }
  return response.json() as Promise<T>;
}

/** Records the outcome of every sync so the owner can confirm automatic sync is running. */
async function recordSync(ownerId: string, trigger: "manual" | "automatic", ok: boolean, message: string, enable: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("hub_owner").update({
    last_sync_at: new Date().toISOString(), last_sync_ok: ok, last_sync_message: message, last_sync_trigger: trigger,
    ...(enable ? { github_sync_enabled: true } : {}),
  }).eq("user_id", ownerId);
  if (error) {
    console.error("Could not record GitHub sync result", error);
    throw new HubError(500, "The sync ran but its result could not be saved. Try again.");
  }
}

export async function syncAndRecord(actor: Actor, trigger: "manual" | "automatic") {
  let r: Awaited<ReturnType<typeof syncRepos>>;
  try {
    r = await syncRepos(actor);
    const queued = await syncIssueLinks(actor);
    const ideasAdded = (await syncIdeaIssues(actor)).added;
    if (ideasAdded) r = { ...r, message: `${r.message} ${ideasAdded} new GitHub issue${ideasAdded === 1 ? "" : "s"} added to Ideas.` };
    if (queued) r = { ...r, message: `${r.message} ${queued} project${queued === 1 ? " has" : "s have"} GitHub issue changes waiting in Import.` };
  } catch (e) {
    await recordSync(actor.ownerId, trigger, false, e instanceof Error ? e.message : "Sync failed", false);
    throw e;
  }
  {
    // The first successful manual sync opts the workspace into automatic sync, as in the original app.
    await recordSync(actor.ownerId, trigger, true, r.message, trigger === "manual");
    return r;
  }
}

export const REPO_PAGES = 5; // up to 500 repositories
export const ITEMS_PER_REPO = 30; // commits and pull requests checked per repository per sync
type Repo = { full_name: string; html_url: string; description: string | null; private: boolean };
export async function listRepos(actor: Actor) {
  requireOwner(actor);
  const repos: Repo[] = [];
  for (let page = 1; page <= REPO_PAGES; page++) {
    const batch = await github<Repo[]>(`/user/repos?sort=updated&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.map(r => ({ name: r.full_name, url: r.html_url, description: r.description ?? "", private: r.private }));
}

export async function syncRepos(actor: Actor) {
  requireOwner(actor);
  const state = await readState(actor.db, actor.ownerId);
  const linked = state.projects.filter(p => p.repository);
  if (!linked.length) return ok("Link a repository in a project's settings before syncing.");
  const events: { id: string; title: string; description: string; source: string; kind: string; projectId: string; url: string; createdAt: string }[] = [];
  let capped = false;
  for (const p of linked) {
    const [commits, pulls] = await Promise.all([
      github<{ sha: string; html_url: string; commit: { message: string; author: { date: string } } }[]>(`/repos/${p.repository}/commits?per_page=${ITEMS_PER_REPO}`),
      github<{ number: number; title: string; html_url: string; state: string; updated_at: string }[]>(`/repos/${p.repository}/pulls?state=all&sort=updated&direction=desc&per_page=${ITEMS_PER_REPO}`),
    ]);
    if (commits.length >= ITEMS_PER_REPO || pulls.length >= ITEMS_PER_REPO) capped = true;
    for (const c of commits) events.push({ id: `github:${p.id}:commit:${c.sha}`, title: c.commit.message.split("\n")[0]!, description: `Commit ${c.sha.slice(0, 7)} · ${p.repository}`, source: "GitHub", kind: "commit", projectId: p.id, url: c.html_url, createdAt: c.commit.author.date });
    for (const pr of pulls) events.push({ id: `github:${p.id}:pr:${pr.number}:${pr.updated_at}`, title: `PR #${pr.number}: ${pr.title}`, description: `${pr.state} · ${p.repository}`, source: "GitHub", kind: "pull_request", projectId: p.id, url: pr.html_url, createdAt: pr.updated_at });
  }
  return mutateState(actor, s => {
    let added = 0;
    for (const event of events) if (!s.activity.some(a => a.id === event.id) && s.projects.some(p => p.id === event.projectId)) { s.activity.push(event); added++; }
    s.activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (added) audit(s, actor, "GitHub activity synced", `${added} new commits and pull request updates. Task completion was not inferred.`, "", "sync");
    return ok(`Synced ${added} new updates. No repositories were changed.${capped ? ` Only the latest ${ITEMS_PER_REPO} commits and pull requests per repository were checked; older ones were skipped.` : ""}`);
  });
}

type GhIssue = { number: number; title: string; body: string | null; state: string; pull_request?: unknown };
async function repoIssues(repo: string, state: "open" | "all") {
  const list = await github<GhIssue[]>(`/repos/${repo}/issues?state=${state}&sort=updated&direction=desc&per_page=100`);
  return list.filter(i => !i.pull_request).map(i => ({ number: i.number, title: i.title, body: (i.body ?? "").slice(0, 1500), open: i.state === "open" }));
}

/** Builds a reviewable draft from a repo's description, README and open issues. No AI, no writes to GitHub. */
export async function importRepoDraft(actor: Actor, repo: string, keepSynced: boolean) {
  requireOwner(actor);
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) throw new HubError(400, "Pick a repository in owner/name format.");
  const [info, issues, readme] = await Promise.all([
    github<{ full_name: string; description: string | null; html_url: string }>(`/repos/${repo}`),
    repoIssues(repo, "open"),
    github<{ content?: string }>(`/repos/${repo}/readme`).then(r => r.content ? new TextDecoder().decode(Uint8Array.from(atob(r.content.replace(/\n/g, "")), c => c.charCodeAt(0))) : "").catch(() => ""),
  ]);
  const { createImportDraft } = await import("./operations");
  const title = info.full_name.split("/")[1]!.replace(/[-_]+/g, " ");
  return createImportDraft(actor, {
    source: "github", sourceDetail: info.full_name, repo: info.full_name, keepSynced,
    content: {
      project: { title, goal: (info.description ?? "").slice(0, 2000), description: `${info.description ?? ""}\n\n${readme}`.trim().slice(0, 20000) },
      tasks: issues.slice(0, 50).map(i => ({ title: i.title.slice(0, 200), description: `GitHub issue #${i.number}\n${i.body}`.slice(0, 4000), priority: "medium" as const, issueNumber: i.number })),
      ideas: [], handoff: null,
    },
  });
}

/** Hourly: diff linked repos' issues into pending suggestions (never applied automatically). */
async function syncIssueLinks(actor: Actor) {
  const state = await readState(actor.db, actor.ownerId);
  const links = state.githubLinks ?? [];
  if (!links.length) return 0;
  const snapshots = await Promise.all(links.map(async l => ({ projectId: l.projectId, issues: await repoIssues(l.repo, "all") })));
  const { queueSyncSuggestions } = await import("./operations");
  return mutateState(actor, s => {
    let queued = 0; const now = new Date().toISOString();
    for (const snap of snapshots) { const link = s.githubLinks?.find(l => l.projectId === snap.projectId); if (link && queueSyncSuggestions(s, link, snap.issues, now)) queued++; }
    return queued;
  });
}

/** Mirrors open issues from the chosen repo into inbox ideas (new ones only). */
export async function syncIdeaIssues(actor: Actor) {
  requireOwner(actor);
  const state = await readState(actor.db, actor.ownerId);
  const repo = state.ideaIssues?.repo;
  if (!repo) return { added: 0 };
  const list = await github<(GhIssue & { html_url: string })[]>(`/repos/${repo}/issues?state=open&sort=created&direction=desc&per_page=100`);
  const issues = list.filter(i => !i.pull_request).map(i => ({ number: i.number, title: i.title, body: i.body ?? "", url: i.html_url }));
  const { mergeIssuesIntoIdeas, emptyIdeaIssues } = await import("./idea-issues");
  const { randomUUID } = await import("./store");
  return mutateState(actor, s => {
    s.ideaIssues ??= emptyIdeaIssues();
    if (s.ideaIssues.repo !== repo) return { added: 0 };
    const added = mergeIssuesIntoIdeas(s.ideas, s.ideaIssues, issues, new Date().toISOString(), randomUUID);
    if (added) audit(s, actor, "GitHub issues added to Ideas", `${added} from ${repo}`, "", "sync");
    return { added };
  });
}

export async function setIdeaIssueRepo(actor: Actor, repo: string | null) {
  requireOwner(actor);
  const { REPO_RE, emptyIdeaIssues } = await import("./idea-issues");
  if (repo && !REPO_RE.test(repo)) throw new HubError(400, "Pick a repository in owner/name format.");
  if (repo) await github(`/repos/${repo}`);
  return mutateState(actor, s => {
    const prev = s.ideaIssues ?? emptyIdeaIssues();
    // Links are per repo; switching repos starts fresh so issue numbers can't collide.
    s.ideaIssues = prev.repo === repo ? prev : { repo, lastSyncedAt: null, links: [] };
    return ok(repo ? `Ideas will sync with ${repo}.` : "Idea issue sync turned off.");
  });
}

export async function createIssueFromIdea(actor: Actor, ideaId: string) {
  requireOwner(actor);
  const state = await readState(actor.db, actor.ownerId);
  const repo = state.ideaIssues?.repo;
  if (!repo) throw new HubError(400, "Choose a GitHub repository for ideas first.");
  const idea = state.ideas.find(i => i.id === ideaId);
  if (!idea) throw new HubError(404, "That idea no longer exists.");
  const existing = state.ideaIssues!.links.find(l => l.ideaId === ideaId);
  if (existing) return { number: existing.number, url: existing.url, created: false };
  const issue = await github<{ number: number; html_url: string }>(`/repos/${repo}/issues`, { method: "POST", body: { title: idea.title, body: `${idea.description}\n\n_Created from CarterHub._`.trim() } });
  return mutateState(actor, s => {
    if (s.ideaIssues?.repo === repo && !s.ideaIssues.links.some(l => l.number === issue.number)) s.ideaIssues.links.push({ ideaId, number: issue.number, url: issue.html_url });
    audit(s, actor, `GitHub issue #${issue.number} created`, idea.title, "", "idea");
    return { number: issue.number, url: issue.html_url, created: true };
  });
}
