import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { FolderPlus, Github, Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Bar, Dot, Empty, ErrorBlock, LoadingBlock, PageHeader, Pill, ago, btn, field } from "@/components/kit";
import { ProjectDialog } from "@/components/forms";
import { latestCheckpoint, nextStep, progressOf, usePageTitle, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const filters = ["all", "active", "planning", "paused", "completed"] as const;

export default function ProjectsPage() {
  usePageTitle("Projects");
  const { state, isLoading, error, refetch, guard } = useWorkspace();
  const [q, setQ] = useState("");
  const [f, setF] = useState<(typeof filters)[number]>("all");
  const [open, setOpen] = useState(false);
  const list = useMemo(() => {
    if (!state) return [];
    const s = q.toLowerCase();
    return state.projects
      .filter((p) => (f === "all" ? true : p.status === f))
      .filter((p) => !s || `${p.title} ${p.description} ${p.goal} ${p.repository}`.toLowerCase().includes(s))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [state, q, f]);

  return (
    <AppShell>
      <PageHeader eyebrow="Projects" title="Everything you're building" lede="One plan per project. Open one to see its tasks, its last checkpoint, and the next step.">
        <button className={btn.primary} data-testid="button-create-project" onClick={() => guard("Creating projects needs your own workspace.", () => setOpen(true))}>
          <FolderPlus className="h-4 w-4" /> New project
        </button>
      </PageHeader>
      {isLoading ? (
        <LoadingBlock />
      ) : error || !state ? (
        <ErrorBlock error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative md:w-80">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input data-testid="input-search-projects" className={cn(field, "pl-9")} placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {filters.map((x) => (
                <button key={x} data-testid={`filter-${x}`} onClick={() => setF(x)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium capitalize", f === x ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary")}>
                  {x} {x !== "all" && <span className="opacity-60">{state.projects.filter((p) => p.status === x).length}</span>}
                </button>
              ))}
            </div>
          </div>
          {!state.projects.length ? (
            <div className="rounded-2xl border bg-card">
              <Empty icon={<FolderPlus className="h-5 w-5" />} title="No projects yet" body="Start with whatever is on your mind right now. You can add tasks and checkpoints after.">
                <button className={btn.primary} data-testid="button-empty-create" onClick={() => guard("Creating projects needs your own workspace.", () => setOpen(true))}>Create my first project</button>
              </Empty>
            </div>
          ) : !list.length ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nothing matches that. <button className="font-medium text-primary" onClick={() => { setQ(""); setF("all"); }}>Clear filters</button></div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((p, i) => {
                const pr = progressOf(state.tasks, p.id);
                const cp = latestCheckpoint(state.handoffs, p.id);
                const n = nextStep(state, p);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} data-testid={`card-project-${p.id}`} className="rise group flex flex-col rounded-2xl border bg-card p-5 transition-transform hover:-translate-y-0.5" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex items-center gap-2">
                      <Dot color={p.color} />
                      <span className="flex-1 truncate font-display text-lg font-semibold">{p.title}</span>
                      <Pill value={p.status} />
                    </div>
                    {p.goal && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.goal}</p>}
                    <div className="mt-4 rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Next </span>
                      {n.text || <span className="text-muted-foreground">not set</span>}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1"><Bar pct={pr.pct} color={p.color} /></div>
                      <span className="font-mono text-[11px] text-muted-foreground">{pr.done}/{pr.total}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{cp ? `Checkpoint ${ago(cp.createdAt)}` : "No checkpoint"}</span>
                      {p.repository && <span className="ml-auto inline-flex items-center gap-1 font-mono"><Github className="h-3 w-3" />{p.repository}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
      <ProjectDialog open={open} onOpenChange={setOpen} />
    </AppShell>
  );
}
