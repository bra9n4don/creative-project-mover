# Link AI inbox cards to the task or idea they create

## What you'll get
Approve already saves the task or idea to your project today. What's missing is the link back to it, plus a guard against saving twice. After this change:

1. An approved card shows **Open task**, **Open idea** or **Open roadmap**, which takes you straight to the saved item in its project, Ideas or roadmap page.
2. Change suggestions (status, title or target date) link to the task or milestone they changed.
3. The chat card and the AI inbox show the same link, so approving in one place shows it in both.
4. If the saved item is later deleted, the card says "No longer in your workspace" instead of a broken link.
5. Clicking Approve twice, or approving the same card in two tabs, never creates a duplicate.
6. If the save works but the card fails to update, it stays linked and doesn't say "Approve" again.

Older cards that were approved before this change have no saved link. They keep showing "Saved to your workspace." I won't guess which task they made.

## Technical details
- Have the existing create-task, create-idea and create-milestone calls return the new record's id. Check whether the hooks already return it before adding anything.
- Extend `decideProposalFn` to accept an optional `created: { kind: "task" | "idea" | "milestone" | "task_update" | "milestone_update"; id }` and store it on the chat tool part as `created`. Refuse to overwrite a part that already has `decision: "approved"`, and return `{ ok, alreadyApproved, created }`.
- In `ProposalCard`, re-check the stored decision before saving: call decide with `decision: "approving"`, a short-lived lock written to the part. Skip the save if the card is already approved. After the save, record `approved` with the `created` ref. Retry the decision write once on failure.
- `extractInboxItems` passes `created` through to `InboxItem`. The card resolves it against workspace state to choose the link target, using the existing project task-detail, Ideas and roadmap routes. A stale lock (over 2 minutes old) counts as waiting.
- Tests in `src/lib/ai/inbox.test.ts`:
  - `created` passes through on approved items.
  - A stale `approving` lock reads as waiting.
  - An approved part is not overwritten.
- No new tables. Chat parts are already JSON. Verify with `bunx vitest run` and `tsgo`.
