import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "New password · Relay" },
      { name: "description", content: "Choose a new password for your Relay workspace." },
      { property: "og:title", content: "New password · Relay" },
      { property: "og:description", content: "Choose a new password for your Relay workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthPage mode="reset" />,
});
