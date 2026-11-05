import type { MilestoneProgress } from "@/lib/hub/milestones";

/** Done/total task bar for a milestone; shows "No tasks yet" instead of a bar when it has none. */
export function MilestoneBar({ m, pr, className = "" }: { m: { title: string }; pr: MilestoneProgress; className?: string }) {
  if (!pr.total) return <p className={`text-xs text-muted-foreground ${className}`}>No tasks yet</p>;
  return <div className={`flex items-center gap-3 ${className}`}>
    <div role="progressbar" aria-label={`Progress of ${m.title}`} aria-valuenow={pr.percent} aria-valuemin={0} aria-valuemax={100} className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted"><div className={pr.overdue ? "h-full bg-destructive" : "h-full bg-accent"} style={{ width: `${pr.percent}%` }} /></div>
    <span className="shrink-0 font-mono text-xs text-muted-foreground">{pr.done}/{pr.total} · {pr.percent}%</span>
  </div>;
}
