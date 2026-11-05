import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { buildChatSources, buildTaskChatTouches } from "@/lib/ai/inbox";
import { useChatThreads, useInbox } from "./use-chat-threads";

/** Created-id → source chat map, built from the cached AI inbox query. */
export function useChatSources() {
  const inbox = useInbox();
  const threads = useChatThreads();
  return useMemo(() => {
    const live = new Set((threads.data ?? []).map(t => t.id));
    const all = buildChatSources(inbox.data ?? []);
    return Object.fromEntries(Object.entries(all).filter(([, s]) => live.has(s.threadId)));
  }, [inbox.data, threads.data]);
}

/** "From chat" link back to the conversation that suggested this item; renders nothing if unknown. */
export function ChatSourceLink({ id, sources }: { id: string; sources: ReturnType<typeof useChatSources> }) {
  const s = sources[id];
  if (!s) return null;
  return (
    <Link to="/chat/$threadId" params={{ threadId: s.threadId }} data-testid={`link-chat-source-${id}`} className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
      <MessageSquare className="h-3 w-3" />{s.kind.endsWith("_update") ? "Changed in chat" : "From chat"}
    </Link>
  );
}

/** Task id → newest approved chat that created/changed it (+ count of other chats). */
export function useTaskChatTouches() {
  const inbox = useInbox();
  const threads = useChatThreads();
  return useMemo(() => {
    const titles = new Map((threads.data ?? []).map(t => [t.id, t.title] as const));
    const touches = buildTaskChatTouches(inbox.data ?? [], new Set(titles.keys()));
    for (const t of Object.values(touches)) t.threadTitle = titles.get(t.threadId) || t.threadTitle;
    return touches;
  }, [inbox.data, threads.data]);
}

/** Compact one-line "From chat · <title> +N" pill; renders nothing when no chat touched the task. */
export function ChatTouchPill({ id, touches }: { id: string; touches: ReturnType<typeof useTaskChatTouches> }) {
  const t = touches[id];
  if (!t) return null;
  return (
    <Link to="/chat/$threadId" params={{ threadId: t.threadId }} title={`From chat: ${t.threadTitle}${t.others ? ` and ${t.others} more` : ""}`} data-testid={`pill-chat-${id}`} className="inline-flex max-w-[11rem] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20">
      <MessageSquare className="h-3 w-3 shrink-0" /><span className="min-w-0 truncate">From chat · {t.threadTitle}</span>{t.others > 0 && <span className="shrink-0">+{t.others}</span>}
    </Link>
  );
}
