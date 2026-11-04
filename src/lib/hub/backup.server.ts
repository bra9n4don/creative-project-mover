import type { HubState } from "./store";
import { BACKUP_REPO_NAME, backupFiles, gitBlobSha, toBase64 } from "./backup";

// Pushes projects, ideas and checkpoints to a PRIVATE GitHub repo through the linked GitHub connection.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";

async function gh(path: string, init: { method?: string; body?: unknown } = {}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const githubKey = process.env.GITHUB_API_KEY;
  if (!lovableKey || !githubKey) throw new Error("GitHub isn't connected.");
  return fetch(`${GATEWAY_URL}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": githubKey, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
}
async function fail(res: Response, what: string): Promise<never> {
  const body = await res.text();
  console.error(`GitHub backup ${what} failed [${res.status}]: ${body}`);
  throw new Error(`${what} failed (GitHub ${res.status}).`);
}

/** Finds or creates the private backup repo; refuses to push into a public one. */
async function ensureRepo(): Promise<string> {
  const me = await gh("/user");
  if (!me.ok) await fail(me, "Reading your GitHub account");
  const { login } = await me.json() as { login: string };
  const full = `${login}/${BACKUP_REPO_NAME}`;
  let repo = await gh(`/repos/${full}`);
  if (repo.status === 404) {
    const made = await gh("/user/repos", { method: "POST", body: { name: BACKUP_REPO_NAME, private: true, auto_init: true, description: "Private backup of my Relay workspace" } });
    if (!made.ok) await fail(made, "Creating the private backup repo");
    repo = made;
  } else if (!repo.ok) await fail(repo, "Opening the backup repo");
  const info = await repo.json() as { private: boolean; full_name: string };
  if (!info.private) throw new Error(`${info.full_name} is public, so Relay won't back up into it. Make it private on GitHub.`);
  return info.full_name;
}

async function putFile(repo: string, path: string, content: string, sha: string | undefined) {
  const send = (s?: string) => gh(`/repos/${repo}/contents/${path}`, { method: "PUT", body: { message: `Relay backup: ${path}`, content: toBase64(content), ...(s ? { sha: s } : {}) } });
  let res = await send(sha);
  if (res.status === 409 || res.status === 422) {
    // Our remembered version is out of date (or the file is new on an existing repo): read the current one and retry once.
    const cur = await gh(`/repos/${repo}/contents/${path}`);
    res = await send(cur.ok ? ((await cur.json()) as { sha: string }).sha : undefined);
  }
  if (!res.ok) await fail(res, `Saving ${path}`);
}

export async function pushBackup(ownerId: string, state: HubState, opts: { force?: boolean } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const record = (ok: boolean, message: string, extra: Record<string, unknown> = {}) =>
    supabaseAdmin.from("hub_owner").update({ last_backup_at: new Date().toISOString(), last_backup_ok: ok, last_backup_message: message, ...extra }).eq("user_id", ownerId);
  if (!process.env.LOVABLE_API_KEY || !process.env.GITHUB_API_KEY) return { ok: false, message: "GitHub isn't connected." };
  const { data: owner } = await supabaseAdmin.from("hub_owner").select("backup_repo, backup_shas").eq("user_id", ownerId).maybeSingle();
  const known = (owner?.backup_shas ?? {}) as Record<string, string>;
  try {
    const files = backupFiles(state);
    const shas: Record<string, string> = {};
    for (const [p, c] of Object.entries(files)) shas[p] = await gitBlobSha(c);
    const changed = Object.keys(files).filter(p => opts.force || shas[p] !== known[p]);
    if (!changed.length && owner?.backup_repo) return { ok: true, message: "Already up to date." };
    const repo = owner?.backup_repo ?? await ensureRepo();
    for (const p of changed) await putFile(repo, p, files[p]!, known[p]);
    const message = `Backed up ${state.projects.length} projects, ${state.ideas.length} ideas, ${state.handoffs.length} checkpoints.`;
    await record(true, message, { backup_repo: repo, backup_shas: { ...known, ...shas } });
    return { ok: true, message, repo };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Backup failed.";
    // A remembered repo that disappeared or turned public is forgotten so the next save starts fresh.
    await record(false, message, /public|404/.test(message) ? { backup_repo: null, backup_shas: {} } : {});
    return { ok: false, message };
  }
}
