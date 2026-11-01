import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/overview";

export const Route = createFileRoute("/overview")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Overview · Relay" },
      { name: "description", content: "Where you left off on every project, with one clear next step." },
      { property: "og:title", content: "Overview · Relay" },
      { property: "og:description", content: "Where you left off on every project, with one clear next step." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
