---
name: Next.js
type: skill
last_updated: 2026-03-26
---

# Next.js 14 (App Router)

## How It's Used Here

- **App Router** only — no Pages Router
- Route groups `(auth)` and `(dashboard)` separate public vs protected pages
- `(dashboard)/layout.tsx` wraps all protected pages with `Sidebar` + `MobileNav`
- API routes live in `app/api/` — each `route.ts` exports named HTTP method handlers
- Server Components used for page shells; Client Components (`'use client'`) for interactive UI
- `middleware.ts` protects dashboard routes (redirects unauthenticated users to `/login`)

## Key Patterns

### Route Protection
All `/dashboard/*` routes are protected in `middleware.ts` via NextAuth session check.

### API Route Structure
```typescript
// app/api/[resource]/route.ts
export async function GET(req: Request) { ... }
export async function POST(req: Request) { ... }
```

### Server vs Client Components
- Page files (`page.tsx`) are server components by default
- Wrap interactive parts in separate client components
- Data fetching in server components where possible; hooks in client components

### Path Aliases
```typescript
import { something } from '@/lib/something'  // @/ maps to project root
```

## Gotchas

- `'use client'` at the top of a file is required for hooks, event handlers, useState
- Dynamic imports (`next/dynamic`) used for heavy client components to reduce initial bundle
- Body size limit is 2mb (set in `next.config.js`)
