import { useMemo } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowUpRight, CheckCircle2, Clock3, FolderKanban, ListChecks, RotateCw } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Empty, ErrorBlock, LoadingBlock, PageHeader, Pill } from "@/components/kit";
import { useWorkspace } from "@/lib/workspace";
import { dashboardData } from "@/lib/hub/dashboard";

type Props = { days: 7 | 30; projectId: string; onDays: (days: 7 | 30) => void; onProject: (id: string) => void };

export default function DashboardPage({ days, projectId, onDays, onProject }: Props) {
  const { state, isLoading, error, refetch } = useWorkspace();
  const data = useMemo(() => state ? dashboardData(state.projects.filter(p => !projectId || p.id === projectId), state.tasks, days, new Date()) : null, [state, days, projectId]);
  const maxDaily = Math.max(1, ...(data?.daily.map(d => Math.max(d.added, d.updated)) ?? []));
  const maxInactive = Math.max(1, ...(data?.rows.map(r => r.inactive) ?? []));
  return (
    <AppShell>
      <PageHeader eyebrow="CarterHub" title="Project dashboard">
        <Button variant="outline" size="icon" onClick={refetch} aria-label="Refresh dashboard" title="Refresh dashboard"><RotateCw /></Button>
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="dashboard-project" className="text-sm text-muted-foreground">Project</label>
          <select id="dashboard-project" value={projectId} onChange={e => onProject(e.target.value)} className="max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-72">
            <option value="">All projects</option>
            {state?.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div className="flex gap-1 rounded-md border p-1" role="group" aria-label="Chart date range">
          {([7, 30] as const).map(n => <Button key={n} size="sm" variant={days === n ? "secondary" : "ghost"} aria-pressed={days === n} onClick={() => onDays(n)}>{n} days</Button>)}
        </div>
      </div>
      {isLoading ? <LoadingBlock /> : error || !state || !data ? <ErrorBlock error={error} onRetry={refetch} /> : !state.projects.length ? (
        <Empty icon={<FolderKanban className="h-5 w-5" />} title="No projects yet" body="">
          <Button asChild><Link href="/projects">Projects <ArrowUpRight /></Link></Button>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Projects", value: data.rows.length, detail: `${data.rows.filter(r => r.project.status === "active").length} active`, icon: FolderKanban, tone: "text-primary" },
              { label: "Task progress", value: `${data.pct}%`, detail: `${data.done} of ${data.total} finished`, icon: CheckCircle2, tone: "text-accent" },
              { label: "Open tasks", value: data.open, detail: `${data.total} tasks total`, icon: ListChecks, tone: "text-foreground" },
              { label: "Inactive tasks", value: data.inactive, detail: "Unchanged for 7+ days", icon: Clock3, tone: "text-destructive" },
            ].map(metric => <div key={metric.label} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">{metric.label}<metric.icon className={`h-4 w-4 shrink-0 ${metric.tone}`} /></div>
              <div className="mt-3 font-display text-3xl font-semibold tabular-nums">{metric.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{metric.detail}</div>
            </div>)}
          </div>

          <section className="mt-8 border-y py-6" aria-labelledby="daily-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="daily-heading" className="font-display text-xl font-semibold">Tasks per day</h2>
              <div className="flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="h-2 w-2 bg-chart-1" />Added</span><span className="flex items-center gap-2"><span className="h-2 w-2 bg-chart-2" />Latest update</span></div>
            </div>
            <div className="mt-5 flex gap-3">
              <div className="flex h-48 w-6 shrink-0 flex-col justify-between text-right font-mono text-xs text-muted-foreground"><span>{maxDaily}</span><span>{Math.round(maxDaily / 2)}</span><span>0</span></div>
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className={days === 30 ? "min-w-[720px]" : "min-w-[280px]"}>
                  <div className="flex h-48 items-end gap-1 border-b border-border bg-muted/20" role="img" aria-label={`Tasks added and latest updated per day over ${days} days`}>
                    {data.daily.map(d => <div key={d.date} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 px-1">
                      <div tabIndex={0} title={`${d.label}: ${d.added} added`} aria-label={`${d.label}: ${d.added} added`} className="w-1/2 max-w-8 bg-chart-1 focus-visible:outline focus-visible:outline-ring" style={{ height: `${d.added / maxDaily * 100}%` }} />
                      <div tabIndex={0} title={`${d.label}: ${d.updated} latest updated`} aria-label={`${d.label}: ${d.updated} latest updated`} className="w-1/2 max-w-8 bg-chart-2 focus-visible:outline focus-visible:outline-ring" style={{ height: `${d.updated / maxDaily * 100}%` }} />
                    </div>)}
                  </div>
                  <div className="mt-2 flex text-center font-mono text-[10px] text-muted-foreground">{data.daily.map((d, i) => <span key={d.date} className="min-w-0 flex-1">{days === 7 || i % 5 === 0 || i === days - 1 ? d.label : ""}</span>)}</div>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{data.total ? "Latest update uses each task’s most recent saved date, not its completion date." : "No tasks in the selected projects."}</p>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Daily counts</summary>
              <table className="mt-2 w-full text-left"><thead><tr><th className="py-1">Date</th><th>Added</th><th>Latest updated</th></tr></thead><tbody>{data.daily.map(d => <tr key={d.date} className="border-t"><td className="py-1">{d.label}</td><td>{d.added}</td><td>{d.updated}</td></tr>)}</tbody></table>
            </details>
          </section>

          <section className="mt-8" aria-labelledby="inactive-heading">
            <h2 id="inactive-heading" className="font-display text-xl font-semibold">Inactive tasks by project</h2>
            <div className="mt-4 space-y-3">
              {data.rows.map(row => <Link key={row.project.id} href={`/projects/${row.project.id}`} className="grid grid-cols-[minmax(0,1fr)_minmax(60px,2fr)_2rem] items-center gap-3 text-sm">
                <span className="truncate">{row.project.title}</span>
                <span className="h-3 bg-muted"><span className="block h-full bg-destructive" style={{ width: `${row.inactive / maxInactive * 100}%` }} /></span>
                <span className="text-right font-mono tabular-nums">{row.inactive}</span>
              </Link>)}
              {!data.inactive && <p className="text-sm text-muted-foreground">No unfinished tasks have been inactive for seven days.</p>}
              {!data.rows.length && <p className="text-sm text-muted-foreground">Project not found. Select another project.</p>}
            </div>
          </section>

          <section className="mt-8" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="mb-4 font-display text-xl font-semibold">Project progress</h2>
            <div className="divide-y border-y">
              {data.rows.map(row => <Link key={row.project.id} href={`/projects/${row.project.id}`} className="grid gap-3 py-4 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{row.project.title}</span><Pill value={row.project.status} /></div><div className="mt-1 text-xs text-muted-foreground">{row.open} open · {row.inactive} inactive</div></div>
                <div><div className="h-2 rounded-full bg-muted" role="progressbar" aria-label={`${row.project.title} task progress`} aria-valuenow={row.pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-accent" style={{ width: `${row.pct}%` }} /></div><div className="mt-1 text-xs text-muted-foreground">{row.total ? `${row.done}/${row.total} finished · ${row.pct}%` : "No tasks yet"}</div></div>
                <ArrowUpRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </Link>)}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}