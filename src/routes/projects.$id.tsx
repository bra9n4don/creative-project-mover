import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/project-detail";

export const Route = createFileRoute("/projects/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Project timeline · CarterHub" },
      { name: "description", content: "Project tasks, actual start and end dates, progress, checkpoints, and GitHub activity in CarterHub." },
      { property: "og:title", content: "Project timeline · CarterHub" },
      { property: "og:description", content: "Project tasks, actual start and end dates, progress, checkpoints, and GitHub activity in CarterHub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
