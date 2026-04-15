---
name: DevOps Agent — Skills
last_updated: 2026-03-26
---

# Skills

## Technologies Owned

- **Vercel** — NextJS framework deployment, env var management, conditional builds
- **MongoDB Atlas** — Cloud database, connection string management
- **Next.js build** — `next build`, `next start`, static optimization
- **Environment management** — `.env.local` for dev, Vercel dashboard for prod

## Key Configuration

### vercel.json
```json
{
  "framework": "nextjs",
  "ignoreCommand": "git log -1 --pretty=%B | grep -q 'feature/vercel-01'"
}
```

### next.config.js highlights
- React strict mode enabled
- Image domains: `lh3.googleusercontent.com`, `avatars.githubusercontent.com`
- Security headers on all routes
- Body size limit: 2mb

### Env Var Naming Convention
Dev vars: `MONGODB_URI`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`
Prod vars: `MONGODB_URI_VERCEL`, `NEXTAUTH_SECRET_VERCEL`, `ENCRYPTION_KEY_VERCEL`

The app code reads Vercel variants at runtime when `VERCEL` env var is set.

## Common Tasks

### Deploy to Vercel
Push to `main` branch → Vercel auto-deploys.

### Add a new env var
1. Add to `.env.local` for dev
2. Add to Vercel dashboard under project settings → Environment Variables
3. If prod-specific, use `_VERCEL` suffix convention

### Run locally
```bash
npm run dev  # starts at http://localhost:30000
```
