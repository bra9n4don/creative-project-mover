import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/ideas";

export const Route = createFileRoute("/ideas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ideas · Relay" },
      { name: "description", content: "Capture ideas without losing focus on the current project." },
      { property: "og:title", content: "Ideas · Relay" },
      { property: "og:description", content: "Capture ideas without losing focus on the current project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
