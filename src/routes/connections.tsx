import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/connections";

export const Route = createFileRoute("/connections")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AI tools · Relay" },
      { name: "description", content: "Connect your AI tools to Relay so they read and update the same plan." },
      { property: "og:title", content: "AI tools · Relay" },
      { property: "og:description", content: "Connect your AI tools to Relay so they read and update the same plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
