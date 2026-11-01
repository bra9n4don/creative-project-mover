import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/projects";

export const Route = createFileRoute("/projects/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Projects · Relay" },
      { name: "description", content: "All your projects, their progress, and what to do next." },
      { property: "og:title", content: "Projects · Relay" },
      { property: "og:description", content: "All your projects, their progress, and what to do next." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
