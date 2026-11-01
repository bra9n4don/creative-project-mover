import { createFileRoute } from "@tanstack/react-router";
import KickoffPage from "@/pages/kickoff";
export const Route = createFileRoute("/kickoff")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Kickoff · Relay" },
    { name: "description", content: "Shape an idea into a reviewed project brief, milestones and first actions with Relay Kickoff." },
    { property: "og:title", content: "Kickoff · Relay" },
    { property: "og:description", content: "Shape an idea into a reviewed project brief, milestones and first actions with Relay Kickoff." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: KickoffPage,
});