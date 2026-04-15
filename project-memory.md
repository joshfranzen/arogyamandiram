---
state: populated
created: 2026-03-26
last_updated: 2026-04-15
last_read: 2026-04-12
updated_by: claude-sonnet-4-6
staleness_days: 3
---

# Project Memory

> This is the entry point for any AI agent working on this project.
> Every tool — Cursor, Claude Code, Windsurf, Cline, Copilot, Gemini, Codex — starts here.
> Do NOT start working without reading this file and `.memory/README.md`.

---

## Memory Status

| Section | Last Updated | Updated By | Stale After | Status |
|---------|-------------|------------|-------------|--------|
| context/ | 2026-04-14 | codex-5.3 | 3 days | Current |
| agents/ | 2026-04-15 | claude-sonnet-4-6 | 7 days | Current |
| skills/ | 2026-04-15 | claude-sonnet-4-6 | 10 days | Current |
| rules/ | 2026-03-26 | claude-sonnet-4-6 | 14 days | Current |
| commands/ | 2026-03-26 | claude-sonnet-4-6 | 14 days | Current |

---

## Before You Do Anything

1. Read `.memory/README.md` — folder map and full read order
2. Read `context/active-context.md` — current sprint and recent changes
3. Read `agents/index.md` — find the right agent for your task
4. Load the agent's skills + rules before writing any code

## Key Things Every Agent Must Know

- All API responses go through **`lib/apiMask.ts`** — never return raw DB documents
- All API routes check **`getServerSession(authOptions)`** first — 401 if missing
- Dashboard cards use **`dashboard-unified-card`** class — do not invent new card classes
- App runs locally on **port 30000** (not 3000)
- Current branch: `feature/dev-01-minor-updates-sprint-mar-26`

## After Significant Work

1. Update the relevant files in `.memory/`
2. Update the **Memory Status table** above with today's date and your name
3. Update `last_updated` in the frontmatter of any file you modified
