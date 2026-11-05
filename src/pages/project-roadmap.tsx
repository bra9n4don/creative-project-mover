import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router-compat";
import { ArrowDown, ArrowLeft, ArrowUp, Flag, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Empty, ErrorBlock, LoadingBlock, Pill, field } from "@/components/kit";
import { MilestoneSelect } from "@/components/milestone-select";
import { askDock } from "@/components/chat/chat-window";
import { useHubResult, useWorkspace } from "@/lib/workspace";
import { useCreateMilestone, useDeleteMilestone, useReorderMilestones, useUpdateMilestone, type Task } from "@/lib/hub-api";
import { milestoneProgress, type Milestone } from "@/lib/hub/milestones";

const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function ProjectRoadmap() {
  const { id } = useParams<{ id: string }>();
  const { state, isLoading, error, refetch, guard } = useWorkspace();
  const create = useCreateMilestone();
  const reorder = useReorderMilestones();
  const result = useHubResult();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  if (isLoading) return <AppShell><LoadingBlock /></AppShell>;
  if (error || !state) return <AppShell><ErrorBlock error={error} onRetry={refetch} /></AppShell>;
  const project = state.projects.find(p => p.id === id);
  if (!project) return <AppShell><Empty icon={<Search className="h-5 w-5" />} title="Project not found" body=""><Button asChild variant="outline"><Link href="/projects">Projects</Link></Button></Empty></AppShell>;
  const tasks = state.tasks.filter(t => t.projectId === id);
  const milestones = (state.milestones ?? []).filter(m => m.projectId === id).sort((a, b) => a.order - b.order);
  const loose = tasks.filter(t => !t.milestoneId || !milestones.some(m => m.id === t.milestoneId));
  const move = (i: number, dir: -1 | 1) => {
    const ids = milestones.map(m => m.id);
    const j = i + dir; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    guard("Editing the roadmap needs your own workspace.", () => reorder.mutate({ data: { projectId: id, ids } }, result("Order saved")));
  };
  const add = () => {
    if (!title.trim()) return;
    guard("Editing the roadmap needs your own workspace.", () => create.mutate({ data: { projectId: id, title: title.trim(), targetDate: target || null } }, result("Milestone added", () => { setTitle(""); setTarget(""); })));
  };
  const suggest = () => askDock(`Look at the roadmap for "${project.title}". What are the next steps? Suggest tasks for the right milestones, and any milestone or target-date changes.`);

  return <AppShell>
    <Link href={`/projects/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />{project.title}</Link>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0"><h1 className="break-words font-display text-3xl font-semibold">Roadmap</h1><p className="mt-2 text-sm text-muted-foreground">{project.title} · {milestones.length} milestone{milestones.length === 1 ? "" : "s"}</p></div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><Link href={`/projects/${id}/tasks`}>Tasks</Link></Button>
        <Button variant="secondary" onClick={suggest} data-testid="button-roadmap-suggest"><Sparkles />Suggest next steps</Button>
      </div>
    </header>

    <div className="mt-6 flex flex-wrap gap-2 rounded-xl border bg-card p-3">
      <input aria-label="New milestone title" className={`${field} min-w-0 flex-1`} placeholder="New milestone, e.g. Working prototype" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} data-testid="input-milestone-title" />
      <input aria-label="Target date" type="date" className={`${field} w-auto`} value={target} onChange={e => setTarget(e.target.value)} />
      <Button onClick={add} disabled={!title.trim() || create.isPending} data-testid="button-add-milestone"><Plus />Add milestone</Button>
    </div>

    {!milestones.length && <Empty icon={<Flag className="h-5 w-5" />} title="No milestones yet" body="Add a milestone above, or finish a Kickoff plan to fill this in. You can also ask the AI to suggest some." />}
    <ol className="mt-6 space-y-4" data-testid="list-milestones">
      {milestones.map((m, i) => <MilestoneCard key={m.id} m={m} tasks={tasks} all={milestones} first={i === 0} last={i === milestones.length - 1} onMove={dir => move(i, dir)} />)}
    </ol>

    {loose.length > 0 && <section className="mt-8">
      <h2 className="font-display text-lg font-semibold">Not in a milestone <span className="text-sm font-normal text-muted-foreground">{loose.length}</span></h2>
      <ul className="mt-3 divide-y rounded-xl border">
        {loose.map(t => <TaskRow key={t.id} t={t} milestones={milestones} />)}
      </ul>
    </section>}
  </AppShell>;
}

function TaskRow({ t, milestones }: { t: Task; milestones: Milestone[] }) {
  return <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
    <Link href={`/projects/${t.projectId}/tasks/${t.id}`} className="min-w-0 break-words hover:underline">{t.title}</Link>
    <span className="flex items-center gap-2"><Pill value={t.status} />{milestones.length > 0 && <MilestoneSelect task={t} milestones={milestones} />}</span>
  </li>;
}

function MilestoneCard({ m, tasks, all, first, last, onMove }: { m: Milestone; tasks: Task[]; all: Milestone[]; first: boolean; last: boolean; onMove: (dir: -1 | 1) => void }) {
  const { guard } = useWorkspace();
  const update = useUpdateMilestone();
  const remove = useDeleteMilestone();
  const result = useHubResult();
  const [title, setTitle] = useState(m.title);
  // Keep the heading in step with saves from elsewhere (e.g. an approved chat suggestion).
  useEffect(() => { setTitle(m.title); }, [m.title]);
  const pr = milestoneProgress(m, tasks);
  const mine = tasks.filter(t => t.milestoneId === m.id);
  const save = (patch: { title?: string; targetDate?: string | null; outcome?: string }) =>
    guard("Editing the roadmap needs your own workspace.", () => update.mutate({ id: m.id, data: { expectedVersion: m.version, ...patch } }, result("Milestone saved")));
  return <li className="rounded-xl border bg-card p-4" data-testid="milestone-card">
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label="Milestone title" className="min-w-0 flex-1 bg-transparent font-display text-lg font-semibold outline-none focus:underline" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title.trim() && title.trim() !== m.title && save({ title: title.trim() })} />
      {pr.complete && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium">Done</span>}
      {pr.overdue && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Overdue</span>}
      <input aria-label={`Target date for ${m.title}`} type="date" className="rounded-md border bg-background px-2 py-1 text-xs" value={m.targetDate ?? ""} onChange={e => save({ targetDate: e.target.value || null })} />
      <Button variant="ghost" size="icon" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}><ArrowUp /></Button>
      <Button variant="ghost" size="icon" aria-label="Move down" disabled={last} onClick={() => onMove(1)}><ArrowDown /></Button>
      <Button variant="ghost" size="icon" aria-label={`Delete ${m.title}`} onClick={() => window.confirm(`Delete "${m.title}"? Its tasks are kept.`) && guard("Editing the roadmap needs your own workspace.", () => remove.mutate({ id: m.id }, result("Milestone deleted")))}><Trash2 /></Button>
    </div>
    {m.outcome && <p className="mt-1 text-sm text-muted-foreground">{m.outcome}</p>}
    <div className="mt-3 flex items-center gap-3">
      <div role="progressbar" aria-label={`Progress of ${m.title}`} aria-valuenow={pr.percent} aria-valuemin={0} aria-valuemax={100} className="h-2 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted"><div className={pr.overdue ? "h-full bg-destructive" : "h-full bg-accent"} style={{ width: `${pr.percent}%` }} /></div>
      <span className="font-mono text-xs text-muted-foreground">{pr.done}/{pr.total} · {pr.percent}%</span>
    </div>
    <p className="mt-1 text-xs text-muted-foreground">{m.targetDate ? `Target ${fmt(m.targetDate)}` : "No target date"}</p>
    {mine.length > 0 && <ul className="mt-3 divide-y rounded-lg border">{mine.map(t => <TaskRow key={t.id} t={t} milestones={all} />)}</ul>}
  </li>;
}
