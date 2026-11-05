import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import type { CreatedRef } from "@/lib/ai/inbox";
import { Check, CheckCheck, Flag, Map as MapIcon, MessageSquare, Lightbulb, ListPlus, PencilLine, Waypoints, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput } from "@/components/ai-elements/tool";
import { ModelBadge } from "@/components/model-badge";
import { UPDATE_MODEL_LABEL } from "@/lib/ai/model";
import { CHAT_INPUT_LIMIT, type Proposal } from "@/lib/ai/chat-tools";
import { decideProposalFn } from "@/lib/ai/chat.functions";
import { useCreateIdea, useCreateMilestone, useCreateTask, useUpdateMilestone, useUpdateTask } from "@/lib/hub-api";
import { useWorkspace } from "@/lib/workspace";

export const DOCK_ASK_EVENT = "carterhub:dock-ask";
let pendingDockAsk: string | null = null;
/** Queues a question for the dock chat to send when it mounts (used when the dock was a pill). */
export function setPendingDockAsk(text: string) { pendingDockAsk = text; }
/** Sends a question to the floating chat dock (opens it). */
export function askDock(text: string) { window.dispatchEvent(new CustomEvent(DOCK_ASK_EVENT, { detail: text })); }

export function AgentMark({ className = "h-7 w-7" }: { className?: string }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ${className}`}><Waypoints className="h-[55%] w-[55%]" /></span>;
}

type ToolPartLike = { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string; decision?: "approved" | "dismissed"; created?: CreatedRef };

// Decisions made this session, so remounted cards (tab switches) don't show Approve again.
const localDecisions = new Map<string, { decision: "approved" | "dismissed"; created?: CreatedRef }>();
// Pending cards register their approve action so "Approve all" can run them one by one.
const approvers = new Map<string, () => Promise<boolean>>();

export function ProposalCard({ threadId, messageId, part }: { threadId: string; messageId: string; part: ToolPartLike }) {
  const p = part.output as Proposal | undefined;
  const local = localDecisions.get(part.toolCallId);
  const [decision, setDecision] = useState(local?.decision ?? part.decision);
  const [created, setCreated] = useState<CreatedRef | undefined>(local?.created ?? part.created);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { state } = useWorkspace();
  const qc = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createIdea = useCreateIdea();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const decide = useServerFn(decideProposalFn);
  const approveRef = useRef<() => Promise<boolean>>(async () => false);
  useEffect(() => {
    if (decision || !p?.ok) return;
    const id = part.toolCallId; const fn = () => approveRef.current();
    approvers.set(id, fn);
    return () => { if (approvers.get(id) === fn) approvers.delete(id); };
  }, [decision, part.toolCallId, p?.ok]);
  if (!p) return null;
  if (!p.ok) return <p className="text-xs text-muted-foreground">Suggestion couldn't be made: {p.error}</p>;

  const send = (d: "approving" | "approved" | "dismissed", c?: CreatedRef) => decide({ data: { threadId, messageId, toolCallId: part.toolCallId, decision: d, ...(c ? { created: c } : {}) } });
  const record = (d: "approved" | "dismissed", c?: CreatedRef) => {
    setDecision(d); if (c) setCreated(c);
    localDecisions.set(part.toolCallId, { decision: d, ...(c ? { created: c } : {}) });
    // Retry once so a saved item never shows Approve again.
    void send(d, c).catch(() => send(d, c)).then(() => qc.invalidateQueries({ queryKey: ["chat"] })).catch(() => {});
  };
  const missing = p.kind === "task" || p.kind === "milestone" ? !state?.projects.some(x => x.id === p.projectId) : p.kind === "task_update" ? !state?.tasks.some(t => t.id === p.taskId) : p.kind === "milestone_update" ? !state?.milestones?.some(m => m.id === p.milestoneId) : false;
  const approve = async (): Promise<boolean> => {
    setBusy(true); setError("");
    try {
      const lock = await send("approving");
      if (lock.alreadyApproved) { setDecision("approved"); if (lock.created) setCreated(lock.created); localDecisions.set(part.toolCallId, { decision: "approved", ...(lock.created ? { created: lock.created } : {}) }); await qc.invalidateQueries({ queryKey: ["chat"] }); return true; }
      if (lock.locked) throw new Error("This suggestion is already being saved. Try again in a couple of minutes.");
      let c: CreatedRef;
      if (p.kind === "task") c = { kind: "task", id: (await createTask.mutateAsync({ data: { projectId: p.projectId, title: p.title, description: p.description, priority: p.priority, ...(p.milestoneId && state?.milestones?.some(m => m.id === p.milestoneId) ? { milestoneId: p.milestoneId } : {}) } as never })).id };
      else if (p.kind === "milestone") c = { kind: "milestone", id: (await createMilestone.mutateAsync({ data: { projectId: p.projectId, title: p.title, outcome: p.outcome, targetDate: p.targetDate ?? null } })).id };
      else if (p.kind === "milestone_update") {
        const m = state?.milestones?.find(m => m.id === p.milestoneId);
        if (!m) throw new Error("That milestone no longer exists.");
        await updateMilestone.mutateAsync({ id: m.id, data: { expectedVersion: m.version, ...(p.title ? { title: p.title } : {}), ...(p.targetDate ? { targetDate: p.targetDate } : {}) } });
        c = { kind: "milestone_update", id: m.id };
      }
      else if (p.kind === "idea") c = { kind: "idea", id: (await createIdea.mutateAsync({ data: { title: p.title, description: p.description } as never })).id };
      else {
        const task = state?.tasks.find(t => t.id === p.taskId);
        if (!task) throw new Error("That task no longer exists.");
        if (p.milestoneId && !state?.milestones?.some(m => m.id === p.milestoneId && m.projectId === task.projectId)) throw new Error("That milestone no longer exists.");
        await updateTask.mutateAsync({ id: p.taskId, data: { expectedVersion: task.version, ...(p.status ? { status: p.status } : {}), ...(p.title ? { title: p.title } : {}), ...(p.milestoneId ? { milestoneId: p.milestoneId } : {}), ...(p.dueDate ? { dueDate: p.dueDate } : {}) } as never });
        c = { kind: "task_update", id: task.id };
      }
      await qc.invalidateQueries({ queryKey: ["hub"] });
      record("approved", c);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this suggestion.");
      return false;
    } finally { setBusy(false); }
  };
  approveRef.current = approve;
  const link = (() => {
    if (!created || !state) return null;
    if (created.kind === "idea") return state.ideas.some(i => i.id === created.id) ? { to: "/ideas" as const, label: "Open idea" } : "gone" as const;
    if (created.kind === "task" || created.kind === "task_update") { const t = state.tasks.find(t => t.id === created.id); return t ? { to: "/projects/$id/tasks/$taskId" as const, params: { id: t.projectId, taskId: t.id }, label: "Open task" } : "gone" as const; }
    const m = state.milestones?.find(m => m.id === created.id); return m ? { to: "/projects/$id/roadmap" as const, params: { id: m.projectId }, label: "Open roadmap" } : "gone" as const;
  })();

  const Icon = p.kind === "task" ? ListPlus : p.kind === "idea" ? Lightbulb : p.kind === "milestone" || p.kind === "milestone_update" ? Flag : PencilLine;
  const heading = p.kind === "task" ? `New task in ${p.projectTitle}${p.milestoneTitle ? ` · ${p.milestoneTitle}` : ""}` : p.kind === "idea" ? "New idea" : p.kind === "milestone" ? `New milestone in ${p.projectTitle}` : p.kind === "milestone_update" ? `Change milestone “${p.milestoneTitle}”` : `Change “${p.taskTitle}”`;
  const body = p.kind === "task_update" ? [p.status && `Status → ${p.status.replace("_", " ")}`, p.title && `Title → ${p.title}`, p.milestoneTitle && `Milestone → ${p.milestoneTitle}`, p.dueDate && `Due → ${p.dueDate}`].filter(Boolean).join(" · ")
    : p.kind === "milestone_update" ? [p.title && `Title → ${p.title}`, p.targetDate && `Target → ${p.targetDate}`].filter(Boolean).join(" · ")
    : p.kind === "milestone" ? `${p.title}${p.targetDate ? ` · target ${p.targetDate}` : ""}` : p.title;
  const detail = p.kind === "task" || p.kind === "idea" ? p.description : p.kind === "milestone" ? p.outcome : undefined;
  return (
    <div data-testid="chat-proposal" className="rounded-xl border bg-card p-3 text-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" />{heading}</div>
      <p className="mt-1 font-medium">{body}</p>
      {detail && <p className="mt-1 text-muted-foreground">{detail}</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        {decision ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">{decision === "approved" ? (link === "gone" ? "No longer in your workspace." : "Saved to your workspace.") : "Dismissed."}
            {decision === "approved" && link && link !== "gone" && <Link to={link.to} params={"params" in link ? link.params : undefined as never} data-testid="link-proposal-created" className="font-medium text-primary underline-offset-2 hover:underline">{link.label}</Link>}</span>
        ) : (
          <>
            {missing && state && <span className="self-center text-xs text-destructive">{p.kind === "task" ? "That project no longer exists." : p.kind === "milestone" ? "That project no longer exists." : p.kind === "milestone_update" ? "That milestone no longer exists." : "That task no longer exists."}</span>}
            <button disabled={busy || (missing && !!state)} onClick={() => void approve()} data-testid="button-proposal-approve" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"><Check className="h-3.5 w-3.5" />{busy ? "Saving…" : "Approve"}</button>
            <button disabled={busy} onClick={() => record("dismissed")} data-testid="button-proposal-dismiss" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" />Dismiss</button>
          </>
        )}
      </div>
    </div>
  );
}

/** Optional floating-dock layout: conversation card above a pill composer. */
export type DockLayout = { open: boolean; setOpen: (open: boolean) => void; header: (count: number) => ReactNode; leading: ReactNode; trailing: ReactNode };

export function ChatWindow({ threadId, initialMessages, projectId, onActivity, dock, roadmapTab }: { threadId: string; initialMessages: UIMessage[]; projectId?: string; onActivity?: () => void; dock?: DockLayout; roadmapTab?: boolean }) {
  const [tab, setTab] = useState<"chat" | "roadmap">("chat");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const projectRef = useRef(projectId);
  projectRef.current = projectId;
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
    prepareSendMessagesRequest: ({ messages, headers }) => ({ headers, body: { threadId, projectId: projectRef.current, message: messages[messages.length - 1] } }),
  }), [threadId]);
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: e => { let m = e.message; try { m = JSON.parse(m).message ?? m; } catch { /* plain text */ } setErr(m || "Chat failed. Try again."); },
    onFinish: () => { onActivity?.(); if (!dock || dock.open) textareaRef.current?.focus(); },
  });
  useEffect(() => { if (!dock) textareaRef.current?.focus(); }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = status === "submitted" || status === "streaming";
  const submit = (msg: { text: string }) => {
    const t = msg.text.trim();
    if (!t || busy) return;
    setErr(""); setText("");
    dock?.setOpen(true);
    void sendMessage({ text: t });
  };
  // Pages (e.g. a project roadmap) can ask the dock a ready-made question.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!dock) return;
    const onAsk = (e: Event) => { const text = (e as CustomEvent<string>).detail; if (typeof text === "string") submitRef.current({ text }); };
    window.addEventListener(DOCK_ASK_EVENT, onAsk);
    if (pendingDockAsk) { const t = pendingDockAsk; pendingDockAsk = null; submitRef.current({ text: t }); }
    return () => window.removeEventListener(DOCK_ASK_EVENT, onAsk);
  }, [!!dock]); // eslint-disable-line react-hooks/exhaustive-deps
  const conversation = (
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5">
          {messages.length === 0 ? (
            <ConversationEmptyState icon={<AgentMark className="h-10 w-10" />} title="Ask about your projects" description="Where did I leave off? What should I do next? I can suggest tasks and ideas — nothing saves until you approve it." />
          ) : messages.map(m => (
            <Message key={m.id} from={m.role}>
              <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground">
                {m.parts.map((part, i) => {
                  if (part.type === "text") return m.role === "assistant" ? <MessageResponse key={i}>{part.text}</MessageResponse> : <p key={i} className="whitespace-pre-wrap">{part.text}</p>;
                  if (part.type.startsWith("tool-")) {
                    const tp = part as unknown as ToolPartLike;
                    return (
                      <div key={i} className="space-y-2">
                        <Tool defaultOpen={false}>
                          <ToolHeader type={tp.type as never} state={tp.state as never} />
                          <ToolContent><ToolInput input={tp.input} /></ToolContent>
                        </Tool>
                        {tp.state === "output-available" && <ProposalCard threadId={threadId} messageId={m.id} part={tp} />}
                        {tp.state === "output-error" && <p className="text-xs text-destructive">{tp.errorText}</p>}
                      </div>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="chat-typing"><AgentMark className="h-6 w-6" /><span className="animate-pulse">Thinking…</span></div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
  );
  if (dock) return (
    <div className="flex flex-col gap-2">
      {dock.open && (
        <div data-testid="chat-dock-card" className="flex h-[min(60dvh,560px)] flex-col overflow-hidden rounded-3xl border bg-card/95 shadow-dock backdrop-blur">
          {dock.header(messages.length)}
          {conversation}
        </div>
      )}
      {(busy || err) && (
        <div className={`self-start rounded-xl border bg-card/95 px-3 py-1.5 text-xs shadow-dock backdrop-blur ${err ? "text-destructive" : "text-muted-foreground"}`} data-testid={err ? "chat-error" : "chat-status"}>
          {err || (status === "submitted" ? "Thinking…" : <>Writing a reply <span className="text-primary">for you</span></>)}
        </div>
      )}
      <PromptInput onSubmit={submit} className="rounded-2xl border bg-card/95 shadow-dock backdrop-blur [&_[data-slot=input-group]]:rounded-2xl">
        <div className="flex w-full items-center gap-1 px-2 py-1.5">
          {dock.leading}
          <PromptInputTextarea ref={textareaRef} value={text} maxLength={CHAT_INPUT_LIMIT} onClick={() => dock.setOpen(true)} onChange={e => setText(e.target.value)} placeholder="Ask CarterHub…" data-testid="input-chat" className="min-h-9 min-w-0 flex-1 truncate py-2" rows={1} />
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} data-testid="button-chat-send" className="shrink-0 rounded-full" />
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {dock.trailing}
        </div>
      </PromptInput>
    </div>
  );
  const roadmapCount = roadmapItems(messages).length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      {roadmapTab && (
        <div role="tablist" className="flex gap-1 border-b px-3 pt-2">
          {(["chat", "roadmap"] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} data-testid={`tab-chat-${t}`} onClick={() => setTab(t)} className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === t ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "chat" ? <><MessageSquare className="h-4 w-4" />Chat</> : <><MapIcon className="h-4 w-4" />Roadmap{roadmapCount > 0 && <span className="rounded-full bg-muted px-1.5 font-mono text-[10px]">{roadmapCount}</span>}</>}
            </button>
          ))}
        </div>
      )}
      {roadmapTab && tab === "roadmap" ? <RoadmapPlan threadId={threadId} messages={messages} busy={busy} onPlan={() => submit({ text: "Plan my roadmap: suggest milestone target dates, which existing tasks belong in each milestone, and due dates. Use suggestion cards, not plain text." })} /> : conversation}
      <div className="border-t p-3">
        {err && <p className="mb-2 text-xs text-destructive" data-testid="chat-error">{err}</p>}
        <PromptInput onSubmit={submit}>
          <PromptInputTextarea ref={textareaRef} value={text} maxLength={CHAT_INPUT_LIMIT} onChange={e => setText(e.target.value)} placeholder={tab === "roadmap" ? "Ask for roadmap changes…" : "Ask CarterHub…"} data-testid="input-chat" />
          <PromptInputFooter>
            <ModelBadge label={UPDATE_MODEL_LABEL} />
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} data-testid="button-chat-send" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

type RoadmapItem = { messageId: string; part: ToolPartLike; group: string };
/** Roadmap-related suggestion cards in a conversation, grouped by milestone. */
function roadmapItems(messages: UIMessage[]): RoadmapItem[] {
  const out: RoadmapItem[] = [];
  for (const m of messages) for (const raw of m.parts) {
    if (!raw.type.startsWith("tool-")) continue;
    const part = raw as unknown as ToolPartLike;
    const p = part.output as Proposal | undefined;
    if (part.state !== "output-available" || !p?.ok) continue;
    const group = p.kind === "milestone" ? p.title : p.kind === "milestone_update" ? p.milestoneTitle : p.kind === "task" && p.milestoneTitle ? p.milestoneTitle : p.kind === "task_update" && (p.milestoneTitle || p.dueDate) ? p.milestoneTitle ?? "Due dates" : null;
    if (group) out.push({ messageId: m.id, part, group });
  }
  return out;
}

function RoadmapPlan({ threadId, messages, busy, onPlan }: { threadId: string; messages: UIMessage[]; busy: boolean; onPlan: () => void }) {
  const items = roadmapItems(messages);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const groups = new Map<string, RoadmapItem[]>();
  for (const it of items) groups.set(it.group, [...(groups.get(it.group) ?? []), it]);
  const pendingIds = items.map(i => i.part.toolCallId).filter(id => approvers.has(id));
  const approveAll = async () => {
    setRunning(true); setNote("");
    let failed = 0;
    // Milestones first so later task cards can find them; one at a time keeps versions fresh.
    const order = [...items].sort((a, b) => Number((b.part.output as Proposal & { kind?: string }).kind === "milestone") - Number((a.part.output as Proposal & { kind?: string }).kind === "milestone"));
    for (const it of order) { const fn = approvers.get(it.part.toolCallId); if (fn && !(await fn())) failed++; }
    setRunning(false);
    if (failed) setNote(`${failed} suggestion${failed > 1 ? "s" : ""} couldn't be saved — see the card${failed > 1 ? "s" : ""} below.`);
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4" data-testid="chat-roadmap-plan">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">Milestone dates, task assignments and due dates suggested in this chat. Nothing saves until you approve.</p>
        <button disabled={busy} onClick={onPlan} data-testid="button-roadmap-plan" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-60"><Waypoints className="h-3.5 w-3.5" />Suggest a roadmap plan</button>
        {pendingIds.length > 1 && <button disabled={running} onClick={() => void approveAll()} data-testid="button-roadmap-approve-all" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"><CheckCheck className="h-3.5 w-3.5" />{running ? "Saving…" : `Approve all (${pendingIds.length})`}</button>}
      </div>
      {note && <p className="mb-3 text-xs text-destructive">{note}</p>}
      {busy && <p className="mb-3 animate-pulse text-sm text-muted-foreground">Thinking…</p>}
      {items.length === 0 && !busy ? <p className="text-sm text-muted-foreground">No roadmap suggestions yet. Click <span className="font-medium">Suggest a roadmap plan</span> or ask below.</p> : (
        <div className="space-y-5">
          {[...groups].map(([g, list]) => (
            <section key={g}>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Flag className="h-3.5 w-3.5" />{g}</h3>
              <div className="space-y-2">{list.map(it => <ProposalCard key={it.part.toolCallId} threadId={threadId} messageId={it.messageId} part={it.part} />)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
