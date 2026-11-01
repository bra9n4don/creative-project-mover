import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/approvals";

export const Route = createFileRoute("/approvals")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Approvals · Relay" },
      { name: "description", content: "Review plan changes your AI tools proposed before they apply." },
      { property: "og:title", content: "Approvals · Relay" },
      { property: "og:description", content: "Review plan changes your AI tools proposed before they apply." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
