import { defineTool } from "@lovable.dev/mcp-js";
import * as ops from "@/lib/hub/operations";
import { updateTaskShape } from "../schemas";
import { assistantActor, runHub, text } from "../actor";

export default defineTool({
  name: "update_task",
  title: "Report task progress",
  description: "Report progress using expectedVersion from the current plan, with real evidence. Assistants can't verify tasks; scope or priority edits become approval requests.",
  inputSchema: updateTaskShape,
  annotations: { destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...data }, ctx) => runHub(async () => text(await ops.editTask(await assistantActor(ctx), id, data))),
});
