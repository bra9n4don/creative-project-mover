import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import * as ops from "@/lib/hub/operations";
import { assistantActor, runHub, text } from "../actor";

const priority = z.enum(["low", "medium", "high"]);
export default defineTool({
  name: "import_project",
  title: "Send project to CarterHub",
  description: "Send a project started in this chat to the owner's CarterHub import inbox as a draft. Nothing is saved to projects until the owner reviews and approves it.",
  inputSchema: {
    title: z.string().min(1).max(200).describe("Project name."),
    goal: z.string().max(2000).optional().describe("What the project should achieve."),
    description: z.string().max(5000).optional().describe("Summary of what was discussed and decided."),
    tasks: z.array(z.object({ title: z.string().min(1).max(200), description: z.string().max(1000).optional(), priority: priority.optional() })).max(30).optional().describe("Remaining next steps."),
    ideas: z.array(z.object({ title: z.string().min(1).max(150), description: z.string().max(1000).optional() })).max(15).optional().describe("Side ideas not committed to yet."),
    nextAction: z.string().max(1000).optional().describe("One concrete next step for the handoff."),
    summary: z.string().max(2000).optional().describe("Progress and open questions for the handoff."),
  },
  annotations: { destructiveHint: false, openWorldHint: false },
  handler: async (a, ctx) => runHub(async () => {
    const actor = await assistantActor(ctx);
    const source = /chatgpt|openai/i.test(actor.source) ? "chatgpt" : /claude|anthropic/i.test(actor.source) ? "claude" : /perplexity/i.test(actor.source) ? "perplexity" : "assistant";
    return text(await ops.createImportDraft(actor, {
      source, sourceDetail: actor.source,
      content: {
        project: { title: a.title, goal: a.goal ?? "", description: a.description ?? "" },
        tasks: (a.tasks ?? []).map(t => ({ title: t.title, description: t.description ?? "", priority: t.priority ?? "medium" })),
        ideas: (a.ideas ?? []).map(i => ({ title: i.title, description: i.description ?? "" })),
        handoff: a.summary && a.nextAction ? { title: `Imported from ${actor.source}`, summary: a.summary, nextAction: a.nextAction, target: "Next session" } : null,
      },
    }));
  }),
});
