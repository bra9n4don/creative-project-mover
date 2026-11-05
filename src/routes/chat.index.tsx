import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/shell";
import { useChatThreadActions, useChatThreads } from "@/components/chat/use-chat-threads";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/chat/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat · CarterHub" },
      { name: "description", content: "Ask CarterHub about your projects and get suggested tasks to approve." },
      { property: "og:title", content: "Chat · CarterHub" },
      { property: "og:description", content: "Ask CarterHub about your projects and get suggested tasks to approve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatIndex,
});

/** Opens the most recent chat, or starts one when there are none. */
function ChatIndex() {
  const { isDemo, authLoaded } = useWorkspace();
  const { data, error } = useChatThreads();
  const actions = useChatThreadActions();
  const navigate = useNavigate();
  const started = useRef(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!data || started.current) return;
    started.current = true;
    const go = (id: string) => void navigate({ to: "/chat/$threadId", params: { threadId: id }, replace: true });
    if (data[0]) go(data[0].id);
    else actions.create().then(t => go(t.id), e => setErr(e instanceof Error ? e.message : "Could not start a chat."));
  }, [data, actions, navigate]);
  return (
    <AppShell>
      <p className="text-sm text-muted-foreground">{authLoaded && isDemo ? "Sign in to chat with your workspace." : err || error?.message || "Opening chat…"}</p>
    </AppShell>
  );
}
