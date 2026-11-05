# Publish the AI inbox to carterlab.app

The inbox cards already link to their tasks. **Open task**, **Open idea** and **Open roadmap** were added in the last change. No new building is needed.

## Steps
1. Check the latest security scan, and run a fresh one if it's missing or old.
2. If it finds anything serious, stop and show you before publishing.
3. Publish. The live site gets the AI inbox with its Waiting, Approved and Dismissed tabs, the links on approved cards, and the double-approve guard.
4. Load the live inbox signed in as you to confirm the three tabs appear. No test records are created.

## Also going live in this publish
- The project **Roadmap** pages and milestone suggestions, which haven't been published yet.

## Technical details
- `security--get_scan_results`, then `security--run_security_scan` if needed.
- `preview_ui--publish`, then one live check of `/inbox` with Playwright, signed in as the owner.
