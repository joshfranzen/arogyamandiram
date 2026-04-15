---
name: Next.js Fullstack Agent — Skills
last_updated: 2026-03-26
---

# Skills

## Technologies Owned

- **Next.js 14 App Router** — API routes, server components, route groups, middleware
- **TypeScript 5.7** — Strict mode, path aliases (`@/*`)
- **MongoDB + Mongoose 8** — Schema design, compound indexes, connection pooling
- **NextAuth.js 4** — JWT strategy, Credentials provider, session callbacks
- **bcryptjs** — Password hashing (12 rounds)
- **AES-256-GCM** — Key encryption/decryption via `lib/encryption.ts`
- **Zod 3.24** — Request validation
- **OpenAI SDK** — GPT-4o-mini calls for AI features
- **date-fns 4.1** — Date manipulation for log queries

## Key Patterns

### API Route Template
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import dbConnect from '@/lib/db'
import { maskUser, errorResponse } from '@/lib/apiMask'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return errorResponse('Unauthorized', 401)
  await dbConnect()
  // ... query
  return Response.json(maskUser(user))
}
```

### DailyLog Query Pattern
```typescript
// Always query by userId + date compound index
const log = await DailyLog.findOne({ userId: session.user.id, date: today })
```

### Achievement Computation
```typescript
// Called once per request — reads 365 days of logs
import { computeAchievements } from '@/lib/gamification'
const { streaks, badges, xp } = await computeAchievements(userId)
```
