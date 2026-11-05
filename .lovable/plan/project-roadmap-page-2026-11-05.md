# Project roadmap page

Each project gets a **Roadmap** page showing its milestones, target dates and progress. The AI dock can suggest next steps there.

## What you'll see
1. A **Roadmap** link on every project page, next to Tasks, opening `/projects/<project>/roadmap`.
2. A list of milestones in order. Each one shows its title, outcome, target date, and a progress bar (done tasks out of all its tasks). It's marked **Overdue** when the target date has passed and work is unfinished, or **Done** when every task is finished.
3. Add, rename, reorder, date or delete milestones. Deleting one keeps its tasks; they move to **Not in a milestone**.
4. Assign tasks to a milestone from the roadmap or the project's task list.
5. Kickoff plans fill this in for you: finishing the plan step creates one milestone per plan milestone, with its tasks already assigned. Your existing Kickoff projects aren't back-filled with guesses.
6. **AI next steps:**
   - A **Suggest next steps** button sends a ready-made question about this roadmap to the dock and opens it.
   - On a roadmap page the dock knows the milestones and can suggest new tasks (with a milestone), a new milestone, or a target-date change.
   - Every suggestion needs your Approve, and each one also lands in the AI inbox.

## Technical details
- Storage stays in the workspace aggregate: add `milestones[]` (id, projectId, title, outcome, targetDate date-only, order, timestamps) and optional `task.milestoneId`. No new table and no migration; older workspaces load with an empty list.
- Milestone create/update/delete/reorder and task assignment go through `operations.ts` via `mutateState`, with audit events. The same paths serve server functions and assistant endpoints.
- Kickoff step-3 review upserts milestones by mapped id (no duplicates on re-review) and sets `milestoneId` on the tasks it creates.
- Pure `milestoneProgress()` helper (percent, done/total, overdue, done), shared by the page and tests.
- Chat: the dock passes `projectId` plus `view: "roadmap"`. The resume context adds a capped milestone summary (max 12). New `propose_milestone` and `propose_milestone_update` tools. `propose_task` gains an optional `milestoneId`. Approval cards call the new milestone operations.
- New route `src/routes/projects.$id_.roadmap.tsx` (unnested, like the tasks page) with its own page title.
- Tests: progress/overdue rules, deleting a milestone keeps its tasks, Kickoff mapping doesn't duplicate, and new proposals validate ids.
- Record the milestones rule in AGENTS.md. Verify with `bunx vitest run` and `tsgo`. No publish.
