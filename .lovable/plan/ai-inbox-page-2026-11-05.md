# AI inbox page

A new **AI inbox** page collects every suggestion the AI chat has made, from the dock or the full chat page, so closing the bar never loses one.

## What you'll see
1. An **AI inbox** item in the sidebar and in the phone's More menu, with a count of suggestions still waiting.
2. Three tabs: **Waiting** (default), **Approved** and **Dismissed**.
3. Each card shows what the AI suggested (a new task, a task change, or an idea), which project it's for, when it was made, and an **Open chat** link to the conversation it came from.
4. Waiting cards have **Approve** and **Dismiss** buttons. Approving saves through the same reviewed path the chat already uses, so nothing saves without your OK.
5. Approved cards link to the task or idea that was created. The dock also gets a small "N waiting in inbox" link once it has suggestions.

## Technical details
- No new storage. Suggestions already live as tool parts in `hub_chat_messages`, and decisions are already recorded per tool call. A new owner-only server function reads those parts across threads (newest first, capped at 200) and returns a flat list with its status.
- Pull the Approve/Dismiss logic out of `chat-window.tsx` into a shared helper so the dock, the chat page and the inbox stay consistent. A suggestion approved in one place shows as approved everywhere.
- New route `src/routes/inbox.tsx` with its own page title. Status tab kept in the URL.
- If the target task or project was deleted, the card says so, and Approve is turned off.
- Test: the status of each suggestion (waiting, approved, dismissed) derived from stored parts.
- Verify with `bunx vitest run` and `tsgo`. No publish unless you ask.
