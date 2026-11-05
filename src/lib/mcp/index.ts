import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getContext from "./tools/get-context";
import captureIdea from "./tools/capture-idea";
import addTask from "./tools/add-task";
import updateTask from "./tools/update-task";
import saveCheckpoint from "./tools/save-checkpoint";
import importProject from "./tools/import-project";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "creative-project-mover",
  title: "Creative Project Mover",
  version: "0.1.0",
  instructions: "Relay project memory. Call get_context first to see where the owner left off. You can capture ideas, draft tasks, report task progress with evidence save checkpoints, and send a project started in this chat to the import inbox for review. Only the owner verifies tasks, deletes items or approves plan changes.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getContext, captureIdea, addTask, updateTask, saveCheckpoint, importProject],
});
