import { useEffect, useState } from "react";
import { useBlocker, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search, Trash2 } from "lucide-react";
import { Link, useParams } from "@/lib/router-compat";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Empty, ErrorBlock, LoadingBlock, Pill, field } from "@/components/kit";
import { errMessage, useWorkspace } from "@/lib/workspace";
import { useDeleteTask, useUpdateTask, type Task } from "@/lib/hub-api";
import { taskProgress } from "@/lib/hub/timeline";
import { milestoneProgress } from "@/lib/hub/milestones";
import { ChatSourceLink, useChatSources } from "@/components/chat/chat-source-link";
import { isTaskOverdue } from "@/lib/hub/task-due";

type Draft = { title: string; description: string; status: Task["status"]; priority: Task["priority"]; dueDate: string; milestoneId: string };
const toDraft = (t: Task): Draft => ({ title: t.title, description: t.description, status: t.status, priority: t.priority, dueDate: t.dueDate ?? "", milestoneId: t.milestoneId ?? "" });
const fmt = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function TaskDetail() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const { state, isLoading, error, refetch, guard } = useWorkspace();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const navigate = useNavigate();
  const task = state?.tasks.find(t => t.id === taskId);
  const sources = useChatSources();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  useEffect(() => { if (task && !draft) setDraft(toDraft(task)); }, [task, draft]);
  const dirty = !!task && !!draft && JSON.stringify(draft) !== JSON.stringify(toDraft(task));
  useBlocker({ shouldBlockFn: () => dirty && !window.confirm("Discard your unsaved changes?"), enableBeforeUnload: () => dirty });

  if (isLoading) return <AppShell><LoadingBlock /></AppShell>;
  if (error || !state) return <AppShell><ErrorBlock error={error} onRetry={refetch} /></AppShell>;
  const back = <Link href={`/projects/${id}/tasks`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back to tasks</Link>;
  if (!task || !draft) return <AppShell>{back}<Empty icon={<Search className="h-5 w-5" />} title="Task not found" body="It may have been deleted." /></AppShell>;

  const project = state.projects.find(p => p.id === task.projectId);
  const milestones = (state.milestones ?? []).filter(m => m.projectId === task.projectId).sort((a, b) => a.order - b.order);
  const milestone = milestones.find(m => m.id === task.milestoneId);
  const mp = milestone ? milestoneProgress(milestone, state.tasks) : null;
  const deps = task.dependencies.map(d => state.tasks.find(t => t.id === d)).filter((t): t is Task => !!t);
  const pct = taskProgress(task);
  const overdue = isTaskOverdue(task);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft({ ...draft, [k]: v }); setMsg(null); };

  const save = () => guard("Editing tasks needs your own workspace.", () => {
    if (!draft.title.trim()) { setMsg({ kind: "err", text: "Give the task a title." }); return; }
    update.mutate({ id: task.id, data: { expectedVersion: task.version, title: draft.title.trim(), description: draft.description, priority: draft.priority, dueDate: draft.dueDate || null, milestoneId: draft.milestoneId || null, ...(draft.status !== task.status && task.status !== "verified" ? { status: draft.status } : {}) } as never }, {
      onSuccess: () => { setDraft(null); setMsg({ kind: "ok", text: "Saved." }); },
      onError: e => { const m = errMessage(e); setMsg({ kind: "err", text: /version|changed|conflict/i.test(m) ? "This task changed, reload to see the latest." : m }); },
    });
  });
  const remove = () => guard("Deleting tasks needs your own workspace.", () => {
    if (!window.confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    setDraft(toDraft(task));
    del.mutate({ id: task.id } as never, { onSuccess: () => void navigate({ to: "/projects/$id/tasks", params: { id } }), onError: e => setMsg({ kind: "err", text: errMessage(e) }) });
  });

  return <AppShell>
    {back}
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">{project?.title}<ChatSourceLink id={task.id} sources={sources} /></p><h1 className="break-words font-display text-3xl font-semibold">{task.title}</h1></div>
      <div className="flex flex-wrap items-center gap-2"><Pill value={task.status} />{overdue && <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Overdue</span>}</div>
    </header>
    <div className="mt-4 flex items-center gap-3"><div role="progressbar" aria-label="Task progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 flex-1 overflow-hidden rounded-sm bg-muted"><div className={task.status === "blocked" ? "h-full bg-destructive" : "h-full bg-accent"} style={{ width: `${pct}%` }} /></div><span className="font-mono text-xs text-muted-foreground">{pct}%</span></div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="space-y-4 rounded-xl border bg-card p-4" aria-label="Edit task">
        <label className="block text-sm"><span className="text-muted-foreground">Title</span><input data-testid="input-task-title" className={`${field} mt-1`} value={draft.title} onChange={e => set("title", e.target.value)} /></label>
        <label className="block text-sm"><span className="text-muted-foreground">Description</span><textarea className={`${field} mt-1 min-h-28`} value={draft.description} onChange={e => set("description", e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm"><span className="text-muted-foreground">Status</span>
            <select className={`${field} mt-1`} value={draft.status} disabled={task.status === "verified"} onChange={e => set("status", e.target.value as Task["status"])}>{(task.status === "verified" ? ["verified"] : ["todo", "in_progress", "blocked", "done"]).map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></label>
          <label className="block text-sm"><span className="text-muted-foreground">Priority</span>
            <select className={`${field} mt-1`} value={draft.priority} onChange={e => set("priority", e.target.value as Task["priority"])}>{["low", "medium", "high"].map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="block text-sm"><span className="text-muted-foreground">Due date</span>
            <div className="mt-1 flex gap-2"><input type="date" data-testid="input-task-due" className={field} value={draft.dueDate} onChange={e => set("dueDate", e.target.value)} />{draft.dueDate && <Button variant="outline" size="sm" className="h-auto" onClick={() => set("dueDate", "")}>Clear</Button>}</div></label>
          <label className="block text-sm"><span className="text-muted-foreground">Milestone</span>
            <select className={`${field} mt-1`} value={draft.milestoneId} onChange={e => set("milestoneId", e.target.value)}><option value="">Not in a milestone</option>{milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
        </div>
        {msg && <p className={`text-sm ${msg.kind === "err" ? "text-destructive" : "text-muted-foreground"}`}>{msg.text}{msg.kind === "err" && /reload/.test(msg.text) && <button className="ml-2 underline" onClick={() => { void refetch(); setDraft(null); setMsg(null); }}>Reload</button>}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={!dirty || update.isPending} data-testid="button-task-save">{update.isPending ? "Saving…" : "Save"}</Button>
          <Button variant="outline" disabled={!dirty} onClick={() => { setDraft(toDraft(task)); setMsg(null); }}>Cancel</Button>
          <Button variant="ghost" className="ml-auto text-destructive" onClick={remove} disabled={del.isPending}><Trash2 />Delete task</Button>
        </div>
      </section>

      <aside className="space-y-4 text-sm">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Roadmap</h2>
          {milestone && mp ? <>
            <p className="mt-2 font-medium">{milestone.title}</p>
            <p className="text-muted-foreground">{milestone.targetDate ? `Target ${fmt(milestone.targetDate)}` : "No target date"}{mp.overdue ? " · Overdue" : mp.complete ? " · Done" : ""}</p>
            <div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted"><div className="h-full bg-accent" style={{ width: `${mp.percent}%` }} /></div><span className="font-mono text-xs text-muted-foreground">{mp.done}/{mp.total}</span></div>
          </> : <p className="mt-2 text-muted-foreground">Not in a milestone.</p>}
          <Link href={`/projects/${task.projectId}/roadmap`} className="mt-3 inline-block text-primary underline-offset-2 hover:underline">Open roadmap</Link>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">Dates</h2>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Due</dt><dd>{task.dueDate ? fmt(task.dueDate) : "None"}</dd>
            <dt className="text-muted-foreground">Started</dt><dd>{task.startedAt ? fmt(task.startedAt) : "Not recorded"}</dd>
            <dt className="text-muted-foreground">Finished</dt><dd>{task.completedAt ? fmt(task.completedAt) : "Not recorded"}</dd>
          </dl>
        </div>
        {deps.length > 0 && <div className="rounded-xl border bg-card p-4"><h2 className="font-semibold">Depends on</h2><ul className="mt-2 space-y-1">{deps.map(d => <li key={d.id}><Link href={`/projects/${d.projectId}/tasks/${d.id}`} className="text-primary underline-offset-2 hover:underline">{d.title}</Link></li>)}</ul></div>}
      </aside>
    </div>
  </AppShell>;
}
