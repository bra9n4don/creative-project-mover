---
name: launch-readiness
description: Full go/no-go launch readiness check for any Lovable project — discovers what the app has, tests it end-to-end signed in (desktop + phone), exercises real integrations and the live site, auto-fixes only safe problems, and reports a ranked verdict. Use when the user asks "is it ready for live", "test everything", "pre-launch check", or "find what's broken".
---

# Launch readiness

Works on any project. Never assume pages, features or addresses — discover them.

## 1. Discover (build the checklist from what exists)
- Read `AGENTS.md`, `roadmap.md`, `mem://index.md`, and route files (`ls src/routes`, `rg createFileRoute`).
- Server code: `rg -l "createServerFn|server: {" src`; public endpoints under `src/routes/api/public`.
- Backend: list tables/RLS (`supabase--read_query` on `pg_policies`), storage buckets, cron (`supabase--list_http_schedules`).
- Connections: `standard_connectors--list_connections`; AI calls (`rg -l "ai-gateway|streamText" src`); MCP (`src/lib/mcp`).
- Addresses: `project_urls--get_urls`, `domain_status--check_domain_status`.
Write the checklist to `/tmp/readiness/checklist.md` (pages, flows, integrations, live checks).

## 2. Baseline
Run in parallel: project tests (`bunx vitest run`), `tsgo`, tail `/tmp/observability/*.log`, `stack_modern--server-function-logs` (published), `security--run_security_scan`, `supabase--linter`, `supabase--db_health`.

## 3. Signed-in click-through
- Mint a session (browser-use auth rules; `lovable auth-session --json --self`).
- One Playwright script visits every page at 1280x1800 and 390x844 (`is_mobile`). Per page record: console errors, failed requests (status ≥400), `document.documentElement.scrollWidth > innerWidth` (sideways overflow), visible "error"/"something went wrong" text, and a screenshot. View the screenshots.
- Run each main flow with real input (create → read back in the UI). Name test records "Readiness test …" and track them for cleanup.

## 4. Real integrations (only those that exist)
One real AI call, one connector gateway call, trigger or inspect the last scheduled job run, call own MCP via `mcp--connect connector_id "self"` if present. Webhooks: confirm they reject unsigned requests.

## 5. Live site
curl the published + custom domain (expect 200), protected endpoints anonymously (expect 401/403), manifest/icons if present, sign-in page renders. Note if live is behind the preview (unpublished changes).

## 6. Fix policy
Auto-fix and re-test ONLY safe items: layout/overflow, copy, wrong links/addresses, missing null guards, missing head metadata. Report-only (with suggested fix): anything touching data shape, permissions/RLS, auth, money, deletion, secrets, or dependencies. After fixes: re-run tests, and republish only if the user previously asked to publish/keep live.

## 7. Report (this exact shape, plain language)
**Verdict: Go / Go with caveats / No-go** — one sentence why.
**Problems** ranked High / Medium / Low: what happened → impact → fix (say "fixed" or "suggested").
**Fixed this run** · **Not tested and why** (accounts you can't sign into, real devices, blocked apps) · **Test data left behind**.
High = data loss, security, sign-in, or a main flow broken. No-go if any High remains unfixed.
