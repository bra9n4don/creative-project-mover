# "From chat" links on tasks and ideas

## What you'll see
1. A small **From chat** link on every task or idea that came from an approved AI suggestion. Clicking it opens that conversation on the Chat page.
2. Where it appears:
   - the task detail page, next to the project name
   - each row on the project's task list
   - each card on the Ideas page
3. Tasks you created yourself, or that came from Kickoff or Import, show no link.
4. Suggestions that only changed an existing task (status or title) also add a link to that task, labelled **Changed in chat**.
5. If the conversation was deleted, the link doesn't show.

**Limit:** only suggestions approved since the last update (when cards started remembering what they created) can be linked. Older tasks and ideas won't get a link. I won't guess which chat they came from.

## Technical details
- No new storage. Approved cards already save `created: { kind, id }` next to their `threadId` in the chat messages.
- Add a `useChatSources()` hook in `use-chat-threads.ts`, built on the existing `useInbox` query (same cache, no extra request). It maps created id to `{ threadId, kind }` for approved items, and the newest approval wins.
- Add a small `ChatSourceLink` component. It renders `<Link to="/chat/$threadId">` only when the map has the id and the thread still exists in `useChatThreads`.
- Use it in `task-detail.tsx`, `project-tasks.tsx` and `ideas.tsx`.
- Coverage depends on the inbox query's existing window (the latest 400 assistant messages). Note this in AGENTS.md as one line.
- Test in `inbox.test.ts`: a pure `buildChatSources(items)` maps only approved items with `created`, and the newest wins. Verify with `bunx vitest run` and `tsgo`.
