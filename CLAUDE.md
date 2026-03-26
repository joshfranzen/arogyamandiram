# Claude Code Instructions

## Memory System — Read This First

This project uses a structured memory system. Before doing any work, read the following files in order:

1. **`project-memory.md`** — Entry point. Check the Memory Status table.
   - If status shows "Not yet created" → follow the "First Time Here?" instructions inside it
   - If dates are present → check for stale sections, then proceed

2. **`.memory/manager/manager.md`** — Understand how work is routed and coordinated

3. **`.memory/context/index.md`** — Load project context before touching any code

After reading, load the relevant section files from `.memory/` based on the task:
- Writing code? Read `.memory/rules/index.md`
- Using a specific technology? Read `.memory/skills/index.md`
- Running a workflow (deploy, debug, etc.)? Read `.memory/commands/index.md`

## After Significant Work

Update `.memory/` files and the Memory Status table in `project-memory.md` so the next agent has accurate context.
