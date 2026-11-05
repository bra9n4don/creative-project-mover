import { createFileRoute } from "@tanstack/react-router";
import DashboardPage from "@/pages/dashboard";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { days: 7 | 30; project: string } => ({ days: Number(search.days) === 7 ? 7 : 30, project: typeof search.project === "string" ? search.project : "" }),
  head: () => ({ meta: [
    { title: "Project dashboard · CarterHub" },
    { name: "description", content: "Your CarterHub project progress, daily task activity, and inactive task counts." },
    { property: "og:title", content: "Project dashboard · CarterHub" },
    { property: "og:description", content: "Your CarterHub project progress, daily task activity, and inactive task counts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <DashboardPage days={search.days} projectId={search.project}
    onDays={days => void navigate({ search: prev => ({ ...prev, days }) })}
    onProject={project => void navigate({ search: prev => ({ ...prev, project }) })} />;
}