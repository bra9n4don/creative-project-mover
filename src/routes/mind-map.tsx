import { createFileRoute } from "@tanstack/react-router";
import MindMapPage from "@/pages/mind-map";

export const Route = createFileRoute("/mind-map")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Mind map · Relay" },
    { name: "description", content: "Brainstorm freely on a saved mind map in your Relay workspace." },
    { property: "og:title", content: "Mind map · Relay" },
    { property: "og:description", content: "Brainstorm freely on a saved mind map in your Relay workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MindMapPage,
});
