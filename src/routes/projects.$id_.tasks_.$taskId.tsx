import { createFileRoute } from "@tanstack/react-router";
import TaskDetail from "@/pages/task-detail";

export const Route = createFileRoute("/projects/$id_/tasks_/$taskId")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Task details · CarterHub" },
    { name: "description", content: "See and edit one task's status, due date and roadmap milestone in CarterHub." },
    { property: "og:title", content: "Task details · CarterHub" },
    { property: "og:description", content: "See and edit one task's status, due date and roadmap milestone in CarterHub." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TaskDetail,
});
