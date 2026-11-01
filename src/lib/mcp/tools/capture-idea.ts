import { defineTool } from "@lovable.dev/mcp-js";
import * as ops from "@/lib/hub/operations";
import { ideaShape } from "../schemas";
import { assistantActor, runHub, text } from "../actor";

export default defineTool({
  name: "capture_idea",
  title: "Capture idea",
  description: "Save a new idea to the inbox without interrupting the current project.",
  inputSchema: ideaShape,
  annotations: { destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => runHub(async () => text(await ops.addIdea(await assistantActor(ctx), args))),
});
