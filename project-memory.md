---
state: populated
created: 2026-03-26
last_updated: 2026-04-07
last_read: 2026-04-07
updated_by: claude-sonnet-4-6
staleness_days: 3
---

# Project Memory

> This is the starting point for any AI agent working on this project.
> Every tool — Cursor, Claude Code, Windsurf, Cline, Copilot, Gemini, Codex — starts here.
> Do NOT start working without reading this file.

---

## Memory Status

| Section | Last Updated | Updated By | Stale After | Status |
|---------|-------------|------------|-------------|--------|
| context/ | 2026-04-07 | claude-sonnet-4-6 | 3 days | Current |
| agents/ | 2026-03-26 | claude-sonnet-4-6 | 7 days | Stale |
| skills/ | 2026-03-26 | claude-sonnet-4-6 | 10 days | Current |
| rules/ | 2026-03-26 | claude-sonnet-4-6 | 14 days | Current |
| commands/ | 2026-03-26 | claude-sonnet-4-6 | 14 days | Current |

---

## Quick Start

**Arogyamandiram** — a full-stack health & wellness tracking app for Indian users. Next.js 14 (App Router) + MongoDB + NextAuth.js + Tailwind CSS + OpenAI GPT-4o-mini.

### Before working on any task:

1. **Read `context/active-context.md`** — know what sprint is active and what was recently changed
2. **Read `agents/index.md`** — find the right agent for your task
3. **Load the agent's skills + rules** — before writing any code
4. **After significant work** — update `context/active-context.md` and `context/progress.md`

### Key things every agent must know:

- All API responses go through **`lib/apiMask.ts`** — never return raw DB documents
- All API routes check **`getServerSession(authOptions)`** first — 401 if missing
- Dashboard cards use **`dashboard-unified-card`** class — do not invent new card classes
- App runs locally on **port 30000** (not 3000)
- Current branch: `feature/dev-01-minor-updates-sprint-mar-26` (email reminders, AI daily plans, cleanup)

---

## What is in `.memory/`

| Folder | What it holds |
|--------|--------------|
| `context/` | What the project is, what files we have, what each part does |
| `agents/` | Team members who handle different parts of the code |
| `rules/` | The rules everyone follows when writing code |
| `skills/` | Knowledge about the technologies we use |
| `commands/` | Step-by-step guides for common tasks (deploy, fix a bug, etc.) |
| `manager/` | The boss — decides who handles what and how work flows |

---

## Keeping Memory Updated

After you do significant work:

1. Update the relevant files in `.memory/`
2. Update the **Memory Status table** above with today's date and your name
3. Update `last_updated` in the frontmatter of any file you modified
4. Keep files concise — every line costs context window space
