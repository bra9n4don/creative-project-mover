import { useState } from "react";
import type { UIMessage } from "ai";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ChatWindow, AgentMark } from "@/components/chat/chat-window";
import { useChatThreadActions, useChatThreadMessages, useChatThreads } from "@/components/chat/use-chat-threads";
import { useWorkspace } from "@/lib/workspace";

function ThreadList({ activeId }: { activeId: string }) {
  const { data: threads = [] } = useChatThreads();
  const actions = useChatThreadActions();
  const navigate = useNavigate();
  const newChat = async () => { const t = await actions.create(); void navigate({ to: "/chat/$threadId", params: { threadId: t.id } }); };
  return (
    <div className="flex h-full flex-col">
      <button onClick={() => void newChat()} data-testid="button-new-chat" className="mb-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
        <MessageSquarePlus className="h-4 w-4" /> New chat
      </button>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {threads.map(t => (
          <li key={t.id} className={`group flex items-center gap-1 rounded-lg pr-1 ${t.id === activeId ? "bg-accent" : "hover:bg-accent/60"}`}>
            <Link to="/chat/$threadId" params={{ threadId: t.id }} data-testid="link-chat-thread" className="min-w-0 flex-1 truncate px-3 py-2 text-sm">{t.title}</Link>
            <button aria-label="Rename chat" className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus:opacity-100" onClick={() => { const n = window.prompt("Rename chat", t.title)?.trim(); if (n) void actions.rename(t.id, n); }}><Pencil className="h-3.5 w-3.5" /></button>
            <button aria-label="Delete chat" className="rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 focus:opacity-100" onClick={async () => {
              if (!window.confirm(`Delete “${t.title}”?`)) return;
              await actions.remove(t.id);
              if (t.id === activeId) void navigate({ to: "/chat" });
            }}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatThreadView({ threadId, projectId, onActivity, dock }: { threadId: string; projectId?: string; onActivity?: () => void; dock?: DockLayout }) {
  const { data, isLoading, error } = useChatThreadMessages(threadId);
  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading chat…</p>;
  if (error) return <p className="p-6 text-sm text-destructive">{error.message}</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">This chat no longer exists. <Link to="/chat" className="text-primary underline">Start another</Link>.</p>;
  return <ChatWindow key={threadId} threadId={threadId} initialMessages={data.messages as unknown as UIMessage[]} projectId={projectId} onActivity={onActivity} dock={dock} />;
}

export default function ChatPage({ threadId }: { threadId: string }) {
  const { isDemo } = useWorkspace();
  const actions = useChatThreadActions();
  const [showList, setShowList] = useState(false);
  return (
    <AppShell>
      <div className="mb-4 flex items-center gap-3">
        <AgentMark />
        <h1 className="font-display text-2xl font-semibold">Chat</h1>
        <button className="ml-auto rounded-lg border px-3 py-1.5 text-sm md:hidden" onClick={() => setShowList(s => !s)}>{showList ? "Hide chats" : "Chats"}</button>
      </div>
      {isDemo ? <p className="text-sm text-muted-foreground">Sign in to chat with your workspace.</p> : (
        <div className="grid h-[calc(100dvh-13rem)] min-h-[420px] gap-4 md:h-[calc(100dvh-10rem)] md:grid-cols-[240px_1fr]">
          <aside className={`${showList ? "block" : "hidden"} min-h-0 md:block`}><ThreadList activeId={threadId} /></aside>
          <section className={`${showList ? "hidden" : "flex"} min-h-0 flex-col overflow-hidden rounded-2xl border bg-background md:flex`}>
            <ChatThreadView threadId={threadId} onActivity={() => void actions.refresh()} />
          </section>
        </div>
      )}
    </AppShell>
  );
}
