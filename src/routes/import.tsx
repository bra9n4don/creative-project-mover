import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/import";

export const Route = createFileRoute("/import")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Import projects · CarterHub" },
      { name: "description", content: "Import projects from ChatGPT, Claude, Perplexity or GitHub and review them before saving." },
      { property: "og:title", content: "Import projects · CarterHub" },
      { property: "og:description", content: "Import projects from ChatGPT, Claude, Perplexity or GitHub and review them before saving." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
