import { defineTool } from "@lovable.dev/mcp-js";
import * as ops from "@/lib/hub/operations";
import { CreateTaskBody } from "@/lib/hub/api-zod";
import { assistantActor, runHub, text } from "../actor";

export default defineTool({
  name: "add_task",
  title: "Add task",
  description: "Draft a next-step task in an existing project.",
  inputSchema: CreateTaskBody.shape,
  annotations: { destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => runHub(async () => text(await ops.addTask(await assistantActor(ctx), args))),
});
