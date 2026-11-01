import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/handoffs";

export const Route = createFileRoute("/handoffs")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Checkpoints · Relay" },
      { name: "description", content: "Saved checkpoints so you can pick up exactly where you left off." },
      { property: "og:title", content: "Checkpoints · Relay" },
      { property: "og:description", content: "Saved checkpoints so you can pick up exactly where you left off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
