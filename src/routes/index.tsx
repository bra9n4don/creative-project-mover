import { createFileRoute, Navigate } from "@tanstack/react-router";
import Landing from "@/pages/landing";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Relay — where you left off" },
      { name: "description", content: "Relay remembers where you left off on every project, across all your AI tools." },
      { property: "og:title", content: "Relay · AI Project Hub" },
      { property: "og:description", content: "Relay remembers where you left off on every project, across all your AI tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Navigate to="/overview" />;
  return <Landing />;
}
