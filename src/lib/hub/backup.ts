import type { HubState } from "./store";

export const BACKUP_REPO_NAME = "relay-workspace";

/** Files pushed to the private backup repo. Activity is left out so routine saves don't create empty commits. */
export function backupFiles(s: HubState): Record<string, string> {
  const data = {
    projects: s.projects,
    tasks: s.tasks,
    ideas: s.ideas,
    checkpoints: s.handoffs,
  };
  const name = (id: string) => s.projects.find(p => p.id === id)?.title ?? "Unknown project";
  const md = [
    "# Relay workspace backup",
    "",
    `## Projects (${s.projects.length})`,
    ...s.projects.map(p => `- **${p.title}** (${p.status}, ${p.priority})${p.goal ? ` — ${p.goal}` : ""}`),
    "",
    `## Ideas (${s.ideas.length})`,
    ...s.ideas.map(i => `- ${i.title}`),
    "",
    `## Checkpoints (${s.handoffs.length})`,
    ...s.handoffs.map(h => `- ${h.createdAt.slice(0, 10)} · ${name(h.projectId)} · **${h.title}**${h.nextAction ? ` — next: ${h.nextAction}` : ""}`),
    "",
  ].join("\n");
  return { "workspace.json": JSON.stringify(data, null, 2) + "\n", "workspace.md": md };
}

/** Git blob SHA-1, so unchanged files are skipped without asking GitHub. */
export async function gitBlobSha(content: string): Promise<string> {
  const body = new TextEncoder().encode(content);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head); all.set(body, head.length);
  const hash = await crypto.subtle.digest("SHA-1", all);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
