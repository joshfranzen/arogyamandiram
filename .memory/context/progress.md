---
name: progress
type: context
last_updated: 2026-04-07
updated_by: claude-sonnet-4-6
staleness_days: 3
---

# Progress

## Done (Stable Features)

- [x] User authentication (NextAuth.js, JWT, bcrypt)
- [x] 4-step onboarding wizard with auto-calculated health targets
- [x] Food logger — Indian foods database, fuzzy search, custom food entry (Note: `indianFoods.ts` removed; food data now in `models/Food.ts`)
- [x] Edamam API integration (optional fallback for international foods)
- [x] AI food logger (natural language parsing via GPT-4o-mini)
- [x] Meal ideas AI modal (`lib/mealIdeasService.ts`)
- [x] Water tracker with animated glass visualization
- [x] Weight journal with trend charts (7D–1Y range)
- [x] Workout planner — 50+ exercises, calorie burn, category breakdown
- [x] AI workout logger and AI workout plan modal
- [x] Sleep tracker (bedtime, wake time, quality rating)
- [x] AI insights (period-based: yesterday, week, month, year)
- [x] Health plan AI generation (`lib/aiHealthPlan.ts`)
- [x] AI recommendations (`app/api/ai/recommendations/`)
- [x] AI daily plan generation (`app/api/ai/daily-plan/`, `models/DailyPlan.ts`)
- [x] Nightly cron jobs — generate daily plans, send reminders, process email replies
- [x] Email reminders system — SMTP/IMAP (`lib/email/`), templates, scheduling
- [x] Fitness level auto-detection (`lib/deriveFitnessLevel.ts`) — 14-day workout history analysis
- [x] Gamification: 8 streak types, badge system (`lib/badgeDefinitions.ts`), XP (`lib/xp.ts`), leveling (`lib/level.ts`)
- [x] Achievements page (badge grid, streak overview, progress)
- [x] Settings: profile edit, API key management (OpenAI + Edamam)
- [x] User preferences (units, theme, notifications, email scheduling)
- [x] Daily targets customization
- [x] Dashboard tour (interactive, version-controlled)
- [x] Debug logging panel (dev only)
- [x] AES-256-GCM encryption for user API keys
- [x] Server-side response masking (no sensitive data leaked)
- [x] Mobile-responsive layout (bottom nav + sidebar)
- [x] Vercel deployment configuration
- [x] UI/UX standardization (dashboard-unified-card, emerald palette, accessibility, mobile badge grid)

## In Progress

- [ ] Wire AI daily plan to dashboard UI (model + API done, UI pending)
- [ ] End-to-end email reminder delivery testing

## Known Gaps

- No formal test suite (no Jest/Vitest/Cypress)
- Debug mode is manual (env var toggle)
- Landing page (`app/page.tsx`) is minimal — not a polished marketing page
- `lib/seedFoodsData.ts` exists but is empty (future seed script)
- `models/Food.ts` exists — unclear if food data fully migrated from removed `indianFoods.ts`
