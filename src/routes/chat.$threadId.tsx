import { createFileRoute } from "@tanstack/react-router";
import ChatPage from "@/pages/chat";

export const Route = createFileRoute("/chat/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat · CarterHub" },
      { name: "description", content: "Chat with CarterHub about your projects, tasks and ideas." },
      { property: "og:title", content: "Chat · CarterHub" },
      { property: "og:description", content: "Chat with CarterHub about your projects, tasks and ideas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThreadRoute,
});

function ThreadRoute() {
  const { threadId } = Route.useParams();
  return <ChatPage threadId={threadId} />;
}
