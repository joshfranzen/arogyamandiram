# Agents

## Team Roster

| Agent | Domain | Technologies | Folder |
|-------|--------|-------------|--------|
| Next.js Fullstack Agent | API routes, DB models, auth, business logic | Next.js API routes, Mongoose, NextAuth, encryption | `agents/nextjs-fullstack/` |
| UI Frontend Agent | Pages, components, styling, animations | Tailwind CSS, Framer Motion, Recharts, Lucide | `agents/ui-frontend/` |
| DevOps Agent | Deployment, env config, build | Vercel, MongoDB Atlas, next.config.js | `agents/devops/` |

## What Each Agent Owns

### Next.js Fullstack Agent
- `app/api/` — all API route handlers
- `models/` — User.ts, DailyLog.ts
- `lib/auth.ts`, `lib/db.ts`, `lib/encryption.ts`, `lib/apiMask.ts`
- `lib/health.ts`, `lib/gamification.ts`, `lib/indianFoods.ts`, `lib/calorieBurn.ts`
- `middleware.ts`

### UI Frontend Agent
- `app/(dashboard)/` and `app/(auth)/` — all page components
- `components/` — all React components
- `app/globals.css`, `tailwind.config.ts`
- `hooks/` — useDailyLog.ts, useUser.ts, useAchievements.ts
- `lib/apiClient.ts` — frontend API wrapper

### DevOps Agent
- `vercel.json`, `next.config.js`, `.env.local`
- `package.json` (scripts and dependencies)

## Actions

- **Add an agent?** Only if a new distinct technology domain appears (e.g. Redis, native mobile).
- **Task spans two agents?** Fullstack handles data; Frontend handles display. Coordinate at the API contract boundary.
