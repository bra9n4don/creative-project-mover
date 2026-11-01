import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getKickoffsFn } from "@/lib/hub/hub.functions";
import { Link, useLocation, useParams } from "@/lib/router-compat";
import { ArrowLeft, BadgeCheck, Bookmark, Github, GitPullRequest, Link2, Lock, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { ProjectUpdateDialog } from "@/components/project-update-dialog";
import { Button } from "@/components/ui/button";
import {
  useDeleteProject,
  useDeleteTask,
  useUpdateTask,
  useUpdateProject,
  useSyncGithub,
  useListGithubRepos,
  getListGithubReposQueryKey,
  type Task,
  type Project,
} from "@/lib/hub-api";
import { AppShell } from "@/components/shell";
import { Bar, Confirm, CopyButton, Dot, Empty, ErrorBlock, Field, LoadingBlock, Panel, Pill, ago, btn, field } from "@/components/kit";
import { CheckpointDialog, ProjectDialog, TaskDialog } from "@/components/forms";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkpointText, errMessage, latestCheckpoint, nextStep, progressOf, useHubResult, usePageTitle, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const order: Task["status"][] = ["in_progress", "blocked", "todo", "done", "verified"];

function VerifyDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [ev, setEv] = useState("");
  const update = useUpdateTask();
  const result = useHubResult();
  const key = task?.id ?? "";
  const [seen, setSeen] = useState("");
  if (task && seen !== key) {
    setSeen(key);
    setEv(task.evidence || "");
  }
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Confirm it really works</DialogTitle>
          <DialogDescription>An AI tool can say "done". Only you mark it verified. Note what you checked: a link, a test run, a screenshot path.</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-secondary/60 px-3 py-2 text-sm font-medium">{task?.title}</div>
        <Field label="Evidence">
          <textarea data-testid="input-evidence" className={field} rows={4} value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Ran the signup flow on mobile Safari, redirect works. PR #14." />
        </Field>
        <div className="flex justify-end gap-2">
          <button className={btn.ghost} onClick={onClose}>Cancel</button>
          <button
            className={cn(btn.primary, "bg-accent shadow-none")}
            disabled={!ev.trim() || update.isPending}
            data-testid="button-verify-confirm"
            onClick={() => task && update.mutate({ id: task.id, data: { status: "verified", evidence: ev.trim(), expectedVersion: task.version } }, result("Marked verified", onClose))}
          >
            <BadgeCheck className="h-4 w-4" /> Mark verified
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GithubPanel({ project }: { project: Project }) {
  const { state, guard, isDemo } = useWorkspace();
  const [browse, setBrowse] = useState(false);
  const repos = useListGithubRepos({ query: { enabled: browse && !isDemo, queryKey: getListGithubReposQueryKey(), retry: false } });
  const sync = useSyncGithub();
  const link = useUpdateProject();
  const result = useHubResult();
  const gh = (state?.activity ?? []).filter((a) => a.projectId === project.id && a.source.toLowerCase().includes("github")).slice(0, 6);
  const status = (repos.error as { status?: number } | null)?.status;
  return (
    <Panel
      title="GitHub · read only"
      action={
        project.repository ? (
          <button data-testid="button-sync-github" disabled={sync.isPending} onClick={() => guard("Syncing GitHub needs your own workspace.", () => sync.mutate(undefined, result("GitHub synced")))} className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} /> Sync
          </button>
        ) : null
      }
    >
      <div className="p-4 text-sm">
        {project.repository ? (
          <a href={`https://github.com/${project.repository}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs hover:underline" data-testid="link-repo">
            <Github className="h-3.5 w-3.5" /> {project.repository}
          </a>
        ) : (
          <p className="text-muted-foreground">No repository linked.</p>
        )}
        <ul className="mt-3 space-y-2">
          {gh.map((a) => (
            <li key={a.id} className="flex gap-2 text-xs">
              <GitPullRequest className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.title}</a> : a.title}
                <div className="text-muted-foreground">{ago(a.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
        <button className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground" data-testid="button-browse-repos" onClick={() => guard("Browsing your GitHub repos needs your own workspace.", () => setBrowse((b) => !b))}>
          <Link2 className="h-3.5 w-3.5" /> {browse ? "Hide my repos" : project.repository ? "Change repo" : "Pick from my GitHub"}
        </button>
        {browse && (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border">
            {repos.isLoading && <div className="p-3 text-xs text-muted-foreground">Asking GitHub…</div>}
            {repos.error && (
              <div className="p-3 text-xs text-destructive">
                {status === 403 ? "GitHub access denied. Check that the GitHub token connected to Relay can read your repositories." : errMessage(repos.error)}
              </div>
            )}
            {repos.data?.map((r) => (
              <button
                key={r.name}
                data-testid={`button-repo-${r.name}`}
                disabled={link.isPending}
                onClick={() => link.mutate({ id: project.id, data: { repository: r.name, expectedVersion: project.version } }, result(`Linked ${r.name}`, () => setBrowse(false)))}
                className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-xs last:border-0 hover:bg-secondary"
              >
                {r.private && <Lock className="h-3 w-3 text-muted-foreground" />}
                <span className="font-mono">{r.name}</span>
              </button>
            ))}
            {repos.data && !repos.data.length && <div className="p-3 text-xs text-muted-foreground">No repositories found.</div>}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Relay reads commits and pull requests. It never merges or deploys.</p>
      </div>
    </Panel>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const { state, isLoading, error, refetch, guard, isDemo } = useWorkspace();
  const listKickoffs = useServerFn(getKickoffsFn);
  const kickoffs = useQuery({ queryKey: ["kickoffs"], queryFn: () => listKickoffs(), enabled: !isDemo });
  const unfinishedKickoff = kickoffs.data?.find(k => k.projectId === id && !k.completed);
  const project = state?.projects.find((p) => p.id === id);
  usePageTitle(project?.title ?? "Project");
  const [edit, setEdit] = useState(false);
  const [taskDlg, setTaskDlg] = useState<{ task?: Task } | null>(null);
  const [verify, setVerify] = useState<Task | null>(null);
  const [cp, setCp] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const del = useDeleteProject();
  const delTask = useDeleteTask();
  const upTask = useUpdateTask();
  const result = useHubResult();

  const tasks = useMemo(() => (state?.tasks ?? []).filter((t) => t.projectId === id).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)), [state, id]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const history = useMemo(() => (state?.handoffs ?? []).filter((h) => h.projectId === id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [state, id]);

  if (isLoading) return <AppShell><LoadingBlock /></AppShell>;
  if (error || !state) return <AppShell><ErrorBlock error={error} onRetry={refetch} /></AppShell>;
  if (!project)
    return (
      <AppShell>
        <Empty icon={<ArrowLeft className="h-5 w-5" />} title="Project not found" body="It may have been deleted, or it belongs to a different workspace.">
          <Link href="/projects" className={btn.ghost}>Back to projects</Link>
        </Empty>
      </AppShell>
    );

  const latest = latestCheckpoint(state.handoffs, project.id);
  const next = nextStep(state, project);
  const pr = progressOf(state.tasks, project.id);
  const w = (reason: string, fn: () => void) => guard(reason, fn);

  return (
    <AppShell>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="link-back">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div className="rise flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2"><Dot color={project.color} /><Pill value={project.status} /><Pill value={project.priority} label={`${project.priority} priority`} /></div>
          <h1 className="mt-2 font-display text-3xl font-semibold md:text-4xl" data-testid="text-project-title">{project.title}</h1>
          {project.goal && <p className="mt-2 text-[15px] text-muted-foreground"><span className="font-medium text-foreground">Goal:</span> {project.goal}</p>}
          {project.description && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {unfinishedKickoff && <Button variant="outline" asChild><Link href={`/kickoff?resume=${unfinishedKickoff.data.id}`}><ArrowLeft /> Resume Kickoff · Step {unfinishedKickoff.data.step + 1}</Link></Button>}
          <Button variant="secondary" onClick={() => w("AI drafting needs your own workspace.", () => setUpdateOpen(true))}><Sparkles /> Project update</Button>
          <button className={btn.ghost} data-testid="button-edit-project" onClick={() => w("Editing needs your own workspace.", () => setEdit(true))}><Pencil className="h-4 w-4" /> Edit</button>
          <Confirm
            trigger={<button className={btn.danger} data-testid="button-delete-project"><Trash2 className="h-4 w-4" /></button>}
            title={`Delete "${project.title}"?`}
            body={`This removes the project, its ${tasks.length} task${tasks.length === 1 ? "" : "s"} and ${history.length} checkpoint${history.length === 1 ? "" : "s"}. It cannot be undone.`}
            confirmLabel="Delete project"
            onConfirm={() => w("Deleting needs your own workspace.", () => del.mutate({ id: project.id }, result("Project deleted", () => nav("/projects"))))}
          />
        </div>
      </div>

      <section className="rise mt-6 rounded-2xl border-2 border-foreground/90 bg-card p-5 md:p-6" data-testid="card-project-resume">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          <Bookmark className="h-3.5 w-3.5 text-primary" /> Where I left off
          {latest && <span className="normal-case tracking-normal">· {ago(latest.createdAt)}{latest.source ? ` · ${latest.source}` : ""}</span>}
        </div>
        {latest ? <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{latest.summary}</p> : <p className="mt-2 text-sm text-muted-foreground">No checkpoint yet. Save one when you stop so you know exactly how to restart.</p>}
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-primary">Next action</div>
            <div className="text-lg font-medium" data-testid="text-next-action">{next.text || "Not decided yet"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {latest && <CopyButton text={checkpointText(project, latest)} label="Copy context" testId="button-copy-context" />}
            <button className={btn.ink} data-testid="button-save-checkpoint-open" onClick={() => w("Saving checkpoints needs your own workspace.", () => setCp(true))}><Bookmark className="h-4 w-4" /> Save checkpoint</button>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold">Plan</h2>
            <div className="w-32"><Bar pct={pr.pct} color={project.color} /></div>
            <span className="font-mono text-xs text-muted-foreground">{pr.done}/{pr.total}</span>
            <button className="ml-auto text-sm font-medium text-primary" data-testid="button-add-task" onClick={() => w("Adding tasks needs your own workspace.", () => setTaskDlg({}))}><Plus className="mr-0.5 inline h-4 w-4" />Task</button>
          </div>
          {!tasks.length ? (
            <div className="rounded-2xl border border-dashed">
              <Empty icon={<Plus className="h-5 w-5" />} title="No tasks yet" body="Break the goal into a few steps. Your AI tools can add and update them too.">
                <button className={btn.primary} onClick={() => w("Adding tasks needs your own workspace.", () => setTaskDlg({}))} data-testid="button-empty-add-task">Add first task</button>
              </Empty>
            </div>
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {tasks.map((t) => {
                const waiting = t.dependencies.map((d) => byId.get(d)).filter((d): d is Task => !!d && d.status !== "done" && d.status !== "verified");
                return (
                  <li key={t.id} data-testid={`row-task-${t.id}`} className="group px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <select
                        data-testid={`select-task-status-${t.id}`}
                        value={t.status === "verified" ? "verified" : t.status}
                        disabled={t.status === "verified"}
                        onChange={(e) => w("Updating tasks needs your own workspace.", () => upTask.mutate({ id: t.id, data: { status: e.target.value as Task["status"], expectedVersion: t.version } }, result("Task updated")))}
                        className="mt-0.5 rounded-md border bg-card px-1.5 py-1 font-mono text-[11px]"
                      >
                        <option value="todo">todo</option>
                        <option value="in_progress">in progress</option>
                        <option value="blocked">blocked</option>
                        <option value="done">done</option>
                        {t.status === "verified" && <option value="verified">verified</option>}
                      </select>
                      <div className="min-w-0 flex-1">
                        <div className={cn("text-[15px]", t.status === "verified" && "text-muted-foreground line-through decoration-accent/60")}>{t.title}</div>
                        {t.description && <div className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</div>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Pill value={t.status} />
                          <span>{t.agent || "Me"}</span>
                          <span>· {t.priority}</span>
                          {waiting.length > 0 && <span className="text-destructive">waits on: {waiting.map((x) => x.title).join(", ")}</span>}
                        </div>
                        {t.evidence && <div className="mt-2 rounded-md border-l-2 border-accent bg-accent/5 px-2.5 py-1.5 text-xs"><span className="font-medium text-accent">Evidence </span>{t.evidence}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {t.status === "done" && (
                          <button className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground" data-testid={`button-verify-${t.id}`} onClick={() => w("Verifying needs your own workspace.", () => setVerify(t))}>Verify</button>
                        )}
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Edit task" data-testid={`button-edit-task-${t.id}`} onClick={() => w("Editing needs your own workspace.", () => setTaskDlg({ task: t }))}><Pencil className="h-3.5 w-3.5" /></button>
                        <Confirm
                          trigger={<button className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete task" data-testid={`button-delete-task-${t.id}`}><Trash2 className="h-3.5 w-3.5" /></button>}
                          title="Delete this task?"
                          body={`"${t.title}" will be removed${tasks.some((o) => o.dependencies.includes(t.id)) ? " and other tasks that wait on it will lose that link" : ""}.`}
                          confirmLabel="Delete task"
                          onConfirm={() => w("Deleting needs your own workspace.", () => delTask.mutate({ id: t.id }, result("Task deleted")))}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside className="space-y-4">
          <Panel title="Checkpoint history">
            <ol className="relative space-y-4 p-4 before:absolute before:bottom-4 before:left-[21px] before:top-5 before:w-px before:bg-border">
              {history.slice(0, 8).map((h) => (
                <li key={h.id} className="relative pl-6 text-sm">
                  <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                  <div className="font-medium">{h.title}</div>
                  <div className="text-xs text-muted-foreground">{h.source || "Relay"} · {ago(h.createdAt)}</div>
                </li>
              ))}
              {!history.length && <li className="text-sm text-muted-foreground">None yet.</li>}
            </ol>
          </Panel>
          <GithubPanel project={project} />
        </aside>
      </div>

      <ProjectDialog open={edit} onOpenChange={setEdit} project={project} />
      <TaskDialog open={!!taskDlg} onOpenChange={(o) => !o && setTaskDlg(null)} projectId={project.id} task={taskDlg?.task} siblings={tasks} />
      <VerifyDialog task={verify} onClose={() => setVerify(null)} />
      <CheckpointDialog open={cp} onOpenChange={setCp} projectId={project.id} />
      <ProjectUpdateDialog open={updateOpen} onOpenChange={setUpdateOpen} projectId={project.id} />
    </AppShell>
  );
}
