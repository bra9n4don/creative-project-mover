# First-time guided tour, plus a live backup check

## 1. Guided tour
- **When it appears:** the first time you open Relay signed in, on any device. A dimmed overlay highlights one real menu item or button at a time, with a short note next to it.
- **Controls:** Back, Next and **Skip tour** on every step, and Done on the last. Esc also skips.
- **Steps, about 8:**
  1. Where I left off: your latest checkpoint and next action.
  2. Projects
  3. Ideas
  4. The + button on a phone, or Ideas on a desktop: capture a thought fast.
  5. Kickoff: six guided steps to start a project.
  6. Mind map
  7. Connect assistant: link ChatGPT or Claude.
  8. Settings: GitHub sync, your private backup, and where to replay this tour.
- **Phone vs desktop:** on a phone it points at the bottom tabs and the + button. On a desktop it points at the sidebar. If something isn't on screen, that step shows as a centered card instead.
- **Remembered everywhere:** finishing or skipping is saved to your account, so the tour won't show again on your iPhone or another browser.
- **Replay:** a new "Tutorial" card in Settings has a "Take the tour again" button.

## 2. Publish and run a live backup
- Publish, then open the live site signed in and save a test idea.
- Press "Back up now" in Settings on the live site.
- Confirm on GitHub that the idea is in the private relay-workspace repo, then remove the test idea.

## 3. Real iPhone
I can't use your phone. After publishing I'll give you three quick steps to check on it: Add to Home Screen, save an idea with +, then see it in Ideas and on GitHub.

## Technical details
- The "tour seen" flag is a `tour_completed_at` column on `hub_owner`, read and written through owner-only server functions.
- New `src/components/guided-tour.tsx` with no new library. It measures `data-tour` targets with getBoundingClientRect, recomputes on resize and scroll, and uses design tokens for colors.
- `data-tour` attributes go on the nav links, the tab bar, the quick-capture button and the Settings link. The tour mounts in the shell and isn't shown in demo mode.
