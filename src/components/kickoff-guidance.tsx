import { Lightbulb } from "lucide-react";

const guidance = [
  ["Get every idea out before choosing a direction.", "A small recipe app for home cooks who need to scale portions.", "Start with the problem, who feels it, and why you care."],
  ["Answer what you know. “Not sure yet” is a valid answer.", "Audience: busy home cooks. Time available: two evenings a week.", "Keep the first version small enough for your available time."],
  ["Turn your answers into a brief, then make it yours.", "Success: five people can scale a recipe without help.", "Separate essentials from nice-to-haves. Name assumptions as unknowns."],
  ["Choose milestones and small tasks that move the project forward.", "Milestone: working recipe form. Task: test portion calculations.", "Each milestone should have a visible result. Keep starter tasks concrete."],
  ["Name the biggest risks and three actions for this week.", "Risk: not enough time. First action: ask three cooks about their workflow.", "Pick actions you can start now, especially ones that reduce uncertainty."],
  ["Review the brief and plan before starting the project.", "The goal is clear, the first version is manageable, and the first action is ready.", "Go back to adjust anything that still feels too vague or too large."],
];
export function KickoffGuidance({ step }: { step: number }) {
  const g = guidance[step];
  if (!g) return null;
  return <aside className="space-y-4 border-l-2 border-primary pl-4 text-sm">
    <div className="flex items-center gap-2 font-medium"><Lightbulb className="h-4 w-4 text-primary" /> A starting point</div>
    <p>{g[0]}</p>
    <div><h3 className="mb-1 text-xs font-medium text-muted-foreground">Example</h3><p className="text-muted-foreground">{g[1]}</p></div>
    <div><h3 className="mb-1 text-xs font-medium text-muted-foreground">Tip</h3><p className="text-muted-foreground">{g[2]}</p></div>
  </aside>;
}