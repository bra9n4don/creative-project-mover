import { vi } from "vitest";
import { emptyState, type Actor, type HubDb, type HubState } from "@/lib/hub/store";

export const fixtureProject = (id = "p", updatedAt = "2026-11-05T10:00:00Z"): HubState["projects"][number] => ({
  id, title: id, description: "private project description", goal: "Goal", status: "active", priority: "medium", repository: "", color: "", version: 7, createdAt: updatedAt, updatedAt,
});
export const fixtureTask = (id = "t", projectId = "p"): HubState["tasks"][number] => ({
  id, projectId, title: id, description: "", status: "todo", priority: "medium", agent: "", evidence: "", dependencies: [], version: 3, createdAt: "2026-11-05", updatedAt: "2026-11-05",
});

/** Only an in-memory workspace: no clients, credentials, fetches or database connections. */
export function memoryWorkspace(initial = emptyState(), conflicts = 0) {
  let row = { data: structuredClone(initial), rev: 1 };
  const update = vi.fn();
  const db = { from: vi.fn((table: string) => {
    if (table !== "hub_workspaces") throw new Error(`Unexpected mocked table: ${table}`);
    let patch: typeof row | undefined;
    let expectedRev: number | undefined;
    const q = {
      select: () => q,
      eq: (column: string, value: unknown) => { if (column === "rev") expectedRev = Number(value); return q; },
      maybeSingle: async () => ({ data: structuredClone(row), error: null }),
      update: (value: typeof row) => { update(value); patch = value; return q; },
      then: (resolve: (result: { data: object[]; error: null }) => unknown) => {
        if (conflicts > 0) { conflicts--; row.rev++; return resolve({ data: [], error: null }); }
        if (patch && expectedRev === row.rev) { row = structuredClone(patch); return resolve({ data: [{ owner_id: "synthetic-owner" }], error: null }); }
        return resolve({ data: [], error: null });
      },
    };
    return q;
  }) };
  const actor: Actor = { db: db as unknown as HubDb, ownerId: "synthetic-owner", source: "Synthetic test", agent: false };
  return { actor, update, get state() { return structuredClone(row.data); } };
}