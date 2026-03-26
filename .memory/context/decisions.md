---
name: decisions
type: context
last_updated: 2026-03-26
updated_by: claude-sonnet-4-6
staleness_days: 14
---

# Technical Decisions

## Next.js App Router (not Pages Router)

Chosen for server components, layouts, route groups, and co-located API routes. Route groups `(auth)` and `(dashboard)` separate public and protected pages without affecting URLs.

## MongoDB + Mongoose (not SQL)

Health logs are semi-structured and schema evolves frequently. The DailyLog model nests meals, workouts, water entries, and sleep in a single document per user per day — natural for MongoDB, awkward in SQL joins.

## Two Models Only (User + DailyLog)

All daily tracking data lives in DailyLog with a compound unique index on `{userId, date}`. Achievements and streaks are computed on-the-fly from DailyLog history (last 365 days). This avoids stale aggregation tables but means achievement computation is CPU-heavy (~800 lines in `gamification.ts`).

## NextAuth.js with Credentials Provider

No OAuth for now — users register with email/password. JWT strategy (not database sessions) for stateless auth. 30-day token expiry. `NEXTAUTH_SECRET` fallback exists in `lib/auth.ts` for dev.

## User-Provided API Keys (Encrypted)

Rather than requiring a server-side OpenAI key, users can provide their own. Keys are AES-256-GCM encrypted before storage. Server has optional fallback keys for users who don't provide their own. This avoids API cost liability.

## Response Masking Pattern

Every API route passes user data through `maskUser()` from `lib/apiMask.ts` before returning it. This centralized pattern ensures sensitive fields (`password`, `apiKeys`, `__v`, `_id`) are never returned to the client, regardless of which route is written.

## Tailwind + Custom globals.css (not a Component Library)

No shadcn/ui, Radix, or Chakra. All components are custom-built with Tailwind + manually written glassmorphism CSS. This gives full design control for the dark Indian-aesthetic theme but means no off-the-shelf component behavior.

## GPT-4o-mini (not GPT-4o)

Chosen for cost efficiency. The AI features (food logging, workout logging, meal ideas, insights, health plans) all use `gpt-4o-mini`. The tradeoff is slightly lower quality but much lower API cost — acceptable for a health app with many small AI calls per session.

## Port 30000 for Local Dev

Non-standard port to avoid conflicts with other local services.
