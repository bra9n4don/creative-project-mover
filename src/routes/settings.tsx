import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/settings";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings · Relay" },
      { name: "description", content: "Account and automation guardrails for your Relay workspace." },
      { property: "og:title", content: "Settings · Relay" },
      { property: "og:description", content: "Account and automation guardrails for your Relay workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
