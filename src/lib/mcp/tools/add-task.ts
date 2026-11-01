import { defineTool } from "@lovable.dev/mcp-js";
import * as ops from "@/lib/hub/operations";
import { taskShape } from "../schemas";
import { assistantActor, runHub, text } from "../actor";

export default defineTool({
  name: "add_task",
  title: "Add task",
  description: "Draft a next-step task in an existing project.",
  inputSchema: taskShape,
  annotations: { destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => runHub(async () => text(await ops.addTask(await assistantActor(ctx), args))),
});
