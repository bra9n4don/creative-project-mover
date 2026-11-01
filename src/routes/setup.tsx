import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/setup";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Owner setup · Relay" },
      { name: "description", content: "Create your account, claim your Relay workspace and reconnect your AI tools." },
      { property: "og:title", content: "Owner setup · Relay" },
      { property: "og:description", content: "Create your account, claim your Relay workspace and reconnect your AI tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
