# Import projects from chatbots and GitHub

## What you will get
A new **Import** page (in the sidebar and phone More menu) with three ways in, all landing in one **Import inbox** where you review before anything is saved.

1. **Paste or upload a chat** — paste a ChatGPT, Claude or Perplexity conversation, or upload their export file (.json, .md, .txt, .zip from ChatGPT). AI (Haiku, low cost) drafts a project: name, summary, tasks, ideas and a handoff note.
2. **Send from your assistant** — in ChatGPT or Claude (already connected), say "send this project to CarterHub". It drops a draft into the inbox; it never saves directly.
3. **Import a GitHub repo** — pick one of your repos; CarterHub drafts a project from its description, README and open issues (as tasks). Tick "Keep in sync" to link the repo.

## Review step (every import)
- Edit the name, summary, tasks and ideas; uncheck anything you don't want.
- If it looks like an existing project, you choose: **Merge into existing** or **Create new** (asked every time).
- Approve saves everything at once with an activity entry; Discard deletes the draft.

## Ongoing GitHub sync
- Linked projects are checked during the existing hourly GitHub sync.
- New issues, closed issues and renamed issues become **suggested changes** in the inbox (not applied automatically), so tasks you edited by hand are never overwritten.
- A badge shows how many suggestions are waiting. Unlink anytime from the project page.
- Settings → GitHub shows last check time per linked repo.

## Limits
- Pasted/uploaded chats capped (about 60,000 characters; longest chats are trimmed to the most recent part, with a notice).
- Perplexity has no export file, so use paste or the assistant option.
- Your GitHub connection is read-only; nothing is written back to GitHub.

## Technical details
- Workspace aggregate gains `imports[]` (pending drafts: source, raw summary, proposed project/tasks/ideas/handoff, matchProjectId, status) and per-project optional `githubLink { repo, lastSyncedAt, issueMap }`. No new tables; written via `mutateState` with rev check.
- New operations in `operations.ts`: `createImportDraft`, `editImportDraft`, `approveImport` (create or merge, atomic with audit), `discardImport`, `linkRepo`/`unlinkRepo`, `applySyncSuggestion`.
- AI drafting: owner-only server route streaming structured output (reuses `responses.server.ts`, Haiku, 2000 output cap, low reasoning). ChatGPT .zip parsed client-side to pick one conversation.
- Duplicate match: name similarity + repo URL, shown as a suggestion.
- MCP: new `import_project` tool (draft-only), shared schema in `mcp/schemas.ts`; re-extract manifest; agent `/api/public` endpoint gets the same.
- GitHub: extend `github.server.ts` to read README + open/closed issues for linked repos inside the existing hourly run; diff against `issueMap` to create suggestions.
- Tests: draft never saves without approve; merge vs create; sync suggestions don't overwrite edited tasks; input caps.
- Not published until you ask.
