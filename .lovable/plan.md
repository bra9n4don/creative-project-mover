# Full app review: reusable skill + review run

## 1. Create a reusable "relay-app-review" skill
A saved skill you can run anytime (type / in chat) that walks the whole app and reports:
- **Bugs**: broken pages, failing tests, build/type errors, runtime and console errors, save/resume flows (Kickoff, mind map, project updates), owner-only access checks.
- **Overlooked mistakes**: mismatched limits, silent failures, missing error messages, stale wording (e.g. old sync timing), leftover test data.
- **Security**: owner-only rules, public endpoints verifying callers (Slack, GitHub job, assistant tools), dependency warnings.
- **Optimization**: slow or heavy refreshes, AI token use, unused packages, bundle size.
- **Improvements**: small UX gaps worth fixing, ranked by impact vs effort.

Output: a ranked report (High / Medium / Low) with where each issue is and a suggested fix. It reports first and changes nothing until you approve.

## 2. Run it on Relay now
- Run all tests and a fresh security scan.
- Read through every page and server area (hub rules, AI drafts, Kickoff, mind map, Slack bot, GitHub sync, assistant tools, sign-in).
- Click through the main flows signed in to catch runtime problems.
- Deliver the ranked report, then you choose which fixes to apply.

## Technical details
- Skill saved under `.agents/skills/relay-app-review/SKILL.md` and applied.
- Review uses parallel read-only reviewer agents per area, `bunx vitest run`, security scan, and Playwright on the preview.
- Respects project rules: single-owner app, AI drafts reviewed before saving.
