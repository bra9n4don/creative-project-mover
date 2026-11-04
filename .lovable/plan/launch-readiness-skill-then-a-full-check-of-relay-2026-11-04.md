# Launch-readiness skill, then a full check of Relay

## 1. Save a reusable "launch readiness" skill (works on any project)
It does not assume any Relay-specific page, feature or address. Each run it will:
1. **Discover the project.** Read the project's own notes, pages, server code, backend tables, connections, scheduled jobs and live address, and build a checklist from what actually exists.
2. **Baseline checks.** Run tests, the build and recent error logs, plus a security scan and database linter.
3. **Full signed-in click-through.** Open every page at desktop and phone sizes, look for errors, broken layouts, sideways overflow and dead buttons, and run each main flow with real input.
4. **Real integrations.** Run one real AI call, assistant connection, connector and scheduled job when the project has them. Test cleanup is listed in the report.
5. **Live site.** Check the published address, custom domain, sign-in, home-screen files and that protected endpoints refuse anonymous callers.
6. **Fix safe ones.** Small, low-risk fixes (layout, copy, wrong links, missing guards) get applied and re-tested. Anything touching data, permissions, money or deletion is reported only, with a suggested fix.
7. **Report.** A **Go / No-go** verdict first, then problems ranked High / Medium / Low, each with what happened, its impact and the fix. Then what was fixed, what couldn't be tested and why.

## 2. Run it on Relay now
I'll run it on Relay with full depth. Pages covered: Where I left off, Projects and project detail, Ideas, Kickoff (all 6 steps, pause and resume), Mind map, Assistant usage, Connect, Setup and Settings. Integrations covered: GitHub sync, a Claude Sonnet draft, the /mcp sign-in gate, the Slack endpoint and the iPhone install files. Live checks run on carterhub.carterlab.app. I'll fix the safe problems, republish if anything changed, then give you the go/no-go report.

## Can't be tested
Signing in to your ChatGPT or Claude accounts, a real Slack message (the Slack bot app still can't be created) and a real iPhone. These will be marked "not tested".
