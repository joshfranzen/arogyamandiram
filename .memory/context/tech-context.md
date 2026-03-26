---
name: tech-context
type: context
last_updated: 2026-03-26
updated_by: claude-sonnet-4-6
staleness_days: 7
---

# Tech Context

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14 |
| Language | TypeScript | 5.7 (strict mode) |
| Database | MongoDB Atlas + Mongoose | 8 |
| Auth | NextAuth.js | 4 (JWT, Credentials provider) |
| Styling | Tailwind CSS + `globals.css` | 3.4 |
| Charts | Recharts | 2.15 |
| Animation | Framer Motion + CSS keyframes | 11.15 |
| Icons | Lucide React | 0.468 |
| AI | OpenAI GPT-4o-mini | via API |
| Food Search | Edamam Food API | optional fallback |
| Encryption | Node.js crypto (AES-256-GCM) | built-in |
| Password | bcryptjs | 2.4.3 (12 rounds) |
| Validation | Zod | 3.24 |
| Dates | date-fns | 4.1 |
| Deployment | Vercel | (nextjs framework) |

## Directory Map

```
app/
  (auth)/           # login, register, onboarding — public routes
  (dashboard)/      # all protected pages + layout with sidebar/mobile nav
  api/              # all API routes (RESTful Next.js handlers)
  globals.css       # dark theme, glassmorphism, animations, layout utilities
  layout.tsx        # root layout with fonts
  page.tsx          # landing page

components/
  layout/           # Sidebar, MobileNav, DashboardLayoutClient, DashboardPageShell
  ui/               # ProgressRing, MacroBar, MetricChart, StatCard, Toast, Skeleton, etc.
  food/             # AddMealModal, FoodResultCard, AIFoodLoggerModal, MealIdeasModal, etc.
  water/            # WaterGlass (animated visualization)
  workout/          # AddWorkoutModal, AIWorkoutLoggerModal, AIWorkoutPlanModal, etc.
  achievements/     # BadgeCard, BadgeGrid, StreakCard, StreakBar, BadgeIcon, etc.
  tour/             # DashboardTour (interactive onboarding)
  debug/            # DebugLogsPage, DebuggerPanel (dev-only)

lib/
  auth.ts           # NextAuth config
  db.ts             # MongoDB connection (maxPoolSize: 10)
  encryption.ts     # AES-256-GCM encrypt/decrypt
  apiClient.ts      # Frontend fetch wrapper (sanitized requests)
  apiMask.ts        # Server-side response masking (strips sensitive fields)
  health.ts         # BMR, TDEE, macro, water, sleep target calculations
  gamification.ts   # Streaks, badges, XP (800+ lines)
  indianFoods.ts    # 150+ Indian foods database (950+ lines)
  calorieBurn.ts    # Exercise calorie burn calculations
  utils.ts          # Formatters, validators, date helpers
  constants.ts      # App-wide constants

models/
  User.ts           # User schema (profile, settings, targets, achievements)
  DailyLog.ts       # Daily log schema (meals, workouts, water, sleep)

hooks/
  useDailyLog.ts    useUser.ts    useAchievements.ts

types/
  index.ts          # All TypeScript types

middleware.ts       # Route protection
```

## Environment Variables

### Required
```
MONGODB_URI             # MongoDB Atlas connection string
NEXTAUTH_SECRET         # 32+ char random string
ENCRYPTION_KEY          # 32-byte hex (for AES-256)
NEXTAUTH_URL            # App URL (e.g. http://localhost:30000)
```

### Optional
```
OPENAI_API_KEY          # Server-wide AI fallback
EDAMAM_APP_ID           # Food search fallback
EDAMAM_APP_KEY
NEXT_PUBLIC_DEBUG_MODE  # true = enable debug logging
NEXT_PUBLIC_DASHBOARD_TOUR_VERSION  # integer, bumping retriggers tour
```

### Dev Port
App runs on **port 30000** locally (not the default 3000).

## How to Run

```bash
npm install
npm run dev     # starts on http://localhost:30000
```

## Key Architectural Patterns

- **Server Components** for page shells; **Client Components** for interactive UI (modals, forms, charts)
- **API routes** as the only backend — no separate server
- **Response masking** (`lib/apiMask.ts`): Every API handler calls `maskUser()` before returning user data — never exposes `password`, `apiKeys`, `_id`, `__v`
- **Request sanitization** (`lib/apiClient.ts`): Frontend strips blocked fields before sending to API
- **User-provided API keys**: Users can supply their own OpenAI/Edamam keys; stored AES-256 encrypted in MongoDB
