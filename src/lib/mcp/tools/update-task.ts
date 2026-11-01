import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod/v4";
import * as ops from "@/lib/hub/operations";
import { UpdateTaskBody } from "@/lib/hub/api-zod";
import { assistantActor, runHub, text } from "../actor";

export default defineTool({
  name: "update_task",
  title: "Report task progress",
  description: "Report progress using expectedVersion from the current plan, with real evidence. Assistants can't verify tasks; scope or priority edits become approval requests.",
  inputSchema: { id: z.string().min(1).describe("Task ID."), ...UpdateTaskBody.shape },
  annotations: { destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...data }, ctx) => runHub(async () => text(await ops.editTask(await assistantActor(ctx), id, data))),
});
