import { createFileRoute } from "@tanstack/react-router";
import ProjectRoadmap from "@/pages/project-roadmap";

export const Route = createFileRoute("/projects/$id_/roadmap")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Project roadmap · CarterHub" },
    { name: "description", content: "See a project's milestones, target dates and progress, and get AI-suggested next steps." },
    { property: "og:title", content: "Project roadmap · CarterHub" },
    { property: "og:description", content: "See a project's milestones, target dates and progress, and get AI-suggested next steps." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProjectRoadmap,
});
