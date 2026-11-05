import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell";
import { ChatHistoryList } from "@/components/chat/chat-history-list";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/projects/$id_/chats")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Project chats · CarterHub" },
    { name: "description", content: "The AI conversations that created or changed this project's tasks and milestones." },
    { property: "og:title", content: "Project chats · CarterHub" },
    { property: "og:description", content: "The AI conversations that created or changed this project's tasks and milestones." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProjectChats,
});

function ProjectChats() {
  const { id } = Route.useParams();
  const { state } = useWorkspace();
  const project = state?.projects.find(p => p.id === id);
  return (
    <AppShell>
      <Link to="/projects/$id" params={{ id }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />{project?.title ?? "Project"}</Link>
      <h1 className="mb-2 font-display text-2xl font-semibold">Chats</h1>
      <p className="mb-4 text-sm text-muted-foreground">AI conversations where you approved a task or milestone for this project. Ideas approved in the same chat are listed too.</p>
      <ChatHistoryList projectId={id} />
    </AppShell>
  );
}
