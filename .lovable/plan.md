# Notes box on the task page

Each task already has its own page with due date, progress and milestone, linked from the task list and roadmap. This adds a separate **Notes** box to it.

## What you'll see
1. A **Notes** box on the task page, under the description, for running notes such as progress, links and decisions.
2. It saves with the rest of the task when you click **Save**. Cancel and the unsaved-changes warning work the same as for other fields.
3. The task list shows a small note icon on tasks that have notes.
4. Notes go into the private GitHub backup along with everything else.
5. Assistants can't change your notes, the same rule as for the description and due date.

## Technical details
- Add optional `notes?: string` (max 10,000 characters) to the task type and to the task, create and update zod schemas in `api-zod.ts`. Existing tasks simply have none, so there's no schema migration (it's stored in the workspace JSON).
- In `operations.ts` `updateTask`, apply `notes`, and add it to the agent-restricted fields check.
- `task-detail.tsx`: add `notes` to the draft, show it in a textarea, and send it on save.
- `project-tasks.tsx`: a note icon when `t.notes?.trim()`.
- Assistant resume context leaves notes out, to keep assistant token use flat.
- Test in `operations.test.ts`: the owner can save notes, and an agent actor changing notes is rejected. Verify with `bunx vitest run` and `tsgo`.
