import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Maximize2, MessageCircle, MessageSquarePlus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ChatThreadView } from "@/pages/chat";
import { useChatThreadActions, useChatThreads } from "./use-chat-threads";
import { AgentMark } from "./chat-window";

/** Slide-out chat that continues the latest conversation from any page. */
export function ChatPanelButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (pathname.startsWith("/chat")) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Open chat" data-testid="button-open-chat" className={className}><MessageCircle className="h-5 w-5" /></button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          {open && <PanelBody projectId={pathname.match(/^\/projects\/([^/]+)/)?.[1]} onClose={() => setOpen(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function PanelBody({ projectId, onClose }: { projectId?: string; onClose: () => void }) {
  const { data, error } = useChatThreads();
  const actions = useChatThreadActions();
  const [threadId, setThreadId] = useState<string>();
  useEffect(() => {
    if (!data || threadId) return;
    if (data[0]) setThreadId(data[0].id);
    else void actions.create().then(t => setThreadId(t.id));
  }, [data, threadId, actions]);
  return (
    <>
      <div className="flex items-center gap-2 border-b px-4 py-3 pr-12">
        <AgentMark className="h-6 w-6" />
        <SheetTitle className="truncate text-base">{data?.find(t => t.id === threadId)?.title ?? "Chat"}</SheetTitle>
        <button aria-label="New chat" title="New chat" className="ml-auto rounded p-1.5 hover:bg-accent" onClick={() => void actions.create().then(t => setThreadId(t.id))}><MessageSquarePlus className="h-4 w-4" /></button>
        {threadId && <Link to="/chat/$threadId" params={{ threadId }} onClick={onClose} aria-label="Open full page" title="Open full page" className="rounded p-1.5 hover:bg-accent"><Maximize2 className="h-4 w-4" /></Link>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {error ? <p className="p-4 text-sm text-destructive">{error.message}</p> : threadId ? <ChatThreadView threadId={threadId} projectId={projectId} onActivity={() => void actions.refresh()} /> : <p className="p-4 text-sm text-muted-foreground">Opening chat…</p>}
      </div>
    </>
  );
}
