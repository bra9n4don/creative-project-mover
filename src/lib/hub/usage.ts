import type { HubState } from "@/lib/hub/store";

export type AssistantUsage = { source: string; checkpoints: number; tasks: number; ideas: number; total: number; lastActive: string | null };

/** Your own saves are labelled "You…"; everything else came from a connected assistant. */
export const isAssistantSource = (s: string | undefined) => !!s && !/^you\b/i.test(s.trim());

/** Count checkpoints, tasks and ideas saved by each connected assistant, most active first. */
export function assistantUsage(s: Pick<HubState, "handoffs" | "tasks" | "ideas">): AssistantUsage[] {
  const map = new Map<string, AssistantUsage>();
  const bump = (source: string | undefined, key: "checkpoints" | "tasks" | "ideas", at: string) => {
    if (!isAssistantSource(source)) return;
    const name = source!.trim();
    const u = map.get(name) ?? { source: name, checkpoints: 0, tasks: 0, ideas: 0, total: 0, lastActive: null };
    u[key]++; u.total++;
    if (!u.lastActive || at > u.lastActive) u.lastActive = at;
    map.set(name, u);
  };
  for (const h of s.handoffs) bump(h.source, "checkpoints", h.createdAt);
  for (const t of s.tasks) bump(t.agent, "tasks", t.createdAt);
  for (const i of s.ideas) bump(i.source, "ideas", i.createdAt);
  return [...map.values()].sort((a, b) => b.total - a.total || a.source.localeCompare(b.source));
}
