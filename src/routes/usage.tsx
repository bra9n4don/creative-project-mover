import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/usage";

export const Route = createFileRoute("/usage")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Assistant usage · Relay" },
      { name: "description", content: "How many checkpoints, tasks and ideas each connected assistant saves to Relay." },
      { property: "og:title", content: "Assistant usage · Relay" },
      { property: "og:description", content: "How many checkpoints, tasks and ideas each connected assistant saves to Relay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
