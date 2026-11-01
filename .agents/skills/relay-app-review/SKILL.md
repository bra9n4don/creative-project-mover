---
name: relay-app-review
description: Full health review of the Relay app — finds bugs, overlooked mistakes, security gaps, and optimization/improvement opportunities, then reports a ranked list without changing code. Use when asked to review, audit, check for bugs, or find improvements across the whole app.
---

# Relay app review

Report first. Change nothing until the owner approves specific fixes.

## Workflow
1. **Baseline**: `bunx vitest run`; read `/tmp/observability/build-errors.log`, `runtime-errors.log`, `console-logs.log` (tolerate missing files); run the quick security scan.
2. **Parallel read-only reviewers** (one per area, `capable` model), each returning file:line findings with a concrete repro or reasoning:
   - Hub rules & storage: `src/lib/hub/operations.ts`, `store.ts`, `hub.functions.ts` — owner checks, optimistic `rev`, audit events, deletes cleaning related data.
   - AI drafts: `src/lib/ai/*`, kickoff/project-update dialogs — review-before-save, length limits matching UI, stream error handling.
   - Kickoff & mind map: `src/pages/kickoff.tsx`, `mind-map.tsx`, `src/lib/kickoff.ts`, `use-kickoff-saving.ts` — autosave races, resume, checkpoint limits.
   - Public endpoints: `src/routes/api/public/**`, `src/lib/mcp/**`, Slack, GitHub job — caller verification, no private data on failure, honest status codes.
   - UI/UX: `src/pages/*` — missing loading/error states, stale copy (sync timing, URLs), dead links, accessibility.
3. **Signed-in click-through** with Playwright: overview, projects, kickoff (step 1→6, pause/resume), mind map, settings, connect page. Capture console errors.
4. **Optimization pass**: refresh intervals and payload sizes, AI reasoning/limits, unused dependencies, large client bundles.
5. **Verify** each finding is real (reproduce or cite the exact code path). Drop speculation.

## Rules to respect
- Single-owner private app; never propose public signup or multi-user.
- AI-generated tasks/handoffs must be owner-reviewed before saving.

## Report format
```
## High / Medium / Low
N. **Title** — what the owner would notice. (file:line)
   Fix: one-line suggestion. Effort: S/M/L
## Improvements (impact vs effort)
## Verified OK
```
End by asking which items to fix.
