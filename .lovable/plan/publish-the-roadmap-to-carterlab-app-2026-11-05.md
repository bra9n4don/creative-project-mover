# Publish the roadmap to carterlab.app

The roadmap is already built. This puts it live along with the other preview-only changes.

## Steps
1. Run a security scan. If it finds anything serious, stop and show you before publishing.
2. Publish to carterlab.app. This includes:
   - Roadmap pages with milestones, target dates, progress and **Suggest next steps**
   - the new task detail page
   - the small chat pill
   - the inbox links
3. Signed in as you, open a project's Roadmap on the live site and confirm it loads, with the **Suggest next steps** button showing. No test milestones are created.

## Technical details
- `security--run_security_scan` -> `preview_ui--publish` -> one Playwright load of `/projects/<id>/roadmap` on carterlab.app.
