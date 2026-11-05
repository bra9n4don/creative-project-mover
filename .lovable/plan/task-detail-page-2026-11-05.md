# Task detail page

Each task gets its own page where you can see it and edit it in one place.

## What you'll see
1. Task titles on the project's task list and roadmap become links to the task's own page.
2. The page shows:
   - title and description
   - status, priority and progress bar
   - due date, with a **Overdue** tag if it has passed and the task isn't finished
   - its roadmap milestone, with the milestone's target date and progress, and an **Open roadmap** link
   - actual start and finish dates when they were recorded (never guessed)
   - links to the tasks it depends on
3. **Edit right on the page:** title, description, status, priority, due date (with a clear button) and milestone. Click **Save**, and **Cancel** discards your changes. Unsaved changes ask before you leave.
4. A **Delete task** button that asks for confirmation, then returns you to the task list.
5. If someone else saved the task first (for example an assistant), you'll see "This task changed, reload to see the latest" instead of overwriting it.
6. The AI inbox **Open task** link and the dashboard go straight to this page instead of the full list.
7. A **Back to tasks** link, and a "Task not found" page if it was deleted.

## Technical details
- New route `src/routes/projects.$id_.tasks.$taskId.tsx` (`/projects/$id_/tasks/$taskId`) with its own `head()`. Content goes in `src/pages/task-detail.tsx`. Flattened to sit under the tasks list as an unnested sibling, so the list needs no `<Outlet />`: the file is named `projects.$id_.tasks_.$taskId.tsx`.
- Data comes from the existing workspace state. Saves use the existing `useUpdateTask` with `expectedVersion`, and the version-conflict error is shown as above. Delete uses `useDeleteTask`. Recorded start/end dates stay on the shared patch path, with no new fields and no schema change.
- Reuses `MilestoneSelect`, `taskProgress`, and the milestone progress helper from the roadmap page.
- Update `ProposalCard` link targets for `task` and `task_update` to the new route.
- Test: an overdue tag only for an unfinished task past its due date, kept with the timeline tests. Verify with `bunx vitest run` and `tsgo`.
