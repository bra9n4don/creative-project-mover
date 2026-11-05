import { createFileRoute } from "@tanstack/react-router";
import ProjectTasks from "@/pages/project-tasks";

export const Route = createFileRoute("/projects/$id_/tasks")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Project task list · CarterHub" },
    { name: "description", content: "Manage a project's tasks, due dates, status, and progress in CarterHub." },
    { property: "og:title", content: "Project task list · CarterHub" },
    { property: "og:description", content: "Manage a project's tasks, due dates, status, and progress in CarterHub." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProjectTasks,
});