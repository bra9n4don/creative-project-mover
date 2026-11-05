import { useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowLeft, Pencil, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/forms";
import { Empty, ErrorBlock, LoadingBlock, Pill, field } from "@/components/kit";
import { useHubResult, useWorkspace } from "@/lib/workspace";
import { useUpdateTask, type Task } from "@/lib/hub-api";
import { taskProgress } from "@/lib/hub/timeline";
import { MilestoneSelect } from "@/components/milestone-select";

export default function ProjectTasks() {
  const { id } = useParams<{ id: string }>();
  const { state, isLoading, error, refetch, guard } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [dialog, setDialog] = useState<{ task?: Task } | null>(null);
  const update = useUpdateTask();
  const result = useHubResult();
  const project = state?.projects.find(p => p.id === id);
  const tasks = (state?.tasks ?? []).filter(t => t.projectId === id).sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || a.title.localeCompare(b.title));
  const milestones = (state?.milestones ?? []).filter(m => m.projectId === id).sort((a, b) => a.order - b.order);
  const visible = tasks.filter(t => (status === "all" || t.status === status) && t.title.toLowerCase().includes(query.toLowerCase()));
  if (isLoading) return <AppShell><LoadingBlock /></AppShell>;
  if (error || !state) return <AppShell><ErrorBlock error={error} onRetry={refetch} /></AppShell>;
  if (!project) return <AppShell><Empty icon={<Search className="h-5 w-5" />} title="Project not found" body=""><Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button></Empty></AppShell>;
  return <AppShell>
    <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Dashboard</Link>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="break-words font-display text-3xl font-semibold">{project.title}</h1><p className="mt-2 text-sm text-muted-foreground">Tasks · {tasks.length} total</p></div>
      <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/projects/${id}`}>Project & timeline</Link></Button><Button asChild variant="outline"><Link href={`/projects/${id}/roadmap`}>Roadmap</Link></Button><Button onClick={() => guard("Adding tasks needs your own workspace.", () => setDialog({}))}><Plus />Task</Button></div>
    </header>
    <div className="my-6 flex flex-wrap gap-3">
      <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search tasks" className={`${field} pl-9`} placeholder="Search tasks" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <select aria-label="Filter task status" className={`${field} w-auto max-w-full`} value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{["todo", "in_progress", "blocked", "done", "verified"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
    </div>
    <div className="hidden grid-cols-[minmax(0,2fr)_140px_140px_minmax(120px,1fr)_40px] gap-4 border-b pb-3 text-xs text-muted-foreground lg:grid"><span>Task</span><span>Due date</span><span>Status</span><span>Progress</span><span /></div>
    <ul className="divide-y border-b">
      {visible.map(t => {
        const pct = taskProgress(t);
        return <li key={t.id} className="grid min-w-0 gap-3 py-4 lg:grid-cols-[minmax(0,2fr)_140px_140px_minmax(120px,1fr)_40px] lg:items-center lg:gap-4">
          <div className="min-w-0"><Link href={`/projects/${id}/tasks/${t.id}`} data-testid={`link-task-${t.id}`} className="break-words font-medium hover:underline">{t.title}</Link>{t.description && <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">{t.description}</p>}
            {milestones.length > 0 && <MilestoneSelect task={t} milestones={milestones} />}</div>
          <div className="text-sm"><span className="mr-2 text-xs text-muted-foreground lg:hidden">Due</span>{t.dueDate ? <time dateTime={t.dueDate}>{new Date(`${t.dueDate}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time> : <span className="text-muted-foreground">No due date</span>}</div>
          <div>{t.status === "verified" ? <Pill value={t.status} /> : <select aria-label={`Status of ${t.title}`} className="max-w-full rounded-md border bg-background px-2 py-2 text-xs" value={t.status} disabled={update.isPending} onChange={e => guard("Updating tasks needs your own workspace.", () => update.mutate({ id: t.id, data: { status: e.target.value as Task["status"], expectedVersion: t.version } }, result("Task updated")))}>{["todo", "in_progress", "blocked", "done"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>}</div>
          <div className="flex items-center gap-3"><div role="progressbar" aria-label={`Progress of ${t.title}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted"><div className={t.status === "blocked" ? "h-full bg-destructive" : "h-full bg-accent"} style={{ width: `${pct}%` }} /></div><span className="w-10 text-right font-mono text-xs text-muted-foreground">{pct}%</span></div>
          <Button variant="ghost" size="icon" aria-label={`Edit ${t.title}`} title="Edit task" onClick={() => guard("Editing tasks needs your own workspace.", () => setDialog({ task: t }))}><Pencil /></Button>
        </li>;
      })}
    </ul>
    {!visible.length && <Empty icon={<Search className="h-5 w-5" />} title={tasks.length ? "No matching tasks" : "No tasks yet"} body="" />}
    <TaskDialog open={dialog !== null} onOpenChange={open => !open && setDialog(null)} task={dialog?.task} projectId={id} siblings={tasks} />
  </AppShell>;
}