---
name: active-context
type: context
last_updated: 2026-04-30
updated_by: codex-5.3
staleness_days: 3
---

# Active Context

## Current Branch

`feature/dev-01-minor-updates-sprint-mar-26`

## What's Being Worked On (as of 2026-04-15)

**Minor Updates Sprint** — Email reminders, AI daily plans, cleanup, recommendations, and repo-shape alignment.

Recent changes since the last broad memory refresh:
- **Global positioning cleanup**: Removed country-specific marketing and AI prompt wording from README, landing page, dashboard tour, food empty state, metadata keywords, and meal-plan/recommendation prompts so Arogyamandiram reads as a worldwide health app
- **Today's Plan UX + logging improvements**: Added independent regenerate behavior for overview/food/workout, workout quick-add controls (reps + minutes + add-to-log), per-section daily regen limits, and Request Inspector logging for today's plan generation (`insights/today-plan`)
- **Email reminders system**: Added `lib/email/` (`imap.ts`, `smtp.ts`, `templates.ts`), local cron runner, IMAP/SMTP utilities, and email templates
- **Cron API routes**: Added `app/api/cron/generate-daily-plans/`, `send-reminders/`, `process-email-replies/`, and `sync-health-data/`
- **AI Daily Plan**: Added `app/api/ai/daily-plan/` plus `models/DailyPlan.ts` for per-user per-day plans
- **AI Recommendations + orchestration**: Expanded recommendations and kept the natural-language orchestrator flow under `app/api/ai/orchestrator/`
- **Fitness level auto-detection**: Added `lib/deriveFitnessLevel.ts` to classify users as beginner/intermediate/advanced from recent workout history
- **Settings surface expansion**: Email notification settings, scheduling preferences, todos, health-data sync, and tracker customizations
- **Cleanup**: Removed `indianFoods.ts`, replaced food storage with `models/Food.ts`, and removed several older modal components
- **Health data sync source clarity + automation**: Added `lastSyncSource` (`auto`/`manual`) tracking, surfaced sync type in Settings, and introduced cron-based interval sync
- **Settings customizations + water quick-add cleanup**: Added Settings → `Customizations` for the four water quick-add amounts and simplified `/water`
- **Repo-shape reality check (2026-04-15)**: Memory refreshed against the live codebase. Important corrections: Next.js is now 15.x, food fallback is USDA FoodData Central rather than Edamam, dashboard protection currently happens in `DashboardLayoutClient` plus API session helpers, and the repo no longer has a root `middleware.ts`
- **Daily-plan architecture cleanup (2026-04-30)**: Removed unused regeneration counters from schema/types, deleted dead utility exports, and refactored duplicated OpenAI JSON request/parsing logic into `lib/openaiJson.ts` plus `app/api/ai/daily-plan/shared.ts` with normalized plan outputs for more stable UI contracts

## Active Focus Areas

1. **Email reminders** — SMTP/IMAP, cron-driven, user preference-controlled
2. **AI Daily Plans** — nightly generated, stored in `DailyPlan`
3. **AI Recommendations + Orchestrator** — personalized suggestions and command routing
4. **Fitness level auto-detection** — drives AI plan personalization
5. **Memory/docs refresh** — align agent docs and skill docs with the real repo

## Recent Sprint History

| Sprint | Branch | Focus |
|--------|--------|-------|
| Mar 26 (current) | `feature/dev-01-minor-updates-sprint-mar-26` | Email reminders, AI daily plans, cleanup |
| Mar 8 (merged #93) | `feature/dev-01-uiux-sprint-march-8th` | UI/UX standardization — MERGED |
| Mar 5 | `feature/dev-01-ai-improvements-sprint-march-5` | AI feature improvements |
| Mar 5 | `feature/dev-01-minor-fixes-sprint-march-5` | Bug fixes |
| Feb 28 | `feature/dev-01-ai-powered-sprint-feb-28` | AI-powered features |
| Feb 23 | `feature/dev-01-gamification-sprint-feb-23` | Streaks, badges, XP |

## What's Next (likely)

- Wire up AI daily plan to dashboard UI
- Test email reminder delivery end-to-end
- Decide whether dashboard protection should remain client-layout based or move back to middleware/server redirects
- Reconcile outdated README claims (port, Next.js version, food provider wording) with the implementation
- Merge this sprint to main
