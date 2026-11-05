# Link multiple sign-ins to your one CarterHub account

## What you get
- Settings gets a **Linked sign-ins** panel listing every way you can sign in (Google, Apple, Microsoft, email), with the date each was added.
- **Add a sign-in**: press "Link another sign-in", get a one-time code (valid 10 minutes). Sign in with the other method on any device, enter the code, and that login opens your same workspace.
- **Remove** any linked sign-in except the one you're using right now. The original owner sign-in can't be removed, so you can't lock yourself out.
- Signing in with an unlinked account still shows the "not the owner" screen — still private, still just you.

## How it works (plain terms)
Each sign-in method stays its own login, but CarterHub keeps a list of logins you approved. Every check for "is this Brandon?" now asks "is this the owner, or a login the owner linked?" — and everything loads the owner's one workspace.

## Technical details
- New table `hub_linked_logins (user_id uuid pk, owner_id uuid, provider text, email text, linked_at)` + `hub_link_codes (code_hash, owner_id, expires_at, used_at)`; RLS owner-only, grants to authenticated.
- New SECURITY DEFINER `hub_owner_uid()` returning the owner id for `auth.uid()` (owner or linked). `is_hub_owner(uid)` extended to include linked logins.
- Update RLS on `hub_owner`, `hub_workspaces`, `hub_agent_keys`, storage policies to compare `owner_id = public.hub_owner_uid()` instead of `auth.uid()`.
- RPCs: `create_link_code()` (owner only, returns plain code, stores SHA-256 hash), `redeem_link_code(code)` (verified-email caller, unused + unexpired, single use), `unlink_login(user_id)` (owner only, can't remove primary or self).
- Server code (`store.ts`, `hub.functions.ts`, MCP actor, usage) switches from `userId` to the resolved owner id when reading/writing the workspace; audit entries keep the real signed-in login.
- Owner-gate screen gets an "I have a link code" field.
- Tests: code expires after 10 min, code works once, primary login can't be unlinked, unlinked account is denied.
- AGENTS.md: one rule for linked logins resolving to the owner id.

## Not included
- Merging two existing workspaces (the linked login's own empty data is ignored).
