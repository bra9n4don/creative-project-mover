# Finish account and sign-in settings (CarterHub)

Already in place: email, Google, Apple, Microsoft sign-in; forgot/reset password; claim flow; Password sign-in; Linked sign-ins; Log out; GitHub; assistant connections.

Defaults used (from your project rules): just you, no delete-account button, two-step built but off.

## What gets added
1. **Hide "Create account" once claimed** — sign-in page drops the link and shows "Private app. Only the owner can sign in."; /sign-up sends people to /sign-in.
2. **Stronger passwords** — new passwords need 12+ characters (sign-up, reset, Password sign-in).
3. **Change email card** — enter a new email; it only switches after you click the link in your inbox.
4. **Sign-out card with three choices** — this device / all other devices / everywhere. The sidebar Log out changes to "this device only" (today it logs you out everywhere). Note added: signing out does not disconnect Claude or ChatGPT.
5. **Two-step verification card (off by default)** — scan a QR code with an authenticator app, enter the 6-digit code to turn on. Asks for the code at sign-in once on. Warns you to have a linked sign-in first so you can't lock yourself out. No recovery codes.
6. **Connected assistants shortcut** — a small Settings card linking to Connect assistant and Usage, with the "use Revoke" note.
7. Rename leftover "Relay" wording on these screens to "CarterHub".

Settings order: Account, Sign-in methods (linked), Password, Change email, Sign out, Two-step, Connected assistants, GitHub, Appearance, Tutorial, Install.

## Not included
- Delete account (single-owner rule).
- Recovery codes (ask later if wanted).

## Technical details
- `auth-page.tsx`: call `hub_is_claimed` RPC; `minLength={12}`; sign-up route redirect when claimed.
- `auth.tsx` signOut gains `scope` ("local" | "others" | "global"); sidebar uses "local".
- New `src/components/account-security.tsx`: ChangeEmail, SignOutOptions, TwoStep (`supabase.auth.mfa` enroll/challenge/verify/unenroll, `listFactors`), plus an AAL check after sign-in in `auth.tsx` showing a code prompt when `nextLevel === "aal2"`.
- No database changes. Confirm MFA is enabled in auth settings; if not, the card says so.
- Run `bunx vitest run` + `tsgo`; add a test for the 12-character rule. No publish. About 15 minutes.
