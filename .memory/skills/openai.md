---
name: OpenAI API
type: skill
last_updated: 2026-04-15
updated_by: codex-gpt-5
---

# OpenAI Responses API (`gpt-4o-mini`)

## How It's Used Here

Most AI features use `gpt-4o-mini` through the OpenAI Responses API for cost efficiency and structured outputs.

Key sources:
1. **User-provided key** in `user.apiKeys.openai`
2. **Server fallback** in `OPENAI_API_KEY`

`lib/openaiKey.ts` resolves the usable key.

## AI Features

| Feature | Route | What It Does |
|---------|-------|-------------|
| Food logger | `POST /api/ai/food-logger` | Parse natural language into meal entries |
| Workout logger | `POST /api/ai/workout-logger` | Parse natural language into workouts |
| Meal ideas | `POST /api/ai/meal-ideas` | Generate personalized meal suggestions |
| Recommendations | `POST /api/ai/recommendations` | Health insights and recommendations |
| Health plan | `POST /api/ai/health-plan` | Generate a broader plan |
| Daily plan | `GET/POST /api/ai/daily-plan` | Read/generate per-day plan and regeneration variants |
| Orchestrator | `POST /api/ai/orchestrator` | Intent classification + routing; supports image input |
| Insights eligibility | `GET /api/ai/insights-eligibility` | Gate AI insights on data availability |

## Call Pattern

```typescript
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${resolvedKey}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    instructions,
    input,
    tools,
  }),
})
```

## Debug Logging

When debug mode is enabled, AI flows surface in `/debug` with typed viewers under `components/debug/*`.

## Gotchas

- Keep prompts concise for larger history windows
- Key resolution is async
- Prefer service wrappers like `mealIdeasService.ts` and `aiHealthPlan.ts` when they already exist
- If you add a new AI workflow, think about how it will appear in `/debug`
- The orchestrator route forwards auth/cron headers to internal sub-routes; do not break that header propagation
