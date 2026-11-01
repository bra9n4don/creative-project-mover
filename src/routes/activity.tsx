import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/activity";

export const Route = createFileRoute("/activity")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Activity · Relay" },
      { name: "description", content: "Everything you and your AI tools changed, in order." },
      { property: "og:title", content: "Activity · Relay" },
      { property: "og:description", content: "Everything you and your AI tools changed, in order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
