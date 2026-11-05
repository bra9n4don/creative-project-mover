import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lightbulb, ListPlus, PencilLine, Waypoints, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput } from "@/components/ai-elements/tool";
import { ModelBadge } from "@/components/model-badge";
import { UPDATE_MODEL_LABEL } from "@/lib/ai/model";
import { CHAT_INPUT_LIMIT, type Proposal } from "@/lib/ai/chat-tools";
import { decideProposalFn } from "@/lib/ai/chat.functions";
import { useCreateIdea, useCreateTask, useUpdateTask } from "@/lib/hub-api";
import { useWorkspace } from "@/lib/workspace";

export function AgentMark({ className = "h-7 w-7" }: { className?: string }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground ${className}`}><Waypoints className="h-[55%] w-[55%]" /></span>;
}

type ToolPartLike = { type: string; toolCallId: string; state: string; input?: unknown; output?: unknown; errorText?: string; decision?: "approved" | "dismissed" };

function ProposalCard({ threadId, messageId, part }: { threadId: string; messageId: string; part: ToolPartLike }) {
  const p = part.output as Proposal | undefined;
  const [decision, setDecision] = useState(part.decision);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { state } = useWorkspace();
  const qc = useQueryClient();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createIdea = useCreateIdea();
  const decide = useServerFn(decideProposalFn);
  if (!p) return null;
  if (!p.ok) return <p className="text-xs text-muted-foreground">Suggestion couldn't be made: {p.error}</p>;

  const record = (d: "approved" | "dismissed") => { setDecision(d); void decide({ data: { threadId, messageId, toolCallId: part.toolCallId, decision: d } }).catch(() => {}); };
  const approve = async () => {
    setBusy(true); setError("");
    try {
      if (p.kind === "task") await createTask.mutateAsync({ data: { projectId: p.projectId, title: p.title, description: p.description, priority: p.priority } as never });
      else if (p.kind === "idea") await createIdea.mutateAsync({ data: { title: p.title, description: p.description } as never });
      else {
        const task = state?.tasks.find(t => t.id === p.taskId);
        if (!task) throw new Error("That task no longer exists.");
        await updateTask.mutateAsync({ id: p.taskId, data: { expectedVersion: task.version, ...(p.status ? { status: p.status } : {}), ...(p.title ? { title: p.title } : {}) } as never });
      }
      await qc.invalidateQueries({ queryKey: ["hub"] });
      record("approved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this suggestion.");
    } finally { setBusy(false); }
  };

  const Icon = p.kind === "task" ? ListPlus : p.kind === "idea" ? Lightbulb : PencilLine;
  const heading = p.kind === "task" ? `New task in ${p.projectTitle}` : p.kind === "idea" ? "New idea" : `Change “${p.taskTitle}”`;
  const body = p.kind === "task_update" ? [p.status && `Status → ${p.status.replace("_", " ")}`, p.title && `Title → ${p.title}`].filter(Boolean).join(" · ") : p.title;
  const detail = p.kind !== "task_update" ? p.description : undefined;
  return (
    <div data-testid="chat-proposal" className="rounded-xl border bg-card p-3 text-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" />{heading}</div>
      <p className="mt-1 font-medium">{body}</p>
      {detail && <p className="mt-1 text-muted-foreground">{detail}</p>}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="mt-3 flex gap-2">
        {decision ? (
          <span className="text-xs text-muted-foreground">{decision === "approved" ? "Saved to your workspace." : "Dismissed."}</span>
        ) : (
          <>
            <button disabled={busy} onClick={() => void approve()} data-testid="button-proposal-approve" className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"><Check className="h-3.5 w-3.5" />{busy ? "Saving…" : "Approve"}</button>
            <button disabled={busy} onClick={() => record("dismissed")} data-testid="button-proposal-dismiss" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs"><X className="h-3.5 w-3.5" />Dismiss</button>
          </>
        )}
      </div>
    </div>
  );
}

export function ChatWindow({ threadId, initialMessages, projectId, onActivity }: { threadId: string; initialMessages: UIMessage[]; projectId?: string; onActivity?: () => void }) {
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
    onFinish: () => { onActivity?.(); textareaRef.current?.focus(); },
  });
  useEffect(() => { textareaRef.current?.focus(); }, [threadId]);

  const busy = status === "submitted" || status === "streaming";
  return (
    <div className="flex h-full min-h-0 flex-col">
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
      <div className="border-t p-3">
        {err && <p className="mb-2 text-xs text-destructive" data-testid="chat-error">{err}</p>}
        <PromptInput onSubmit={(msg) => {
          const t = msg.text.trim();
          if (!t || busy) return;
          setErr(""); setText("");
          void sendMessage({ text: t });
        }}>
          <PromptInputTextarea ref={textareaRef} value={text} maxLength={CHAT_INPUT_LIMIT} onChange={e => setText(e.target.value)} placeholder="Ask CarterHub…" data-testid="input-chat" />
          <PromptInputFooter>
            <ModelBadge label={UPDATE_MODEL_LABEL} />
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} data-testid="button-chat-send" />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
