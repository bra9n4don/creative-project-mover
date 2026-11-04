<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Each owner's workspace is one JSON aggregate in `hub_workspaces`, written via `mutateState` with an optimistic `rev` check — keeps an edit and its audit event atomic without DB transactions.
- All hub business rules live in `src/lib/hub/operations.ts` and are shared by browser server functions and agent endpoints — one guarded path for humans and AI tools.
- Browser calls use RLS-scoped clients after `claim_hub()`; only agent endpoints under `/api/public/*` use the admin client, after verifying a hashed `relay_` credential.
- GitHub calls go through the linked GitHub connector, and every sync run is recorded on `hub_owner` (last_sync_*) — lets the owner confirm the hourly automatic sync in Settings.
- Original Replit screens are kept in `src/pages` behind small shims (`router-compat`, `auth`, `hub-api`) — preserves the source UI with minimal edits.
- tsconfig relaxes exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature and noImplicitOverride — imported source code was written without them.
- The app-hosted MCP server (`src/lib/mcp/`, served at `/mcp`) uses OAuth through Lovable Cloud auth and calls `operations.ts` as an agent actor with an RLS-scoped user client — assistants get the same guardrails as `relay_` token tools without copying tokens.
- File storage uses the private `hub-files` bucket (5MB cap) with owner-only RLS on `storage.objects` via `is_hub_owner()` — matches the single-owner model, so no per-user path prefixing is needed.
- AI project updates stream through an authenticated owner-only server route; drafts stay local until `saveReviewedUpdate` atomically saves reviewed tasks, handoff, and audit — prevents unreviewed writes and partial saves.
- Kickoff drafts live in the workspace aggregate keyed by checkpoint id with per-draft optimistic revisions; serialized debounced owner saves persist answers (AI-drafted brief/plan are held back from autosave until reviewed with Continue) while explicit step review upserts mapped task and handoff IDs — enables cross-visit resume without unreviewed AI records or duplicate exports. File/code checkpoints remain optional backups.
- Assistant resume context (`buildResumeContext`) details one focus project and summarizes the rest, with capped text — keeps assistant token use flat as the workspace grows.
- The standalone mind map is one map stored as `mindMap` in the workspace aggregate with its own optimistic revision — reuses the single-owner store, no new table.
- Assistant saves are attributed by OAuth client name (via `hub_oauth_client_name()` in `mcp/actor.ts`) and counted by `src/lib/hub/usage.ts` — lets the owner compare assistants without a new table.
