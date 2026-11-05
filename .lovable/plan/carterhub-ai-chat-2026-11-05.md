# CarterHub AI chat

## What you get
- **Chat page** (new "Chat" item in the sidebar and phone More menu): a list of past conversations on the left, "New chat" button, and each conversation has its own web address so reloading keeps you in it.
- **Slide-out chat panel**: a chat button in the header opens the chat over any page. It continues your most recent conversation and has a link to open it full-page.
- **Saved to your account**: conversations show on every device you sign in on. You can rename or delete a conversation.
- **Knows your work**: the AI reads a short summary of your projects, open tasks, ideas and latest handoffs (focused on the project you're viewing, if any).
- **Suggests, never saves on its own**: when it proposes a new task, task status change, or idea, it shows a card with Approve / Dismiss. Nothing is saved until you press Approve, and approvals go through the same rules and audit log as the rest of the app.
- Replies stream in live, with formatted text and a model label.

## Technical details
- New tables `hub_chat_threads` and `hub_chat_messages` (owner_id via `hub_owner_uid()`, RLS owner-only, GRANTs to authenticated/service_role). Messages store UI message parts as JSON; DB-generated UUIDs.
- Route `/chat/$threadId` and `/chat` (redirect to latest or new thread); chat state keyed by threadId.
- Authenticated owner-only streaming server route `/api/chat` (same pattern as `/api/project-update`): verifies owner and thread ownership, loads full history, builds context with `buildResumeContext`, calls Claude Haiku 4.5 (cheap default, explicit 1500 output-token cap, thinking disabled), saves user + assistant messages with error checks.
- Model exposes "propose" tools (`propose_task`, `propose_task_update`, `propose_idea`) that only return a suggestion; Approve calls existing `operations.ts` functions through server functions.
- UI built with AI Elements (conversation, message, prompt input, tool cards collapsed by default) using the current theme tokens; custom CarterHub agent icon.
- Panel in `shell.tsx` uses a Sheet; same chat component.
- Tests: thread ownership check, proposals never write without approval, message caps. Run `bunx vitest run` and `tsgo`. Not published.
- AGENTS.md: one rule line for chat storage/approval path.
