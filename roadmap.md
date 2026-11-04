# Roadmap

- [x] Verify checkpoint download/copy window and exact-step file/code resume across all six steps.

- [x] Autosave each Kickoff step into its database-backed project and resume saved answers.
- [x] Save reviewed tasks and step handoffs without duplicates; complete launch in the same project.
- [x] Test persistence, review guardrails and signed-in end-to-end flow.

- [x] Build six-step Kickoff with explicit file/code pause and resume.
- [x] Wire editable brief and milestone/task drafting to AI Gateway; both real calls verified.
- [x] Add reviewed atomic Relay export and Markdown brief download.
- [x] Add sidebar/Projects/Overview entry points; verified signed-in six-step flow, export read-back and mobile layout.

- [x] Add owner-only AI project update drafting for tasks and handoff notes; verified real generation, review, save and reload.
- [x] Verify and enable Lovable Auth as needed; email/password was already enabled.

- [x] Enable Lovable Storage: private `hub-files` bucket (5MB) + owner-only RLS on storage.objects
- [x] Database optimization review: measured usage, inspected queries/indexes/health — no DB fixes warranted; cron cadence flagged as the only candidate (user decision)

- [x] Align Kickoff length limits (shared 10,000-char brief limit, live warning, no silent cutting; checkpoints always restorable)
- [x] GitHub sync: failed runs report failure, unsaved results surface as errors, read up to 500 repos and 30 commits/PRs per repo with a note when capped
- [x] Workspace refresh sends only the latest 200 activity entries (all history stays stored)
- [x] AI drafts: shared instructions, empty answers dropped, tighter answer lengths; real brief draft re-verified
- [x] GitHub sync moved to hourly; Settings explains results can be up to an hour old
- [x] Mind map AI Expand (drafts brief + plan for review), promote clusters to Step 4 milestones, standalone saved /mind-map page
- [x] Mind map page: full canvas, save node to Ideas / make project, promote clusters to projects
- [x] Forced postcss-selector-parser 6.1.5 for @tailwindcss/typography
- [x] Add assistant connection instructions page (/connect)
- [x] Private GitHub backup (relay-workspace) of projects, tasks, ideas and checkpoints after every save, with status + Back up now in Settings
- [x] First-time guided tour with Skip, saved per account; replay from Settings
