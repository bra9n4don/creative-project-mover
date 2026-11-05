import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Flag, Lightbulb, ListChecks, MessageSquare, Search } from "lucide-react";
import { AppShell } from "@/components/shell";
import { useChatThreads, useInbox } from "@/components/chat/use-chat-threads";
import type { InboxItem } from "@/lib/ai/inbox";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/chat/history")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat history · CarterHub" },
      { name: "description", content: "Every chat with approved AI suggestions, with links to the tasks and ideas it created." },
      { property: "og:title", content: "Chat history · CarterHub" },
      { property: "og:description", content: "Every chat with approved AI suggestions, with links to the tasks and ideas it created." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatHistoryPage,
});

type Group = { threadId: string; title: string; last: string; items: InboxItem[] };

function ChatHistoryPage() {
  const { state, isDemo } = useWorkspace();
  const { data: items = [], isLoading } = useInbox();
  const { data: threads = [] } = useChatThreads();
  const [q, setQ] = useState("");
  const titles = new Map(threads.map(t => [t.id, t.title]));
  const groups = new Map<string, Group>();
  for (const i of items) {
    if (i.status !== "approved") continue;
    const g = groups.get(i.threadId) ?? { threadId: i.threadId, title: titles.get(i.threadId) ?? i.threadTitle, last: i.createdAt, items: [] };
    g.items.push(i); if (i.createdAt > g.last) g.last = i.createdAt;
    groups.set(i.threadId, g);
  }
  const label = (i: InboxItem) => { const p = i.part.output; if (!p?.ok) return ""; return p.kind === "task_update" ? p.taskTitle : p.kind === "milestone_update" ? p.milestoneTitle : p.title; };
  const needle = q.trim().toLowerCase();
  const list = [...groups.values()].sort((a, b) => b.last.localeCompare(a.last))
    .filter(g => !needle || g.title.toLowerCase().includes(needle) || g.items.some(i => label(i).toLowerCase().includes(needle)));

  const link = (i: InboxItem) => {
    const c = i.part.created;
    if (!c || !state) return null;
    if (c.kind === "idea") { const it = state.ideas.find(x => x.id === c.id); return it ? <Link to="/ideas" className="text-primary hover:underline">{it.title}</Link> : <span className="text-muted-foreground">Deleted idea</span>; }
    if (c.kind === "task" || c.kind === "task_update") { const t = state.tasks.find(x => x.id === c.id); return t ? <Link to="/projects/$id/tasks/$taskId" params={{ id: t.projectId, taskId: t.id }} className="text-primary hover:underline">{t.title}</Link> : <span className="text-muted-foreground">Deleted task</span>; }
    const m = state.milestones?.find(x => x.id === c.id); return m ? <Link to="/projects/$id/roadmap" params={{ id: m.projectId }} className="text-primary hover:underline">{m.title}</Link> : <span className="text-muted-foreground">Deleted milestone</span>;
  };
  const icon = (i: InboxItem) => { const k = i.part.created?.kind ?? i.part.output?.kind; return k === "idea" ? <Lightbulb className="h-3.5 w-3.5" /> : k === "milestone" || k === "milestone_update" ? <Flag className="h-3.5 w-3.5" /> : <ListChecks className="h-3.5 w-3.5" />; };

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">Chat history</h1>
        <Link to="/chat" className="ml-auto inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"><MessageSquare className="h-4 w-4" />Back to chat</Link>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Chats where you approved at least one suggestion, newest first, with links to what they created.</p>
      {isDemo ? <p className="text-sm text-muted-foreground">Sign in to see your chat history.</p> : (
        <>
          <label className="mb-4 flex max-w-md items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Search className="h-4 w-4 text-muted-foreground" />
            <input data-testid="input-chat-history-search" className="flex-1 bg-transparent outline-none" placeholder="Search chats, tasks or ideas" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : list.length === 0 ? <p className="text-sm text-muted-foreground">{needle ? "No chats match." : "No approved suggestions yet."}</p> : (
            <ul className="space-y-3">
              {list.map(g => (
                <li key={g.threadId} data-testid="chat-history-item" className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/chat/$threadId" params={{ threadId: g.threadId }} className="font-medium hover:underline">{g.title}</Link>
                    <span className="text-xs text-muted-foreground">{new Date(g.last).toLocaleDateString()} · {g.items.length} approved</span>
                    <Link to="/chat/$threadId" params={{ threadId: g.threadId }} className="ml-auto text-xs font-medium text-primary hover:underline">Open chat</Link>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {g.items.map(i => <li key={i.toolCallId} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />{icon(i)}{link(i) ?? <span>{label(i)}</span>}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
