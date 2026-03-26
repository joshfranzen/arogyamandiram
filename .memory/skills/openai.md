---
name: OpenAI API
type: skill
last_updated: 2026-03-26
---

# OpenAI API (GPT-4o-mini)

## How It's Used Here

All AI features use `gpt-4o-mini` for cost efficiency. The app supports two key sources:
1. **User-provided key**: Encrypted in MongoDB under `user.apiKeys.openai`
2. **Server fallback**: `OPENAI_API_KEY` env var

`lib/openaiKey.ts` handles the key resolution: tries user key first, falls back to server key.

## AI Features

| Feature | Route | What It Does |
|---------|-------|-------------|
| Food logger | `POST /api/ai/food-logger` | Parse natural language → food entries with macros |
| Workout logger | `POST /api/ai/workout-logger` | Parse natural language → workout entries |
| Meal ideas | `POST /api/ai/meal-ideas` | Generate personalized meal suggestions (Indian focus) |
| Recommendations | `POST /api/ai/recommendations` | Health insights (per period: day/week/month/year) |
| Health plan | `POST /api/ai/health-plan` | Comprehensive plan based on user profile |
| Insights eligibility | `GET /api/ai/insights-eligibility` | Check if user has enough data before calling AI |

## Key Libraries

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: resolvedKey })
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  response_format: { type: 'json_object' }  // used for structured outputs
})
```

## Debug Logging

When `NEXT_PUBLIC_DEBUG_MODE=true`, all AI calls are logged. View at `/debug` page with the `DebuggerPanel` component. `lib/debugLogsConfig.ts` manages categories and log storage.

## Gotchas

- Always check insights eligibility before calling AI insights — prevents empty/confusing responses
- `gpt-4o-mini` has a context window limit; keep prompts concise, especially for year-long data summaries
- Key resolution is async: always `await` the key from `lib/openaiKey.ts`
- The `mealIdeasService.ts` and `aiHealthPlan.ts` are service wrappers around the OpenAI calls — use these rather than calling OpenAI directly in route handlers
