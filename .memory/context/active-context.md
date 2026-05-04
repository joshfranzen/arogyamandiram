---
name: active-context
type: context
last_updated: 2026-05-02
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
- **Food logger brand-label hardening + todos debug trace (2026-05-01)**: Added `settings-todos` source tagging from Settings → Todos food template parsing, persisted dedicated Request Inspector logs under `settings/todos-food-parser`, expanded brand detection to include Silk almond milk with static label fallback, and added post-AI enforcement/validation so almond-milk fat/calories cannot silently underflow for drink-sized portions
- **Workout planner deterministic normalization hardening (2026-05-02)**: Upgraded `POST /api/ai/daily-plan/workout` with enforced strategy engine + readiness adjustments and a deterministic post-AI normalization pipeline: muscle-group correction, beginner equipment fallback remaps, mandatory core minimum with floor sets, single warm-up + ordered workout phases (warm-up → strength → cardio → core → cooldown), guaranteed >=2 cooldown stretches, duplicate exercise pruning, MET-based calorie estimation, and persisted workout metadata (`strategyUsed`, `readinessAdjustment`, per-exercise `muscleGroup`, and `core` category support across API/model/types/UI logging)
- **Settings todos food-parser nutrition unit/scaling fix (2026-05-02)**: Hardened `POST /api/ai/food-logger` for Settings → Todos parser flow by remapping scoop/powder items from `piece` to `serving`, preventing intermediate rescaling when authoritative external brand labels are present (single-pass deterministic label override), and tightening Silk almond-milk fiber baselines in both static label data and sanity fallback correction.
- **Food-plan dietary preferences from Settings (2026-05-02)**: Added `settings.foodPreferences` (dietary preference + allergies) in `User` schema/types/UI and wired both `POST /api/ai/daily-plan/food` and nightly cron generation to include these preferences in AI prompts so generated meal plans respect vegetarian/non-vegetarian/vegan preferences and allergy constraints.
- **AI model routing via env controls (2026-05-02)**: Added `lib/aiModel.ts` and switched non-orchestrator AI calls to configurable `OPENAI_MODEL_BEST` while keeping orchestrator intent classification on `OPENAI_MODEL_ORCHESTRATOR`; updated `.env.example` to document both vars and aligned debug metadata to report the active model.
- **Daily food-plan protein-floor hardening (2026-05-02)**: Updated food-plan prompt inputs to include user macro targets and added a low-protein retry path in `POST /api/ai/daily-plan/food` that automatically regenerates when total suggested protein falls below a target-based floor.
- **Chat-completions token-parameter compatibility fix (2026-05-02)**: Replaced `max_tokens` with `max_completion_tokens` in shared OpenAI chat-completions call sites (`lib/openaiJson.ts`, recommendations, meal ideas, health-check, and AI health-plan services) so `gpt-5.4-mini` requests no longer fail with unsupported-parameter errors.

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
