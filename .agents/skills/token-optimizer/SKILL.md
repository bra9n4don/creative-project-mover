---
name: token-optimizer
description: Audit the whole app for ways to cut AI token usage and cost (prompts, model/reasoning choices, input payloads, output schemas, MCP context size, polling) and recommend new skills, sub-agents, or connectors that would offload repeated work. Triggers on "optimize tokens", "reduce token usage", "cut AI costs", "token audit", "make AI cheaper", "suggest skills/agents/connectors".
---

# Token Optimizer

Produce a prioritized audit report first; change code only after the user approves specific items, because prompt edits can change AI output quality.

## 1. Inventory every token source

Search with `rg` rather than assuming locations:
- AI calls: `rg -n "streamText|generateText|createResponsesCall|ai.gateway" src`
- System prompts / instructions strings and the message payloads passed with them.
- Output schemas (zod) handed to `Output.object`.
- Agent-facing context: MCP tools (`rg -l "registerTool|tool\(" src/lib/mcp`) and public agent endpoints.
- Agent-side context: `AGENTS.md`, `mem://index.md`, memory files, existing skills — these load into the builder agent every turn.

For each source record: model, reasoning effort, approx prompt chars, input payload shape, output schema size, call frequency (per click, per keystroke, per cron run).

## 2. Check for these cost drivers

- **Oversized input**: whole objects/aggregates sent with `JSON.stringify` when only a few fields are used. Send the minimum fields; drop empty strings and nulls.
- **Reasoning mismatch**: high or forced reasoning on simple extraction/formatting tasks. Suggest lower effort or a faster model; keep higher effort only where quality visibly depends on it.
- **Prompt duplication**: rules repeated between system prompt and schema descriptions, or shared preambles copied across files — consolidate into one constant.
- **Schema bloat**: long `.describe()` text, deep nesting, generous max lengths that invite long outputs. Tighten limits to what the UI shows.
- **Repeat calls**: regenerate-on-every-open, no caching of identical inputs, autosave triggering AI. Cache or require an explicit button.
- **Unbounded agent context**: MCP/agent "get context" returning full history or activity logs. Cap counts, summarize, or paginate.
- **Builder context bloat**: long or stale `AGENTS.md`/memory entries, duplicated rules — propose merges.
- Do not count the auth/RLS/review guardrails as waste; never suggest removing them.

Estimate savings roughly (chars ÷ 4 ≈ tokens) × calls per month. Label estimates as estimates.

## 3. Recommend offloading

For each repeated workflow, decide which fits best and say why:
- **Skill**: a recurring multi-step procedure or domain convention the builder agent keeps re-deriving (loads only when relevant instead of living in always-on context).
- **Sub-agent**: wide read-only research or review that would flood the main context; give it a narrow brief and ask for a short summary back.
- **Connector**: work currently done by an LLM or hand-written code that a deterministic service does better (e.g. GitHub via connector, email, search). Check `standard_connectors--list_connections` first and prefer already-linked connectors.
- **No AI**: logic that can be plain code (formatting, validation, sorting).

Only propose items tied to evidence found in step 1.

## 4. Report format

```
## Token audit — <date>
| # | Area | Finding (file:line) | Fix | Est. savings | Risk |
...
### Suggested skills / agents / connectors
- <name> — <type> — why, what it replaces
### Recommended order
1. ...
```

Keep it plain-language for non-technical owners; put file references in the table only. End by asking which items to apply. When applying, run related tests and re-verify one real AI draft still works.
