import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/sign-in")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · CarterHub" },
      { name: "description", content: "Sign in to your private CarterHub workspace." },
      { property: "og:title", content: "Sign in · CarterHub" },
      { property: "og:description", content: "Sign in to your private CarterHub workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthPage mode="in" />,
});
