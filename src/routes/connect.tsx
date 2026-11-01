import { createFileRoute } from "@tanstack/react-router";
import ConnectPage from "@/pages/connect";

export const Route = createFileRoute("/connect")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Connect an assistant · Relay" },
    { name: "description", content: "Step-by-step instructions to connect ChatGPT, Claude or Claude Code to your Relay workspace." },
    { property: "og:title", content: "Connect an assistant · Relay" },
    { property: "og:description", content: "Step-by-step instructions to connect ChatGPT, Claude or Claude Code to your Relay workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ConnectPage,
});
