import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronsDownUp, Maximize2, MoreHorizontal, Plus } from "lucide-react";
import { ChatThreadView } from "@/pages/chat";
import { useChatThreadActions, useChatThreads } from "./use-chat-threads";
import { AgentMark } from "./chat-window";

const OPEN_KEY = "carterhub.chatDock.open";
const iconBtn = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground";

/** Floating chat dock on every page except the full Chat page; continues the latest conversation. */
export function ChatDock() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [open, setOpenState] = useState(false);
  useEffect(() => { setOpenState(localStorage.getItem(OPEN_KEY) === "1"); }, []);
  const setOpen = (v: boolean) => { setOpenState(v); localStorage.setItem(OPEN_KEY, v ? "1" : "0"); };
  if (pathname.startsWith("/chat")) return null;
  return (
    <div data-testid="chat-dock" className="fixed left-3 right-20 z-40 md:left-[calc(16rem+1.5rem)] md:right-6 md:mx-auto md:max-w-2xl bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5">
      <DockBody open={open} setOpen={setOpen} projectId={pathname.match(/^\/projects\/([^/]+)/)?.[1]} />
    </div>
  );
}

function DockBody({ open, setOpen, projectId }: { open: boolean; setOpen: (v: boolean) => void; projectId?: string }) {
  const { data, error } = useChatThreads();
  const actions = useChatThreadActions();
  const [threadId, setThreadId] = useState<string>();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!data || threadId) return;
    if (data[0]) setThreadId(data[0].id);
    else void actions.create().then(t => setThreadId(t.id));
  }, [data, threadId, actions]);
  const title = data?.find(t => t.id === threadId)?.title ?? "Chat";
  const newChat = () => void actions.create().then(t => { setThreadId(t.id); setOpen(true); });
  if (error) return <p className="rounded-2xl border bg-card p-3 text-sm text-destructive">{error.message}</p>;
  if (!threadId) return <div className="rounded-2xl border bg-card/95 px-4 py-3 text-sm text-muted-foreground shadow-dock">Opening chat…</div>;
  return (
    <div className="relative">
      {menu && (
        <div className="absolute bottom-full right-0 mb-2 max-h-72 w-64 overflow-y-auto rounded-2xl border bg-card p-1.5 shadow-dock" role="menu">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent chats</p>
          {(data ?? []).slice(0, 15).map(t => (
            <button key={t.id} role="menuitem" onClick={() => { setThreadId(t.id); setMenu(false); setOpen(true); }} className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent ${t.id === threadId ? "bg-secondary font-medium" : ""}`}>{t.title}</button>
          ))}
        </div>
      )}
      <ChatThreadView threadId={threadId} projectId={projectId} onActivity={() => void actions.refresh()} dock={{
        open, setOpen,
        header: count => (
          <div className="flex items-center gap-2 px-4 pb-1 pt-3">
            <AgentMark className="h-6 w-6" />
            <span className="truncate font-semibold">{title}</span>
            {count > 0 && <span className="rounded-md bg-secondary px-1.5 text-xs text-muted-foreground">{count}</span>}
            <button aria-label="Collapse chat" title="Collapse" onClick={() => setOpen(false)} className={`${iconBtn} ml-auto`}><ChevronsDownUp className="h-4 w-4" /></button>
          </div>
        ),
        leading: <button aria-label="New chat" title="New chat" onClick={newChat} className={iconBtn}><Plus className="h-4 w-4" /></button>,
        trailing: <>
          <Link to="/chat/$threadId" params={{ threadId }} aria-label="Open full page" title="Open full page" className={iconBtn}><Maximize2 className="h-4 w-4" /></Link>
          <button aria-label="Recent chats" title="Recent chats" onClick={() => setMenu(m => !m)} className={iconBtn}><MoreHorizontal className="h-4 w-4" /></button>
        </>,
      }} />
    </div>
  );
}
