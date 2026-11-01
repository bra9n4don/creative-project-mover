import { defineTool } from "@lovable.dev/mcp-js";
import * as ops from "@/lib/hub/operations";
import { checkpointShape } from "../schemas";
import { assistantActor, runHub, text } from "../actor";

export default defineTool({
  name: "save_checkpoint",
  title: "Save checkpoint",
  description: "Save where the user left off before stopping: real progress, evidence, blockers and one small next action.",
  inputSchema: checkpointShape,
  annotations: { destructiveHint: false, openWorldHint: false },
  handler: async (args, ctx) => runHub(async () => text(await ops.addHandoff(await assistantActor(ctx), args))),
});
