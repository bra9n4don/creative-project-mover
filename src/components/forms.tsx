import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@/lib/router-compat";
import {
  useCreateProject,
  useUpdateProject,
  useCreateHandoff,
  useCreateTask,
  useUpdateTask,
  type Project,
  type Task,
} from "@/lib/hub-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, btn, field } from "@/components/kit";
import { useHubResult, useWorkspace } from "@/lib/workspace";

const swatches = ["#e5522c", "#1f7a6a", "#d99a1b", "#2e3a5c", "#8a5a9e", "#c2416b", "#4f7a2e"];

function Shell({ open, onOpenChange, title, sub, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; sub?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          {sub && <DialogDescription>{sub}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project?: Project }) {
  const [, nav] = useLocation();
  const result = useHubResult();
  const create = useCreateProject();
  const update = useUpdateProject();
  const [f, setF] = useState({ title: "", description: "", goal: "", priority: "medium", repository: "", color: swatches[0], status: "planning" });
  useEffect(() => {
    if (open)
      setF(
        project
          ? { title: project.title, description: project.description, goal: project.goal, priority: project.priority, repository: project.repository, color: project.color || swatches[0], status: project.status }
          : { title: "", description: "", goal: "", priority: "medium", repository: "", color: swatches[Math.floor(Math.random() * swatches.length)], status: "planning" },
      );
  }, [open, project]);
  const repoOk = !f.repository || /^[\w.-]+\/[\w.-]+$/.test(f.repository.trim());
  const submit = () => {
    if (!f.title.trim() || !repoOk) return;
    const base = { title: f.title.trim(), description: f.description, goal: f.goal, priority: f.priority as Project["priority"], repository: f.repository.trim() };
    if (project)
      update.mutate(
        { id: project.id, data: { ...base, status: f.status as Project["status"], expectedVersion: project.version } },
        result("Project updated", () => onOpenChange(false)),
      );
    else
      create.mutate(
        { data: { ...base, color: f.color } },
        {
          ...result("Project created", () => onOpenChange(false)),
          onSuccess: (p) => {
            result("Project created").onSuccess(p);
            onOpenChange(false);
            nav(`/projects/${p.id}`);
          },
        },
      );
  };
  const pending = create.isPending || update.isPending;
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={project ? "Edit project" : "New project"} sub="One project, one plan. Keep the goal short enough to remember.">
      <div className="space-y-4">
        <Field label="Name">
          <input data-testid="input-project-title" className={field} maxLength={150} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Recipe scaler app" autoFocus />
        </Field>
        <Field label="Goal" hint="What does finished look like?">
          <textarea data-testid="input-project-goal" className={field} rows={2} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea data-testid="input-project-description" className={field} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select data-testid="select-project-priority" className={field} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          {project ? (
            <Field label="Status">
              <select data-testid="select-project-status" className={field} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </Field>
          ) : (
            <Field label="Color">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {swatches.map((c) => (
                  <button key={c} type="button" data-testid={`button-color-${c}`} onClick={() => setF({ ...f, color: c })} className="h-6 w-6 rounded-full ring-offset-2 ring-offset-card" style={{ background: c, boxShadow: f.color === c ? `0 0 0 2px ${c}` : undefined }} aria-label={c} />
                ))}
              </div>
            </Field>
          )}
        </div>
        <Field label="GitHub repository" hint={repoOk ? "owner/repo — optional, read-only commits and PRs" : "Use the owner/repo format"}>
          <input data-testid="input-project-repository" className={field} value={f.repository} onChange={(e) => setF({ ...f, repository: e.target.value })} placeholder="yourname/recipe-scaler" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btn.ghost} onClick={() => onOpenChange(false)} data-testid="button-cancel-project">Cancel</button>
          <button className={btn.primary} onClick={submit} disabled={pending || !f.title.trim() || !repoOk} data-testid="button-save-project">
            {pending ? "Saving…" : project ? "Save changes" : "Create project"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

export function CheckpointDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string }) {
  const { state } = useWorkspace();
  const result = useHubResult();
  const create = useCreateHandoff();
  const [f, setF] = useState({ projectId: "", title: "", summary: "", nextAction: "", target: "" });
  useEffect(() => {
    if (open) setF({ projectId: projectId ?? state?.projects[0]?.id ?? "", title: "", summary: "", nextAction: "", target: "" });
  }, [open, projectId, state?.projects]);
  const ok = f.projectId && f.title.trim() && f.summary.trim() && f.nextAction.trim();
  return (
    <Shell open={open} onOpenChange={onOpenChange} title="Save a checkpoint" sub="Future you, after a distraction, will read this first. Two sentences is plenty.">
      <div className="space-y-4">
        {!projectId && (
          <Field label="Project">
            <select data-testid="select-checkpoint-project" className={field} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
              {state?.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Label">
          <input data-testid="input-checkpoint-title" className={field} value={f.title} maxLength={200} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Auth flow half-wired" autoFocus />
        </Field>
        <Field label="Where I left off">
          <textarea data-testid="input-checkpoint-summary" className={field} rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="What's done, what's half-done, anything weird I noticed." />
        </Field>
        <Field label="The very next action" hint="One concrete step. Small enough to start in five minutes.">
          <input data-testid="input-checkpoint-next" className={field} value={f.nextAction} onChange={(e) => setF({ ...f, nextAction: e.target.value })} placeholder="Run the signup test and fix the redirect" />
        </Field>
        <Field label="Continue in (optional)">
          <select data-testid="select-checkpoint-target" className={field} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
            <option value="">Anywhere</option>
            {state?.connections.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btn.ghost} onClick={() => onOpenChange(false)} data-testid="button-cancel-checkpoint">Cancel</button>
          <button
            className={btn.primary}
            disabled={!ok || create.isPending}
            data-testid="button-save-checkpoint"
            onClick={() => create.mutate({ data: { ...f, title: f.title.trim(), target: f.target || undefined } }, result("Checkpoint saved", () => onOpenChange(false)))}
          >
            {create.isPending ? "Saving…" : "Save checkpoint"}
          </button>
        </div>
      </div>
    </Shell>
  );
}

export function TaskDialog({ open, onOpenChange, projectId, task, siblings }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; task?: Task; siblings: Task[] }) {
  const result = useHubResult();
  const create = useCreateTask();
  const update = useUpdateTask();
  const { state } = useWorkspace();
  const [f, setF] = useState({ title: "", description: "", priority: "medium", agent: "", dueDate: "", dependencies: [] as string[] });
  useEffect(() => {
    if (open) setF(task ? { title: task.title, description: task.description, priority: task.priority, agent: task.agent, dueDate: task.dueDate ?? "", dependencies: task.dependencies } : { title: "", description: "", priority: "medium", agent: "", dueDate: "", dependencies: [] });
  }, [open, task]);
  const options = siblings.filter((s) => s.id !== task?.id);
  const submit = () => {
    if (!f.title.trim()) return;
    const data = { title: f.title.trim(), description: f.description, priority: f.priority as Task["priority"], agent: f.agent, dependencies: f.dependencies, dueDate: f.dueDate || null };
    if (task) update.mutate({ id: task.id, data: { ...data, expectedVersion: task.version } }, result("Task updated", () => onOpenChange(false)));
    else create.mutate({ data: { ...data, projectId } }, result("Task added", () => onOpenChange(false)));
  };
  return (
    <Shell open={open} onOpenChange={onOpenChange} title={task ? "Edit task" : "Add task"}>
      <div className="space-y-4">
        <Field label="Task">
          <input data-testid="input-task-title" className={field} maxLength={200} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
        </Field>
        <Field label="Details">
          <textarea data-testid="input-task-description" className={field} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <select data-testid="select-task-priority" className={field} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="AI tool">
            <select data-testid="select-task-agent" className={field} value={f.agent} onChange={(e) => setF({ ...f, agent: e.target.value })}>
              <option value="">Me</option>
              {state?.connections.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
              {f.agent && !state?.connections.some((c) => c.name === f.agent) && <option value={f.agent}>{f.agent}</option>}
            </select>
          </Field>
        </div>
        <Field label="Due date (optional)">
          <input type="date" aria-label="Due date" className={field} value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Waits on" hint={options.length ? "This task stays blocked until these are done." : "No other tasks in this project yet."}>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
            {options.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary">
                <input
                  type="checkbox"
                  data-testid={`checkbox-dep-${s.id}`}
                  checked={f.dependencies.includes(s.id)}
                  onChange={(e) => setF({ ...f, dependencies: e.target.checked ? [...f.dependencies, s.id] : f.dependencies.filter((d) => d !== s.id) })}
                  className="accent-[hsl(var(--primary))]"
                />
                <span className="truncate">{s.title}</span>
              </label>
            ))}
            {!options.length && <div className="px-1.5 py-1 text-xs text-muted-foreground">Nothing to depend on.</div>}
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button className={btn.ghost} onClick={() => onOpenChange(false)} data-testid="button-cancel-task">Cancel</button>
          <button className={btn.primary} onClick={submit} disabled={!f.title.trim() || create.isPending || update.isPending} data-testid="button-save-task">
            {task ? "Save task" : "Add task"}
          </button>
        </div>
      </div>
    </Shell>
  );
}
