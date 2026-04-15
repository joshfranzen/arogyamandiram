# Agents

> Agent folders are named after human first names. Each agent's role lives inside their `persona.md`.
> See `skills/agent-naming.md` for the naming rule.

## Team Roster

| Agent | Role | Domain | Technologies | Folder |
|-------|------|--------|-------------|--------|
| Priya | Next.js Fullstack Engineer | API routes, DB models, auth, business logic | Next.js API routes, Mongoose, NextAuth, encryption | `agents/priya/` |
| Mateo | UI Frontend Engineer | Pages, components, styling, animations | Tailwind CSS, Framer Motion, Recharts, Lucide | `agents/mateo/` |
| Kevin | DevOps Engineer | Deployment, env config, build | Vercel, MongoDB Atlas, next.config.js | `agents/kevin/` |

## What Each Agent Owns

### Priya (Next.js Fullstack)
- `app/api/` — all API route handlers
- `models/` — User.ts, DailyLog.ts
- `lib/auth.ts`, `lib/db.ts`, `lib/encryption.ts`, `lib/apiMask.ts`
- `lib/health.ts`, `lib/gamification.ts`, `lib/indianFoods.ts`, `lib/calorieBurn.ts`
- `middleware.ts`

### Mateo (UI Frontend)
- `app/(dashboard)/` and `app/(auth)/` — all page components
- `components/` — all React components
- `app/globals.css`, `tailwind.config.ts`
- `hooks/` — useDailyLog.ts, useUser.ts, useAchievements.ts
- `lib/apiClient.ts` — frontend API wrapper

### Kevin (DevOps)
- `vercel.json`, `next.config.js`, `.env.local`
- `package.json` (scripts and dependencies)

## Actions

- **Add an agent?** Only if a new distinct technology domain appears (e.g. Redis, native mobile). Use a human first name for the folder.
- **Task spans two agents?** Priya handles data; Mateo handles display. Coordinate at the API contract boundary.
