# Remaining optimization work

Everything on the current to-do list is done. What's left comes from the earlier code review and token audit, which weren't fully applied.

## 1. Reliability fixes (from the code review)
- **Matching length limits in Kickoff:** a checkpoint can currently be bigger than what Resume accepts, and long briefs are only rejected at the last step or quietly cut short in project notes. Use one shared set of limits, and show a warning while you type instead of cutting text.
- **Honest GitHub sync status:** a failed automatic sync can still be reported as a success, and a failed attempt to record the result goes unnoticed. Make failures show red in Settings.
- **Complete GitHub results:** repo selection stops at 100 repos, and each sync reads only 10 commits and 10 pull requests. Read further where it's needed, and show a note when results are cut short.

## 2. Lighter data refresh
- The whole workspace reloads every 15 seconds, and its activity history grows forever. Measure how big each reload is, then refresh less often when the tab is in the background and keep only recent activity in the reload. Older history stays saved.

## 3. Leftover AI usage tune-ups (from the token audit)
- Send AI drafts only the fields they use, and skip empty answers.
- Tighten the length limits on AI answers to what the screens actually show.
- Share one set of AI instructions instead of copies in each file.

## 4. Your decision: GitHub sync frequency
- Every 10 minutes keeps the database awake, which is the most likely thing to raise its cost over time. Switching to hourly cuts possible runs by about 6x, but Settings would show results up to an hour old. Nothing changes unless you choose it.

## Technical details
- Limits: `src/lib/kickoff.ts` schema caps, `restoreCheckpoint` 1MB cap, `exportKickoff`/`saveKickoff` note truncation in `operations.ts`.
- Sync: `src/routes/api/public/jobs/github-sync.ts` returns 2xx on failure; the `syncAndRecord` update in `github.server.ts` ignores the DB error; add pagination with a "truncated" flag.
- Refresh: `src/lib/workspace.tsx` refetchInterval; trim `activity` in the state read path, not in storage.
- AI: `kickoff.server.ts` and `project-update.server.ts` payload trimming, schema `.max()` limits, a shared prompt constant.
- Add tests for each rule changed; re-run one real AI draft afterward.

## Suggested order
1, then 3, then 2. Section 4 only if you approve it.
