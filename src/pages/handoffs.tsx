import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Bookmark, Play } from "lucide-react";
import { AppShell } from "@/components/shell";
import { CopyButton, Dot, Empty, ErrorBlock, LoadingBlock, PageHeader, ago, btn, field } from "@/components/kit";
import { CheckpointDialog } from "@/components/forms";
import { checkpointText, usePageTitle, useWorkspace } from "@/lib/workspace";

export default function HandoffsPage() {
  usePageTitle("Checkpoints", "Every place you left off, ready to resume.");
  const { state, isLoading, error, refetch, guard } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [proj, setProj] = useState("all");
  const list = useMemo(
    () => (state?.handoffs ?? []).filter((h) => proj === "all" || h.projectId === proj).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [state, proj],
  );
  const pmap = new Map((state?.projects ?? []).map((p) => [p.id, p]));
  const latestIds = new Set<string>();
  const seen = new Set<string>();
  for (const h of list) if (!seen.has(h.projectId)) { seen.add(h.projectId); latestIds.add(h.id); }

  return (
    <AppShell>
      <PageHeader eyebrow="Checkpoints" title="Where I left off" lede="Save a checkpoint whenever you step away or switch AI tools. The newest one per project becomes your resume point.">
        <button className={btn.primary} data-testid="button-new-checkpoint" onClick={() => guard("Saving checkpoints needs your own workspace.", () => setOpen(true))} disabled={!!state && !state.projects.length}>
          <Bookmark className="h-4 w-4" /> Save checkpoint
        </button>
      </PageHeader>
      {isLoading ? <LoadingBlock /> : error || !state ? <ErrorBlock error={error} onRetry={refetch} /> : !state.projects.length ? (
        <div className="rounded-2xl border bg-card">
          <Empty icon={<Bookmark className="h-5 w-5" />} title="Checkpoints live inside projects" body="Create a project first, then save where you left off.">
            <Link href="/projects" className={btn.primary}>Go to projects</Link>
          </Empty>
        </div>
      ) : (
        <>
          <select data-testid="select-filter-project" className={`${field} mb-5 md:w-72`} value={proj} onChange={(e) => setProj(e.target.value)}>
            <option value="all">All projects</option>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          {!list.length ? (
            <div className="rounded-2xl border bg-card">
              <Empty icon={<Bookmark className="h-5 w-5" />} title="No checkpoints yet" body="Next time you stop mid-thought, write two sentences and one next action. That's it.">
                <button className={btn.primary} onClick={() => guard("Saving checkpoints needs your own workspace.", () => setOpen(true))} data-testid="button-empty-checkpoint">Save my first checkpoint</button>
              </Empty>
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((h, i) => {
                const p = pmap.get(h.projectId);
                const isLatest = latestIds.has(h.id);
                return (
                  <article key={h.id} data-testid={`card-checkpoint-${h.id}`} className={`rise rounded-2xl border bg-card p-5 ${isLatest ? "" : "opacity-80"}`} style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Dot color={p?.color} />
                      <span className="font-medium text-foreground">{p?.title ?? "Deleted project"}</span>
                      <span>· {ago(h.createdAt)}</span>
                      <span>· from {h.source || "Relay"}</span>
                      {isLatest && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">Resume point</span>}
                    </div>
                    <h3 className="mt-2 font-display text-lg font-semibold">{h.title}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{h.summary}</p>
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-secondary/60 px-3 py-2.5 text-sm">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div><span className="font-medium">{h.nextAction}</span>{h.target && <span className="text-muted-foreground"> · in {h.target}</span>}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {p && <Link href={`/projects/${p.id}`} className={btn.ink} data-testid={`link-resume-${h.id}`}><Play className="h-3.5 w-3.5" /> Resume</Link>}
                      <CopyButton text={checkpointText(p, h)} label="Copy context" testId={`button-copy-${h.id}`} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      <CheckpointDialog open={open} onOpenChange={setOpen} projectId={proj === "all" ? undefined : proj} />
    </AppShell>
  );
}
