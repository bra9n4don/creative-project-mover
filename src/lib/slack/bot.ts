import type { HubState } from "@/lib/hub/store";
import { buildResumeContext } from "@/lib/hub/context";

/** Pure Slack message logic (no transport) so the simulator and webhook share it. */
export type BotAction = { reply: string; idea?: { title: string; description: string } };

const HELP = "Hi, I'm Relay. Try:\n• `where` — where you left off\n• `projects` — list your projects\n• `idea <text>` — save an idea to your Ideas inbox";

export function handleMessage(raw: string, s: HubState): BotAction {
  const text = raw.replace(/<@[A-Z0-9]+>/g, "").trim();
  const [cmd = "", ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();
  switch (cmd.toLowerCase()) {
    case "idea": {
      if (!arg) return { reply: "Add the idea after `idea`, e.g. `idea offline mode`." };
      const title = arg.slice(0, 120);
      return { reply: `Saved to your Ideas inbox: *${title}*`, idea: { title, description: arg.length > 120 ? arg : "" } };
    }
    case "projects": {
      if (!s.projects.length) return { reply: "No projects yet." };
      return { reply: s.projects.slice(0, 15).map(p => `• *${p.title}* — ${p.status}`).join("\n") };
    }
    case "where": case "context": case "resume": {
      const f = buildResumeContext(s).focus;
      if (!f) return { reply: "No projects yet — start one with Kickoff." };
      const tasks = f.openTasks.slice(0, 5).map(t => `• ${t.title}`).join("\n") || "• No open tasks";
      return { reply: `*${f.project.title}* (${f.project.status})\nWhere you left off: ${f.whereYouLeftOff}\nNext: ${f.nextAction}\nOpen tasks:\n${tasks}` };
    }
    default: return { reply: HELP };
  }
}
