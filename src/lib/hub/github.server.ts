import { HubError, type Actor, mutateState, audit, ok, requireOwner, readState } from "./store";

// Read-only GitHub access through the linked GitHub connection (credentials never reach the browser).
const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";
async function github<T>(path: string): Promise<T> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const githubKey = process.env.GITHUB_API_KEY;
  if (!lovableKey || !githubKey) throw new HubError(503, "GitHub isn't connected yet. Connect GitHub to enable repository sync.");
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": githubKey, Accept: "application/vnd.github+json" },
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
  await supabaseAdmin.from("hub_owner").update({
    last_sync_at: new Date().toISOString(), last_sync_ok: ok, last_sync_message: message, last_sync_trigger: trigger,
    ...(enable ? { github_sync_enabled: true } : {}),
  }).eq("user_id", ownerId);
}

export async function syncAndRecord(actor: Actor, trigger: "manual" | "automatic") {
  try {
    const r = await syncRepos(actor);
    // The first successful manual sync opts the workspace into automatic sync, as in the original app.
    await recordSync(actor.ownerId, trigger, true, r.message, trigger === "manual");
    return r;
  } catch (e) {
    await recordSync(actor.ownerId, trigger, false, e instanceof Error ? e.message : "Sync failed", false);
    throw e;
  }
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
