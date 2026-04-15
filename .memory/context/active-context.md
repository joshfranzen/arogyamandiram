---
name: active-context
type: context
last_updated: 2026-04-14
updated_by: codex-5.3
staleness_days: 3
---

# Active Context

## Current Branch

`feature/dev-01-minor-updates-sprint-mar-26`

## What's Being Worked On (as of 2026-04-07)

**Minor Updates Sprint** — Email reminders, AI daily plans, cleanup, and recommendations.

Recent changes since last memory update (post Mar 26):
- **Today's Plan UX + logging improvements**: Added independent regenerate behavior for overview/food/workout, workout quick-add controls (reps + minutes + add-to-log), per-section daily regen limits, and Request Inspector logging for today's plan generation (`insights/today-plan`)
- **Email reminders system**: Added `lib/email/` (imap.ts, smtp.ts, templates.ts), local cron script, IMAP/SMTP utilities, email templates framework
- **Cron API routes**: Added `app/api/cron/generate-daily-plans/`, `app/api/cron/send-reminders/`, `app/api/cron/process-email-replies/`
- **AI Daily Plan**: Added `app/api/ai/daily-plan/` route + `models/DailyPlan.ts` — nightly AI-generated plans (food, workout, top insight)
- **AI Recommendations**: Added `app/api/ai/recommendations/` route
- **Fitness Level Auto-detection**: Added `lib/deriveFitnessLevel.ts` — classifies users as beginner/intermediate/advanced based on 14-day workout history
- **Preferences UI expanded**: Email notification settings, scheduling preferences
- **Cleanup**: Removed `indianFoods.ts` (unused), removed `AddWorkoutModal` and `AIFoodLoggerModal` components
- **New model**: `models/DailyPlan.ts` stores AI-generated daily plans (status: generating/ready/failed)
- **New lib files**: `lib/email/`, `lib/deriveFitnessLevel.ts`, `lib/mealIdeasService.ts`, `lib/aiHealthPlan.ts`, `lib/badgeDefinitions.ts`, `lib/latestWeight.ts`, `lib/level.ts`, `lib/xp.ts`, `lib/session.ts`, `lib/openaiKey.ts`
- **Auth handling improved** in API routes
- **Notification scheduling upgraded**: Added timezone-to-profile persistence, configurable water reminder window (default 06:00-21:00), and per-user water reminder frequency in `settings.reminderSchedule.water`
- **Profile sync improvements**: `/api/user` now aligns settings with latest logged weight and auto-derived weekly activity level; Settings body UI now uses plain-language body-shape/body-fat guidance
- **Health data sync source clarity + automation**: Added `lastSyncSource` (auto/manual) tracking, surfaced sync type in Settings "Last Sync", and introduced `/api/cron/sync-health-data` with a 15-minute schedule that syncs enabled users when their interval is due

## Active Focus Areas

1. **Email reminders** — SMTP/IMAP, cron-driven, user preference-controlled
2. **AI Daily Plans** — nightly generated, stored in `DailyPlan` model
3. **AI Recommendations** — personalized suggestions via GPT
4. **Fitness level auto-detection** — drives AI plan personalization

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
- Merge this sprint to main
