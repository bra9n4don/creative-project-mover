import { useMemo, useState } from "react";
import { Link } from "@/lib/router-compat";
import { ArrowRight, Bookmark, FolderPlus, Lightbulb, Play, Plug, Rocket, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/shell";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";
import { SetupBanner } from "@/components/setup-banner";
import { Bar, CopyButton, Dot, Empty, ErrorBlock, LoadingBlock, Panel, Pill, ago, btn } from "@/components/kit";
import { CheckpointDialog, ProjectDialog } from "@/components/forms";
import { checkpointText, lastTouched, latestCheckpoint, nextStep, progressOf, usePageTitle, useWorkspace } from "@/lib/workspace";

export function OverviewBody() {
  const { state, isLoading, error, refetch, guard, isDemo } = useWorkspace();
  const [newProject, setNewProject] = useState(false);
  const [cp, setCp] = useState<string | undefined | null>(null);

  const ordered = useMemo(() => {
    if (!state) return [];
    return state.projects
      .filter((p) => p.status !== "completed")
      .map((p) => ({ p, t: lastTouched(state, p) }))
      .sort((a, b) => b.t - a.t)
      .map((x) => x.p);
  }, [state]);

  useWebMCP({
    name: "get_where_i_left_off",
    description: "Read the projects shown on this screen, most recent first, with each one's next step and progress.",
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => runWebMCPTool("get_where_i_left_off", () => {
      if (isLoading || !state) return "Still loading.";
      const list = ordered.length ? ordered : state.projects;
      if (!list.length) return "No projects yet.";
      return list.slice(0, 10).map((p) => {
        const prog = progressOf(state.tasks, p.id);
        return `${p.id}: ${p.title} (${p.status}) — next: ${nextStep(state, p).text || "none"}; progress ${JSON.stringify(prog)}`;
      }).join("\n");
    }),
  });

  if (isLoading) return <LoadingBlock />;
  if (error || !state) return <ErrorBlock error={error} onRetry={refetch} />;

  const dialogs = (
    <>
      <ProjectDialog open={newProject} onOpenChange={setNewProject} />
      <CheckpointDialog open={cp !== null} onOpenChange={(o) => !o && setCp(null)} projectId={cp ?? undefined} />
    </>
  );

  if (!state.projects.length)
    return (
      <>
        <Panel className="overflow-hidden">
          <Empty icon={<FolderPlus className="h-5 w-5" />} title="Nothing to remember yet" body="Add the first thing you're working on. When you step away, save a checkpoint and Relay will hand it back to you here, word for word.">
            <Button asChild variant="outline"><Link href="/kickoff"><Rocket /> Start Kickoff</Link></Button>
            <button className={btn.primary} data-testid="button-first-project" onClick={() => guard("Creating projects needs your own workspace.", () => setNewProject(true))}>
              <FolderPlus className="h-4 w-4" /> Create my first project
            </button>
            <Link href="/connections" className={btn.ghost} data-testid="link-connect-tool">
              <Plug className="h-4 w-4" /> Connect an AI tool
            </Link>
          </Empty>
        </Panel>
        {dialogs}
      </>
    );

  const [first, ...rest] = ordered.length ? ordered : state.projects;
  const lead = first!;
  const leadCp = latestCheckpoint(state.handoffs, lead.id);
  const leadNext = nextStep(state, lead);
  const leadProg = progressOf(state.tasks, lead.id);
  const inbox = state.ideas.filter((i) => i.status === "inbox").length;
  const pending = state.approvals.filter((a) => a.status === "pending").length;

  return (
    <>
      <section data-testid="card-resume" className="rise relative overflow-hidden rounded-3xl border border-border bg-card p-6 text-foreground md:p-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: lead.color || "hsl(var(--primary))" }} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Dot color={lead.color} /> Continue where you left off
            {leadCp && <span className="normal-case tracking-normal text-muted-foreground">· saved {ago(leadCp.createdAt)}{leadCp.source ? ` from ${leadCp.source}` : ""}</span>}
          </div>
          <h2 className="mt-3 font-display text-3xl font-semibold md:text-5xl">{lead.title}</h2>
          {leadCp ? (
            <p className="mt-3 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">{leadCp.summary}</p>
          ) : (
            <p className="mt-3 max-w-2xl text-[15px] text-muted-foreground">No checkpoint saved yet. Save one before you switch away and it will appear right here.</p>
          )}
          <div className="mt-6 rounded-2xl border border-border bg-background/50 p-4 md:p-5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-primary">Next action</div>
            <div data-testid="text-lead-next" className="mt-1 text-lg font-medium md:text-xl">
              {leadNext.text || "Decide the next step and save a checkpoint."}
            </div>
            {leadCp?.target && <div className="mt-1 text-sm text-muted-foreground">Pick this up in {leadCp.target}</div>}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link href={`/projects/${lead.id}`} data-testid="link-resume-lead" className={btn.primary}>
              <Play className="h-4 w-4" /> Resume
            </Link>
            {leadCp && <CopyButton text={checkpointText(lead, leadCp)} label="Copy context for an AI tool" testId="button-copy-lead" className="border-border bg-transparent text-foreground hover:bg-secondary" />}
            <button data-testid="button-checkpoint-lead" onClick={() => guard("Saving checkpoints needs your own workspace.", () => setCp(lead.id))} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-secondary">
              <Bookmark className="h-3.5 w-3.5" /> Save new checkpoint
            </button>
            {leadProg.total > 0 && <span className="ml-auto font-mono text-xs text-muted-foreground">{leadProg.done}/{leadProg.total} tasks done</span>}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display text-xl font-semibold">Also in flight</h3>
            <button className="text-sm font-medium text-primary" data-testid="button-new-project" onClick={() => guard("Creating projects needs your own workspace.", () => setNewProject(true))}>
              + New project
            </button>
          </div>
          {rest.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">Just the one project open. Good focus.</div>
          ) : (
            <div className="divide-y rounded-2xl border bg-card">
              {rest.map((p, i) => {
                const c = latestCheckpoint(state.handoffs, p.id);
                const n = nextStep(state, p);
                const pr = progressOf(state.tasks, p.id);
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} data-testid={`row-project-${p.id}`} className="rise group grid gap-2 px-5 py-4 hover:bg-secondary/50 md:grid-cols-[1fr_auto] md:items-center" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Dot color={p.color} />
                        <span className="font-medium">{p.title}</span>
                        <Pill value={p.status} />
                      </div>
                      <div className="mt-1.5 flex gap-2 text-sm">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className={n.text ? "" : "text-muted-foreground"}>{n.text || "No next action yet"}</span>
                      </div>
                      <div className="mt-1 pl-5 text-xs text-muted-foreground">{c ? `Checkpoint ${ago(c.createdAt)}${c.source ? ` · ${c.source}` : ""}` : "No checkpoint yet"}</div>
                    </div>
                    <div className="w-full md:w-28">
                      <Bar pct={pr.pct} color={p.color} />
                      <div className="mt-1 text-right font-mono text-[11px] text-muted-foreground">{pr.total ? `${pr.done}/${pr.total}` : "no tasks"}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <aside className="space-y-3">
          <Link href="/ideas" data-testid="link-ideas-inbox" className="rise flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-secondary/50">
            <Lightbulb className="h-5 w-5 text-[hsl(42_85%_45%)]" />
            <div className="flex-1 text-sm"><span className="font-semibold">{inbox}</span> idea{inbox === 1 ? "" : "s"} waiting in your inbox</div>
          </Link>
          {pending > 0 && (
            <Link href="/approvals" data-testid="link-pending-approvals" className="rise flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div className="flex-1 text-sm"><span className="font-semibold">{pending}</span> change{pending === 1 ? "" : "s"} from AI tools need your OK</div>
            </Link>
          )}
          <Panel title="Recently">
            <ul className="divide-y">
              {state.activity.slice(0, 5).map((a) => (
                <li key={a.id} className="px-4 py-2.5 text-sm">
                  <div className="truncate">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.source} · {ago(a.createdAt)}</div>
                </li>
              ))}
              {!state.activity.length && <li className="px-4 py-4 text-sm text-muted-foreground">Nothing logged yet.</li>}
            </ul>
          </Panel>
          {isDemo && <p className="px-1 text-xs text-muted-foreground">Sample content. Your real workspace never shows invented progress.</p>}
        </aside>
      </div>
      {dialogs}
    </>
  );
}

export default function OverviewPage() {
  usePageTitle("Where I left off", "Pick up exactly where you stopped, across every AI tool.");
  return (
    <AppShell>
      <SetupBanner />
      <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </div>
      <OverviewBody />
    </AppShell>
  );
}
