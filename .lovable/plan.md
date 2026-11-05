# Project milestone planner

Add a **Milestone planner** directly on each project's main page.

1. Show a month calendar with milestone deadlines, month navigation, a Today button, and an undated milestone area.
2. Drag a milestone to a calendar day to change its target date; drag it to the undated area to clear its date. Support touch dragging and a date picker for keyboard or precise date entry.
3. Include milestone names, existing done/total progress, and an Add milestone control. Show clear saving and failure states.
4. Save through the existing milestone update path so the dashboard, Roadmap, and task-list inherited dates refresh automatically. A task's own due date stays unchanged; actual task start/finish dates stay separate.
5. Test calendar date placement and the dashboard/task-date derivations with in-memory samples only, then run the test suite. Do not publish or leave sample data in the workspace.

## Technical approach
- Reuse `targetDate`, `milestoneProgress`, and the existing milestone mutation/query invalidation; no new schema or separate planner storage.
- Build a focused planner component with date-only calendar helpers. Use pointer dragging with stable calendar day targets and an accessible date-edit dialog.
- Keep the existing project detail route metadata and dashboard logic intact.