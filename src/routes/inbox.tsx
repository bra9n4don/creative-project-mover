import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AppShell } from "@/components/shell";
import { ProposalCard } from "@/components/chat/chat-window";
import { listInboxFn } from "@/lib/ai/chat.functions";
import type { InboxStatus } from "@/lib/ai/inbox";
import { useWorkspace } from "@/lib/workspace";

const tabs: { id: InboxStatus; label: string }[] = [
  { id: "waiting", label: "Waiting" },
  { id: "approved", label: "Approved" },
  { id: "dismissed", label: "Dismissed" },
];

export const Route = createFileRoute("/inbox")({
  ssr: false,
  validateSearch: z.object({ tab: z.enum(["waiting", "approved", "dismissed"]).optional() }),
  head: () => ({
    meta: [
      { title: "AI inbox · CarterHub" },
      { name: "description", content: "Every task and idea the AI chat suggested, waiting for your review." },
      { property: "og:title", content: "AI inbox · CarterHub" },
      { property: "og:description", content: "Every task and idea the AI chat suggested, waiting for your review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

export function useInbox() {
  const list = useServerFn(listInboxFn);
  return useQuery({ queryKey: ["chat", "inbox"], queryFn: () => list() });
}

function InboxPage() {
  const tab = Route.useSearch().tab ?? "waiting";
  const { isDemo, authLoaded } = useWorkspace();
  const q = useInbox();
  const items = (q.data ?? []).filter(i => i.status === tab);
  const count = (s: InboxStatus) => (q.data ?? []).filter(i => i.status === s).length;
  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">AI inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">Suggestions from the chat land here, so none get lost when you close the bar. Nothing saves until you approve it.</p>
      <div className="mt-5 flex gap-2" role="tablist">
        {tabs.map(t => (
          <Link key={t.id} to="/inbox" search={{ tab: t.id }} role="tab" aria-selected={tab === t.id} data-testid={`tab-inbox-${t.id}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            {t.label} <span className="opacity-70">{count(t.id)}</span>
          </Link>
        ))}
      </div>
      <div className="mt-5 space-y-3" data-testid="list-inbox">
        {authLoaded && isDemo && <p className="text-sm text-muted-foreground">Sign in to see your AI inbox.</p>}
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.error && <p className="text-sm text-destructive">{q.error.message}</p>}
        {q.data && items.length === 0 && <p className="text-sm text-muted-foreground">{tab === "waiting" ? "Nothing waiting. Ask the chat what to do next." : "Nothing here yet."}</p>}
        {items.map(i => (
          <div key={`${i.messageId}-${i.toolCallId}`}>
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{new Date(i.createdAt).toLocaleString()} · {i.threadTitle}</span>
              <Link to="/chat/$threadId" params={{ threadId: i.threadId }} className="underline-offset-2 hover:underline">Open chat</Link>
            </div>
            <ProposalCard threadId={i.threadId} messageId={i.messageId} part={i.part} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
