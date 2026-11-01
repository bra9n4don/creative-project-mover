import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password · Relay" },
      { name: "description", content: "Get a link to choose a new Relay password." },
      { property: "og:title", content: "Reset password · Relay" },
      { property: "og:description", content: "Get a link to choose a new Relay password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthPage mode="forgot" />,
});
