# Roadmap

- [x] Add owner-only AI project update drafting for tasks and handoff notes; verified real generation, review, save and reload.
- [x] Verify and enable Lovable Auth as needed; email/password was already enabled.

- [x] Enable Lovable Storage: private `hub-files` bucket (5MB) + owner-only RLS on storage.objects
- [x] Database optimization review: measured usage, inspected queries/indexes/health — no DB fixes warranted; cron cadence flagged as the only candidate (user decision)
