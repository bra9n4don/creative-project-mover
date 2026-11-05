import type { Task } from "@/lib/hub-api";
import { projectTimeline } from "@/lib/hub/timeline";
import { Pill } from "@/components/kit";
import { CalendarDays } from "lucide-react";

const dateLabel = (value: number) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function ProjectTimeline({ tasks }: { tasks: Task[] }) {
  const now = Date.now();
  const { rows, min, max } = projectTimeline(tasks, now);
  const position = (value: number) => Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <section className="mt-8 min-w-0" aria-labelledby="project-timeline-title">
      <h2 id="project-timeline-title" className="flex items-center gap-2 font-display text-xl font-semibold"><CalendarDays className="h-5 w-5 text-primary" />Task timeline</h2>
      {!rows.length ? <p className="mt-3 text-sm text-muted-foreground">No tasks yet.</p> : <>
        <div className="mt-4 hidden grid-cols-[minmax(180px,1fr)_minmax(260px,2fr)] gap-6 border-b pb-2 text-xs text-muted-foreground md:grid">
          <span>Task · actual dates</span><div className="flex justify-between"><span>{dateLabel(min)}</span><span>{dateLabel(max)}</span></div>
        </div>
        <ol className="divide-y">
          {rows.map(({ task, start, end, progress }) => {
            const closed = task.status === "done" || task.status === "verified";
            const finish = end ?? (closed ? start : now);
            return <li key={task.id} className="grid min-w-0 gap-3 py-4 md:grid-cols-[minmax(180px,1fr)_minmax(260px,2fr)] md:gap-6">
              <div className="min-w-0">
                <div className="break-words font-medium">{task.title}</div>
                <div className="mt-1"><Pill value={task.status} /></div>
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div><dt className="inline">Start: </dt><dd className="inline">{start !== undefined ? dateLabel(start) : task.status === "todo" ? "Not started" : "Not recorded"}</dd></div>
                  <div><dt className="inline">End: </dt><dd className="inline">{end !== undefined ? dateLabel(end) : closed ? "Not recorded" : "—"}</dd></div>
                </dl>
              </div>
              <div className="min-w-0 self-center">
                <div className="relative mb-3 h-5 border-x border-border bg-secondary/40" aria-label={`Actual duration of ${task.title}`}>
                  {start !== undefined && finish !== undefined ? <div className="absolute top-1 h-3 min-w-1 rounded-sm bg-primary/40" style={{ left: `${Math.min(99, position(start))}%`, width: `${Math.max(0, position(finish) - position(start))}%` }} /> : end !== undefined ? <div className="absolute top-1 h-3 w-1 bg-primary" style={{ left: `${Math.min(99, position(end))}%` }} /> : <span className="px-2 text-xs text-muted-foreground">{task.status === "todo" ? "Not started" : "Dates not recorded"}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <div role="progressbar" aria-label={`Progress of ${task.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 flex-1 overflow-hidden rounded-sm bg-secondary">
                    <div className={task.status === "blocked" ? "h-full bg-destructive" : "h-full bg-accent"} style={{ width: `${progress}%` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-xs text-muted-foreground">{progress}%</span>
                </div>
              </div>
            </li>;
          })}
        </ol>
      </>}
    </section>
  );
}