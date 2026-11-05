import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ChevronsDownUp, Inbox, Maximize2, MoreHorizontal, Plus } from "lucide-react";
import { useInbox } from "./use-chat-threads";
import { ChatThreadView } from "@/pages/chat";
import { useChatThreadActions, useChatThreads } from "./use-chat-threads";
import { AgentMark, DOCK_ASK_EVENT, setPendingDockAsk } from "./chat-window";

const OPEN_KEY = "carterhub.chatDock.open";
const MINI_KEY = "carterhub.chatDock.mini";
const iconBtn = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground";

/** Floating chat dock on every page except the full Chat page; continues the latest conversation. */
export function ChatDock() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [open, setOpenState] = useState(false);
  const [mini, setMiniState] = useState(true);
  useEffect(() => { setOpenState(localStorage.getItem(OPEN_KEY) === "1"); setMiniState(localStorage.getItem(MINI_KEY) !== "0"); }, []);
  const setOpen = (v: boolean) => { setOpenState(v); localStorage.setItem(OPEN_KEY, v ? "1" : "0"); };
  const setMini = (v: boolean) => { setMiniState(v); localStorage.setItem(MINI_KEY, v ? "1" : "0"); if (v) setOpen(false); };
  // A page asking the dock a question while it's a pill: expand, and the chat sends it once mounted.
  useEffect(() => {
    if (!mini) return;
    const onAsk = (e: Event) => { const t = (e as CustomEvent<string>).detail; if (typeof t !== "string") return; setPendingDockAsk(t); setMiniState(false); localStorage.setItem(MINI_KEY, "0"); setOpen(true); };
    window.addEventListener(DOCK_ASK_EVENT, onAsk);
    return () => window.removeEventListener(DOCK_ASK_EVENT, onAsk);
  }, [mini]); // eslint-disable-line react-hooks/exhaustive-deps
  if (pathname.startsWith("/chat")) return null;
  if (mini) return <MiniDock onExpand={() => setMini(false)} />;
  return (
    <div data-testid="chat-dock" className="fixed left-3 right-20 z-40 md:left-[calc(16rem+1.5rem)] md:right-6 md:mx-auto md:max-w-2xl bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5">
      <DockBody open={open} setOpen={setOpen} onMinimize={() => setMini(true)} projectId={pathname.match(/^\/projects\/([^/]+)/)?.[1]} />
    </div>
  );
}

function DockBody({ open, setOpen, projectId, onMinimize }: { open: boolean; setOpen: (v: boolean) => void; projectId?: string; onMinimize: () => void }) {
  const { data, error } = useChatThreads();
  const actions = useChatThreadActions();
  const [threadId, setThreadId] = useState<string>();
  const [menu, setMenu] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const startupCreate = useRef<ReturnType<typeof actions.create> | null>(null);
  const newChatPending = useRef(false);
  const mounted = useRef(false);
  const selectionVersion = useRef(0);
  const createAction = useRef(actions.create);
  useEffect(() => { createAction.current = actions.create; }, [actions.create]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const waiting = useInbox().data?.filter(i => i.status === "waiting").length ?? 0;
  useEffect(() => {
    if (!data || threadId) return;
    if (data[0]) {
      selectionVersion.current++;
      setThreadId(data[0].id);
      return;
    }
    // Reuse the same request across query rerenders and React effect replays.
    const version = selectionVersion.current;
    const pending = startupCreate.current ??= createAction.current();
    let cancelled = false;
    void pending.then(t => {
      if (!cancelled && mounted.current && selectionVersion.current === version) setThreadId(t.id);
    }).catch(e => {
      if (startupCreate.current === pending) startupCreate.current = null;
      if (!cancelled && mounted.current && selectionVersion.current === version) {
        setCreateError(e instanceof Error ? e.message : "Could not open chat.");
      }
    });
    return () => { cancelled = true; };
  }, [data, threadId, retryCount]);
  const title = data?.find(t => t.id === threadId)?.title ?? "Chat";
  const retryStartup = () => {
    startupCreate.current = null;
    setCreateError(null);
    setRetryCount(n => n + 1);
  };
  const selectThread = (id: string) => {
    selectionVersion.current++;
    setThreadId(id);
    setMenu(false);
    setOpen(true);
  };
  const newChat = () => {
    if (newChatPending.current) return;
    newChatPending.current = true;
    const version = selectionVersion.current;
    setCreateError(null);
    void actions.create().then(t => {
      if (mounted.current && selectionVersion.current === version) {
        selectionVersion.current++;
        setThreadId(t.id);
        setOpen(true);
      }
    }).catch(e => {
      if (mounted.current && selectionVersion.current === version) {
        setCreateError(e instanceof Error ? e.message : "Could not create chat.");
      }
    }).finally(() => { newChatPending.current = false; });
  };
  if (error) return <p className="rounded-2xl border bg-card p-3 text-sm text-destructive">{error.message}</p>;
  if (!threadId && createError) return <div role="alert" className="rounded-2xl border bg-card p-3 text-sm text-destructive">{createError}<button type="button" className="ml-2 underline" onClick={retryStartup}>Retry opening chat</button></div>;
  if (!threadId) return <div className="rounded-2xl border bg-card/95 px-4 py-3 text-sm text-muted-foreground shadow-dock">Opening chat…</div>;
  return (
    <div className="relative">
      {createError && <p role="alert" className="mb-2 rounded-lg border bg-card p-2 text-sm text-destructive">{createError}</p>}
      {menu && (
        <div className="absolute bottom-full right-0 mb-2 max-h-72 w-64 overflow-y-auto rounded-2xl border bg-card p-1.5 shadow-dock" role="menu">
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent chats</p>
          {(data ?? []).slice(0, 15).map(t => (
            <button key={t.id} role="menuitem" onClick={() => selectThread(t.id)} className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent ${t.id === threadId ? "bg-secondary font-medium" : ""}`}>{t.title}</button>
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
          <Link to="/inbox" aria-label="AI inbox" title="AI inbox" data-testid="link-dock-inbox" className={`${iconBtn} relative`}><Inbox className="h-4 w-4" />{waiting > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{waiting}</span>}</Link>
          <Link to="/chat/$threadId" params={{ threadId }} aria-label="Open full page" title="Open full page" className={`${iconBtn} hidden sm:grid`}><Maximize2 className="h-4 w-4" /></Link>
          <button aria-label="Recent chats" title="Recent chats" onClick={() => setMenu(m => !m)} className={iconBtn}><MoreHorizontal className="h-4 w-4" /></button>
          <button aria-label="Shrink chat to a pill" title="Shrink" data-testid="button-dock-minimize" onClick={onMinimize} className={iconBtn}><ChevronRight className="h-4 w-4" /></button>
        </>,
      }} />
    </div>
  );
}

/** Compact toolbar-style pill; the arrow (or the Ask button) opens the full chat bar. */
function MiniDock({ onExpand }: { onExpand: () => void }) {
  const waiting = useInbox().data?.filter(i => i.status === "waiting").length ?? 0;
  return (
    <div data-testid="chat-dock-mini" className="fixed right-20 z-40 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:right-6 md:bottom-5">
      <div className="flex items-center gap-0.5 rounded-full border bg-card/95 p-1 shadow-dock backdrop-blur">
        <button onClick={onExpand} aria-label="Ask CarterHub" title="Ask CarterHub" data-testid="button-dock-expand-ask" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <AgentMark className="h-6 w-6" /><span className="hidden sm:inline">Ask CarterHub…</span>
        </button>
        <Link to="/inbox" aria-label="AI inbox" title="AI inbox" className={`${iconBtn} relative rounded-full`}><Inbox className="h-4 w-4" />{waiting > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{waiting}</span>}</Link>
        <button onClick={onExpand} aria-label="Expand chat" title="Expand" data-testid="button-dock-expand" className={`${iconBtn} rounded-full`}><ChevronLeft className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
