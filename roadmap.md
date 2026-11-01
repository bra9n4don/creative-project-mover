# Roadmap

- [x] Build six-step Kickoff with explicit file/code pause and resume.
- [x] Wire editable brief and milestone/task drafting to AI Gateway; both real calls verified.
- [x] Add reviewed atomic Relay export and Markdown brief download.
- [x] Add sidebar/Projects/Overview entry points; verified signed-in six-step flow, export read-back and mobile layout.

- [x] Add owner-only AI project update drafting for tasks and handoff notes; verified real generation, review, save and reload.
- [x] Verify and enable Lovable Auth as needed; email/password was already enabled.

- [x] Enable Lovable Storage: private `hub-files` bucket (5MB) + owner-only RLS on storage.objects
- [x] Database optimization review: measured usage, inspected queries/indexes/health — no DB fixes warranted; cron cadence flagged as the only candidate (user decision)
