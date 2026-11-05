import { useHubResult, useWorkspace } from "@/lib/workspace";
import { useUpdateTask, type Task } from "@/lib/hub-api";
import type { Milestone } from "@/lib/hub/milestones";

/** Small picker that assigns a task to a roadmap milestone (or none). */
export function MilestoneSelect({ task, milestones }: { task: Task; milestones: Milestone[] }) {
  const { guard } = useWorkspace();
  const update = useUpdateTask();
  const result = useHubResult();
  return (
    <select aria-label={`Milestone for ${task.title}`} className="mt-2 max-w-full rounded-md border bg-background px-2 py-1 text-xs" value={task.milestoneId ?? ""} disabled={update.isPending}
      onChange={e => guard("Updating tasks needs your own workspace.", () => update.mutate({ id: task.id, data: { expectedVersion: task.version, milestoneId: e.target.value || null } }, result("Milestone updated")))}>
      <option value="">Not in a milestone</option>
      {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
    </select>
  );
}
