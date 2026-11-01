import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/project-detail";

export const Route = createFileRoute("/projects/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Project · Relay" },
      { name: "description", content: "Plan, tasks, checkpoints, and GitHub activity for one project." },
      { property: "og:title", content: "Project · Relay" },
      { property: "og:description", content: "Plan, tasks, checkpoints, and GitHub activity for one project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
