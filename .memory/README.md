# Memory System

This is the canonical overview of the `.memory/` system for Arogyamandiram.
Every AI tool — Claude Code, Cursor, Copilot, Gemini, Cline, Windsurf, Continue — loads this after reading `project-memory.md`.

---

## Folder Map

| Folder | What it holds |
|--------|--------------|
| `context/` | What the project is, what files exist, what each part does |
| `agents/` | Named team members (human first names; role lives in each `persona.md`) |
| `skills/` | How this project uses each technology |
| `rules/` | Coding conventions everyone follows |
| `commands/` | Step-by-step workflows (deploy, fix a bug, new feature) |
| `manager/` | How work is routed and coordinated |

---

## Read Order

### First time here?
1. `context/index.md` — project overview and file map
2. `context/active-context.md` — current sprint and recent changes
3. `agents/index.md` — find the right agent for your task
4. `manager/manager.md` — understand coordination

### Returning agent?
1. `context/active-context.md` — check what changed since last time
2. Load only what your task needs (see below)

### For a coding task
- `rules/index.md` → relevant rule files
- `skills/index.md` → relevant skill files
- The agent's `persona.md` + `skills.md`

### For a workflow (deploy, debug, etc.)
- `commands/index.md` → the right command file

---

## Agent Naming

Agent folders use human first names (e.g. `agents/priya/`, `agents/kevin/`).
The role (fullstack, devops, frontend…) lives inside `persona.md`, not the folder name.
See `skills/agent-naming.md` for the full rule and name seed pool.

---

## After Significant Work

1. Update the relevant file(s) under `.memory/`
2. Bump `last_updated` in their frontmatter
3. Update the Memory Status table in `project-memory.md`
