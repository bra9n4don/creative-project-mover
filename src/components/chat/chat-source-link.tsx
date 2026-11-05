import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { buildChatSources } from "@/lib/ai/inbox";
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
