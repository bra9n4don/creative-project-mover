# Token audit follow-up plan

Most of the earlier audit is already done: AI drafts send only the fields they use, briefs and updates use low thinking, assistants read a compact summary, and AI instructions are shared. Here's what's left.

## 1. AI Expand runs two drafts at once (biggest remaining cost)
The mind map "AI Expand" button always writes a brief and then a plan, so one click costs two AI drafts. Change it to write only the brief, then offer a "Draft plan too" button. That roughly halves the cost of each Expand.

## 2. Assistant tools let assistants send very long text
Assistant tools accept up to 10,000 characters per field for idea details, task details, evidence and checkpoint notes. Assistants tend to fill the space they're given. Lower the limits to 2,000 for details and evidence, and 1,000 for the "next action", which should be one small step. Shorter tool descriptions also cost less every time an assistant connects.

## 3. Project update paste limit
You can paste up to 20,000 characters into Project update, and all of it goes to the AI. Lower this to 8,000 and show a live character count, so long pastes get trimmed by you rather than costing more.

## 4. Workspace refresh
The app reloads the whole workspace every 15 seconds while the tab is open. This doesn't use AI tokens, but it does keep the database awake. Change it to every 60 seconds, plus an immediate refresh whenever you come back to the tab. Your own saves already refresh right away.

## 5. Builder (chat) cost — the biggest spend overall
Building in chat is ~99% of your credits. Changes that help:
- **Skill: "Relay AI prompts"** — records how AI drafts work here (shared instructions, review-before-save, limits), so I don't have to re-read those files every time you change an AI feature.
- **Tidy project notes** — the project's rules file is small (~3KB) and fine. Merge the two Kickoff rules into one.
- **Habit:** batch several changes into one message, like you did with the five mind map changes.
- **No new connections needed.** Slack and Cloudflare are already linked and don't use AI.

## Not changing
- Plans stay on medium thinking, because their quality depends on it.
- Owner review before saving AI drafts, sign-in checks and owner-only rules stay as they are.

## Technical details
- 1: `src/pages/kickoff.tsx` `expand()` calls `draftOne("brief")` then `draftOne("plan")`. Make plan an explicit follow-up action.
- 2: `src/lib/mcp/schemas.ts` `.max(10000)` → 2000 / 1000 for nextAction. Mirror the change in `agent-api.server.ts` validation.
- 3: `src/lib/ai/project-update.server.ts` input `.max(20000)` → 8000; counter in `project-update-dialog.tsx`.
- 4: `src/lib/workspace.tsx` `refetchInterval: 60000`, `refetchOnWindowFocus: true`.
- 5: create `.agents/skills/relay-ai-prompts/SKILL.md`; merge the Kickoff rules in `AGENTS.md`.
- Tests: schema limit tests (10,001 / 2,001 rejected), update input limit, Expand drafts only the brief. Re-run one real brief draft afterward.

## Estimated savings (estimates)
- Expand: about half per click.
- Assistant fields: up to about 2,000 tokens less per long tool call.
- Refresh: 75% fewer reloads.

## Suggested order
1, 3, 2, 4, then 5.
