import { useState, useId } from "react";
import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, pointerWithin, type DragEndEvent } from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MilestoneBar } from "@/components/milestone-bar";
import { field } from "@/components/kit";
import { useCreateMilestone, useUpdateMilestone, type Task } from "@/lib/hub-api";
import { milestoneProgress, type Milestone } from "@/lib/hub/milestones";
import { calendarDays, dateKey, deadlineMove } from "@/lib/hub/planner";
import { errMessage, useHubResult, useWorkspace } from "@/lib/workspace";
import { cn } from "@/lib/utils";

function Deadline({ m, tasks, disabled, edit }: { m: Milestone; tasks: Task[]; disabled: boolean; edit: () => void }) {
  const drag = useDraggable({ id: m.id, disabled });
  const pr = milestoneProgress(m, tasks);
  return <div ref={drag.setNodeRef} className={cn("rounded-md border bg-card p-2", drag.isDragging && "opacity-40")}>
    <div className="flex items-start gap-1">
      <Button variant="ghost" size="icon" className="h-7 w-6 shrink-0 touch-none" disabled={disabled} {...drag.listeners} {...drag.attributes} aria-label={`Drag deadline for ${m.title}`} title={`Drag deadline for ${m.title}`}><GripVertical /></Button>
      <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal break-words p-1 text-left text-xs" disabled={disabled} onClick={edit} title={`Edit ${m.title}`}><span className="line-clamp-2">{m.title}</span><Pencil className="ml-auto shrink-0" /></Button>
    </div>
    <MilestoneBar m={m} pr={pr} className="mt-1" />
  </div>;
}

function DateCell({ date, month, children }: { date: Date; month: Date; children: React.ReactNode }) {
  const key = dateKey(date);
  const drop = useDroppable({ id: key });
  return <div ref={drop.setNodeRef} data-planner-date={key} aria-label={format(date, "MMMM d, yyyy")} className={cn("min-h-32 min-w-0 border-b border-r p-1.5", !isSameMonth(date, month) && "bg-muted/40", drop.isOver && "bg-primary/10 ring-2 ring-inset ring-primary")}>
    <div className={cn("mb-2 text-xs", dateKey(new Date()) === key ? "font-bold text-primary" : "text-muted-foreground")}>{format(date, "d")}</div>
    <div className="space-y-1.5">{children}</div>
  </div>;
}

function Undated({ children }: { children: React.ReactNode }) {
  const drop = useDroppable({ id: "undated" });
  return <div ref={drop.setNodeRef} className={cn("mt-4 min-h-24 border border-dashed p-3", drop.isOver && "bg-primary/10 ring-2 ring-primary")}>
    <h3 className="mb-2 text-sm font-medium">No deadline</h3>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  </div>;
}

export function MilestonePlanner({ projectId }: { projectId: string }) {
  const { state, guard } = useWorkspace();
  const result = useHubResult();
  const create = useCreateMilestone();
  const update = useUpdateMilestone();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const contextId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const milestones = (state?.milestones ?? []).filter(m => m.projectId === projectId).sort((a, b) => a.order - b.order);
  const tasks = (state?.tasks ?? []).filter(t => t.projectId === projectId);
  const busy = create.isPending || update.isPending;
  const selected = milestones.find(m => m.id === editing);
  const dragged = milestones.find(m => m.id === active);
  const open = (m?: Milestone) => { setEditing(m?.id ?? "new"); setTitle(m?.title ?? ""); setDate(m?.targetDate ? new Date(`${m.targetDate}T12:00:00`) : undefined); setError(""); };
  const saveDate = (m: Milestone, target: string | null, after?: () => void) => {
    const patch = deadlineMove(m, target);
    if (!patch) { after?.(); return; }
    guard("Editing milestones needs your own workspace.", () => {
      setError("");
      const callbacks = result("Deadline saved", after);
      update.mutate(patch, { ...callbacks, onError: e => { callbacks.onError(e); setError(errMessage(e)); } });
    });
  };
  const drop = (event: DragEndEvent) => {
    setActive(null);
    if (!event.over || busy) return;
    const m = milestones.find(item => item.id === String(event.active.id));
    if (m) saveDate(m, event.over.id === "undated" ? null : String(event.over.id));
  };
  const save = () => {
    if (selected) saveDate(selected, date ? dateKey(date) : null, () => setEditing(null));
    else if (title.trim()) guard("Adding milestones needs your own workspace.", () => {
      setError("");
      const callbacks = result("Milestone added", () => setEditing(null));
      create.mutate({ data: { projectId, title: title.trim(), targetDate: date ? dateKey(date) : null } }, { ...callbacks, onError: e => { callbacks.onError(e); setError(errMessage(e)); } });
    });
  };
  return <section className="mt-8 min-w-0 border-y py-6" aria-label="Milestone planner">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><CalendarDays className="h-5 w-5 text-primary" />Milestone planner</h2>
      <Button variant="outline" onClick={() => open()} disabled={busy}><Plus />Milestone</Button>
    </header>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button size="icon" variant="ghost" aria-label="Previous month" title="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft /></Button>
      <h3 className="w-40 text-center text-sm font-medium">{format(month, "MMMM yyyy")}</h3>
      <Button size="icon" variant="ghost" aria-label="Next month" title="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight /></Button>
      <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
      <span className="ml-auto text-xs text-muted-foreground" role="status">{busy ? "Saving…" : `${milestones.length} milestones`}</span>
    </div>
    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    <DndContext id={contextId} sensors={sensors} collisionDetection={pointerWithin} onDragStart={event => setActive(String(event.active.id))} onDragEnd={drop} onDragCancel={() => setActive(null)}>
      <div className="overflow-x-auto overscroll-x-contain" tabIndex={0} aria-label="Milestone calendar">
        <div className="min-w-[840px] border-l border-t">
          <div className="grid grid-cols-7">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <div key={day} className="border-b border-r bg-muted/40 px-2 py-2 text-xs text-muted-foreground">{day}</div>)}</div>
          <div className="grid grid-cols-7">{calendarDays(month).map(day => <DateCell key={dateKey(day)} date={day} month={month}>{milestones.filter(m => m.targetDate === dateKey(day)).map(m => <Deadline key={m.id} m={m} tasks={tasks} disabled={busy} edit={() => open(m)} />)}</DateCell>)}</div>
        </div>
      </div>
      <Undated>{milestones.filter(m => !m.targetDate).map(m => <Deadline key={m.id} m={m} tasks={tasks} disabled={busy} edit={() => open(m)} />)}</Undated>
      <DragOverlay>{dragged && <div className="max-w-56 rounded-md border border-primary bg-card px-3 py-2 text-sm shadow-md">{dragged.title}</div>}</DragOverlay>
    </DndContext>
    <Dialog open={editing !== null} onOpenChange={value => !value && !busy && setEditing(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{selected ? selected.title : "Add milestone"}</DialogTitle><DialogDescription>Target deadline</DialogDescription></DialogHeader>
        {!selected && <input aria-label="Milestone name" maxLength={200} className={field} value={title} onChange={e => setTitle(e.target.value)} />}
        <div className="pointer-events-auto flex justify-center"><Calendar mode="single" selected={date} onSelect={setDate} defaultMonth={date ?? month} disabled={busy} /></div>
        <p className="text-sm text-muted-foreground">{date ? format(date, "MMMM d, yyyy") : "No deadline"}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-between gap-2"><Button variant="ghost" disabled={busy} onClick={() => setDate(undefined)}>Clear date</Button><Button disabled={busy || (!selected && !title.trim())} onClick={save}>{busy ? "Saving…" : "Save"}</Button></div>
      </DialogContent>
    </Dialog>
  </section>;
}