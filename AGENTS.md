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
- GitHub calls go through the linked GitHub connector, and every sync run is recorded on `hub_owner` (last_sync_*) — lets the owner confirm the 10-minute automatic sync in Settings.
- Original Replit screens are kept in `src/pages` behind small shims (`router-compat`, `auth`, `hub-api`) — preserves the source UI with minimal edits.
- tsconfig relaxes exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature and noImplicitOverride — imported source code was written without them.
