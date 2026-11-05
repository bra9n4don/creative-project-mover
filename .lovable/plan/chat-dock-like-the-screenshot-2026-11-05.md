# Chat dock (like the screenshot)

Replace the slide-out chat panel with a floating dock at the bottom-center of every page (except the full Chat page).

## What you will see
1. **Input bar** (always visible, rounded pill, dark glass look): `+` new chat on the left, "Ask CarterHub…" text box, a send/stop button, and on the right icons for "Open full page" and a `…` menu (recent chats).
2. **Status pill** just above the bar while the AI is working (e.g. "Thinking…", "Suggesting 2 tasks").
3. **Conversation card** above that, same rounded dark card as the "Queue" box: header with chat title + message count badge, and collapse / minimize buttons on the right. Shows the current chat's messages and any suggested tasks/ideas with their Approve buttons (unchanged behavior).
4. Collapsed by default: only the input bar shows. Sending a message or clicking the bar opens the card; the collapse button folds it back. Your choice is remembered on this device.
5. Phone: the dock sits just above the bottom tabs and the card opens to most of the screen height.

Defaults I'm using: same chat history and approvals as today, latest chat continues, works in light and dark mode using your chosen theme accent.

## Technical details
- New `src/components/chat/chat-dock.tsx` replacing the `Sheet` in `chat-panel.tsx`; mounted once in `AppShell`, hidden on `/chat*`. Remove the header chat button usage (or make it focus the dock).
- Reuse `ChatThreadView` messages/approval rendering; add a `compact` variant of the composer in `chat-window.tsx` so the dock's pill bar drives the same `useChat` instance (status feeds the status pill).
- Styling with semantic tokens only: `bg-card/90 backdrop-blur border rounded-2xl shadow`, new `--shadow-dock` token in `src/styles.css`. Max width ~640px, centered, `fixed bottom-4` (bottom offset above mobile tabs and Quick Capture `+`).
- Open/collapsed state in localStorage, read after hydration.
- Verify with `bunx vitest run` and `tsgo`; one Playwright screenshot at desktop and phone size since it's a visual change.
