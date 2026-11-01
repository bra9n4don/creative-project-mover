import { HubError, type Actor, mutateState, audit, ok, requireOwner, readState } from "./store";

// Read-only GitHub access using a token the owner stores as the GITHUB_TOKEN secret.
async function github<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new HubError(503, "GitHub isn't connected yet. Add a read-only GitHub token to enable repository sync.");
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "relay-project-hub" },
  });
  if (!response.ok) throw new HubError(response.status === 401 || response.status === 403 ? 403 : 502, `GitHub request failed (${response.status}). Check the GitHub token and its permissions.`);
  return response.json() as Promise<T>;
}

type Repo = { full_name: string; html_url: string; description: string | null; private: boolean };
export async function listRepos(actor: Actor) {
  requireOwner(actor);
  const repos = await github<Repo[]>("/user/repos?sort=updated&per_page=100");
  return repos.map(r => ({ name: r.full_name, url: r.html_url, description: r.description ?? "", private: r.private }));
}

export async function syncRepos(actor: Actor) {
  requireOwner(actor);
  const state = await readState(actor.db, actor.ownerId);
  const linked = state.projects.filter(p => p.repository);
  if (!linked.length) return ok("Link a repository in a project's settings before syncing.");
  const events: { id: string; title: string; description: string; source: string; kind: string; projectId: string; url: string; createdAt: string }[] = [];
  for (const p of linked) {
    const [commits, pulls] = await Promise.all([
      github<{ sha: string; html_url: string; commit: { message: string; author: { date: string } } }[]>(`/repos/${p.repository}/commits?per_page=10`),
      github<{ number: number; title: string; html_url: string; state: string; updated_at: string }[]>(`/repos/${p.repository}/pulls?state=all&sort=updated&direction=desc&per_page=10`),
    ]);
    for (const c of commits) events.push({ id: `github:${p.id}:commit:${c.sha}`, title: c.commit.message.split("\n")[0]!, description: `Commit ${c.sha.slice(0, 7)} · ${p.repository}`, source: "GitHub", kind: "commit", projectId: p.id, url: c.html_url, createdAt: c.commit.author.date });
    for (const pr of pulls) events.push({ id: `github:${p.id}:pr:${pr.number}:${pr.updated_at}`, title: `PR #${pr.number}: ${pr.title}`, description: `${pr.state} · ${p.repository}`, source: "GitHub", kind: "pull_request", projectId: p.id, url: pr.html_url, createdAt: pr.updated_at });
  }
  return mutateState(actor, s => {
    let added = 0;
    for (const event of events) if (!s.activity.some(a => a.id === event.id) && s.projects.some(p => p.id === event.projectId)) { s.activity.push(event); added++; }
    s.activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (added) audit(s, actor, "GitHub activity synced", `${added} new commits and pull request updates. Task completion was not inferred.`, "", "sync");
    return ok(`Synced ${added} new updates. No repositories were changed.`);
  });
}
