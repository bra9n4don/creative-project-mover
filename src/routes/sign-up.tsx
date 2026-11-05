import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/sign-up")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your workspace · CarterHub" },
      { name: "description", content: "Create your private CarterHub project memory." },
      { property: "og:title", content: "Create your workspace · CarterHub" },
      { property: "og:description", content: "Create your private CarterHub project memory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthPage mode="up" />,
});
