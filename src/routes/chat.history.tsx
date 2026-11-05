import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ChatHistoryList } from "@/components/chat/chat-history-list";

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

function ChatHistoryPage() {
  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold">Chat history</h1>
        <Link to="/chat" className="ml-auto inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"><MessageSquare className="h-4 w-4" />Back to chat</Link>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Chats where you approved at least one suggestion, newest first, with links to what they created.</p>
      <ChatHistoryList />
    </AppShell>
  );
}
