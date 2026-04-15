---
name: UI Frontend Agent — Skills
last_updated: 2026-03-26
---

# Skills

## Technologies Owned

- **Next.js 14 Client Components** — `'use client'` components, hooks, modals
- **Tailwind CSS 3.4** — Dark mode, custom colors, responsive breakpoints
- **Framer Motion 11.15** — Page transitions, modal animations
- **Recharts 2.15** — Weight trend charts, macro breakdowns (`MetricChart.tsx`)
- **Lucide React 0.468** — Icon library
- **CSS keyframe animations** — `globals.css`: waterFill, waterWaveSlide, fade-in, slide-up, pulse-slow

## Design System

### Color Palette
```
Background:   #000000 (primary), #0a0a0a (surface), #171717 (elevated)
Text:         #f0f0f5 (primary), #a1a1b5 (secondary), #6b7280 (muted)
Emerald:      #10b981 (primary accent)
Violet:       #8b5cf6
Cyan:         #06b6d4
Amber:        #f59e0b
Rose:         #ef4444
Gold:         #ffdf00 (achievements)
```

### Typography
```
Heading:  font-bebas-neue (Bebas Neue)
Body:     font-outfit (Outfit, default sans)
Mono:     font-jetbrains (JetBrains Mono)
```

### Card Classes
```css
.dashboard-unified-card   /* standard card — use this for all dashboard cards */
.glass-card               /* glassmorphism: backdrop-blur-12px */
.card-glow                /* subtle glow on hover */
```

### Layout
```
Bento grid: 4-column (desktop) → 1-column (mobile)
Sidebar breakpoint: lg (1024px)
Mobile nav: fixed bottom, visible below lg
Safe area: CSS variables for iOS notch
```

### Reusable UI Components
- `ProgressRing.tsx` — SVG circular progress indicator
- `MacroBar.tsx` — Stacked bar for protein/carbs/fat
- `MetricChart.tsx` — Recharts wrapper (line/bar charts)
- `StatCard.tsx` — Metric display with icon
- `Toast.tsx` — Notification toasts
- `Skeleton.tsx` — Loading state placeholder
