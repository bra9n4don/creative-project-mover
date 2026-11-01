# Onboarding checklist: "Set up Relay"

A guided checklist that walks you from a freshly published site to a fully working workspace.

## Steps on the checklist
1. **Create your account**: sign up with email (and confirm it) or with Google / Lovable. Ticked once you're signed in with a confirmed email.
2. **Claim the workspace**: a "Claim workspace" button. The first confirmed account becomes the only owner. If someone else already claimed it, the step says so clearly and nothing else unlocks.
3. **Use the published address**: shows whether you're on the live site or the preview, plus the live address. Tokens should point at the live address so your AI tools keep working.
4. **Reconnect your AI tools**: lists each tool (Claude, ChatGPT, Cursor, etc.) with "Issue new token". Ticked once at least one tool has a fresh token, and fully done once a tool has actually checked in ("last seen"). There's a reminder that old Replit tokens no longer work.
5. **Optional: GitHub sync**: links to the existing sync panel and is ticked after the first successful sync.

## Where it appears
- A new **Setup** page in the side menu, showing a progress count (for example "3/5") until everything is done.
- A short banner on "Where I left off" until setup is finished, with a dismiss option.
- Signed-out visitors on the landing page see a small "Owner setup" link that goes to the checklist. The checklist shows only steps 1–2 until you sign in.

## Technical details
- New server function `getOnboardingStatusFn` returns `{ signedIn, emailConfirmed, claimed, isOwner, claimedByOther, publishedUrl, onPublished, tokens: [{clientId, issuedAt, lastSeen}], githubSynced }`. It reads `hub_owner` and `hub_agent_keys` (prefix and timestamps only, never hashes).
- New `hub_is_claimed()` security-definer SQL function that returns only a boolean, so signed-out or non-owner users can see that a claim exists without reading the owner row.
- "Claim" calls the existing `claim_hub()`. Token issuing reuses the existing Connections issue flow, with the token shown once and copyable, and the endpoint built from the published URL.
- Published vs. preview: compare `window.location.host` with the published domain (creative-project-mover.lovable.app / carterhomelab.dev once DNS is live).
- New files: `src/routes/setup.tsx` and `src/pages/setup.tsx`. Add a nav entry in `shell.tsx` and a banner in `overview.tsx`. Store the banner dismissal in localStorage, read after hydration.
- Tests: a step-completion helper with unit tests (claimedByOther blocks later steps; token "done" requires lastSeen).
