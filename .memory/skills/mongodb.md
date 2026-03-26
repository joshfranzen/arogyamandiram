---
name: MongoDB + Mongoose
type: skill
last_updated: 2026-03-26
---

# MongoDB + Mongoose 8

## How It's Used Here

Single database with 2 collections:
- `users` — User profiles, settings, targets, achievements, encrypted API keys
- `dailylogs` — One document per user per day, containing all tracking data

## Connection

`lib/db.ts` manages a singleton Mongoose connection with `maxPoolSize: 10`. All API routes call `await dbConnect()` at the top before any queries.

## Models

### User (`models/User.ts`)
Key fields:
- `email` (unique index), `username` (unique sparse index)
- `password` (bcrypt, `select: false` — must explicitly request it)
- `apiKeys.openai`, `apiKeys.edamam` — AES-256 encrypted strings
- `profile`: name, age, gender, height, weight, activityLevel, goal, targetWeight
- `targets`: calories, protein, carbs, fat, water, workouts, sleep
- `achievements`: badges array, streaks (current/best per type), totalXp
- Method: `comparePassword(candidate)` for auth

### DailyLog (`models/DailyLog.ts`)
Key fields:
- Compound unique index: `{ userId, date }` — always query by both
- `meals[]`: food details, quantity, mealType, time
- `workouts[]`: exercise, category, duration, sets/reps/weight, caloriesBurned
- `water`: totalIntake + entries[]
- `sleep`: bedtime, wakeTime, duration, qualityRating (1–5)
- Pre-save hook: auto-computes totalCalories, macros, totalCaloriesBurned from arrays

## Key Query Patterns

```typescript
// Get or create today's log
const log = await DailyLog.findOneAndUpdate(
  { userId, date: today },
  { $setOnInsert: { userId, date: today } },
  { upsert: true, new: true }
)

// Push a meal
await DailyLog.findOneAndUpdate(
  { userId, date: today },
  { $push: { meals: mealData } }
)

// Get last 365 days for achievement computation
const logs = await DailyLog.find({
  userId,
  date: { $gte: oneYearAgo, $lte: today }
}).sort({ date: 1 })
```

## Gotchas

- `password` field has `select: false` — you must `.select('+password')` to include it
- Never return raw User documents to client — always pass through `maskUser()` in `lib/apiMask.ts`
- The pre-save hook on DailyLog recalculates totals — don't manually set totalCalories
