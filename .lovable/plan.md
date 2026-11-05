# One-click Google and Microsoft linking

Today you link another sign-in by copying a code, signing in elsewhere, and typing the code. This plan adds buttons that do those steps for you.

## What you'll see
1. In Settings → Linked sign-ins, two new buttons: **Link Google** and **Link Microsoft**.
2. Clicking one makes a one-time link code, then sends you to the Google or Microsoft sign-in screen.
3. When you come back, CarterHub uses the code automatically. You land in your own workspace, and the new sign-in shows up in the list.
4. After that, you can sign in from the sign-in page with email, Google or Microsoft and reach the same projects.
5. If something fails (canceled sign-in, expired code), a clear message appears with a **Try again** button. Your main sign-in doesn't change.

## Technical details
- Reuse the existing owner link-code create/redeem functions and `hub_linked_logins`. No database changes.
- Before the redirect, save the code and provider in sessionStorage, sign out locally, then call `lovable.auth.signInWithOAuth` with a public same-origin `redirect_uri`.
- After a session exists, a small handler on the auth landing reads the pending code, redeems it, clears it, and opens Settings.
- If that Google/Microsoft account is already the owner or already linked, show "already linked" instead of an error.
- Add a test for the pending-code handling (single use, cleared after success or failure).
- Verify with `bunx vitest run` and `tsgo`. Publish only if you ask.

## Note on Import
Publishing the Import page was already requested in the previous step, so it isn't part of this plan.
