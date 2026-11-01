import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/sign-up")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Create your workspace · Relay" },
      { name: "description", content: "Create your private Relay project memory." },
      { property: "og:title", content: "Create your workspace · Relay" },
      { property: "og:description", content: "Create your private Relay project memory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthPage mode="up" />,
});
