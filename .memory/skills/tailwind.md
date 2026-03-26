---
name: Tailwind CSS + Custom Styles
type: skill
last_updated: 2026-03-26
---

# Tailwind CSS 3.4 + globals.css

## How It's Used Here

Dark mode is the only theme. `tailwind.config.ts` uses `darkMode: 'class'` with custom color tokens, fonts, and animation definitions. `app/globals.css` adds glassmorphism utilities, card classes, and keyframe animations not expressible in Tailwind alone.

## Custom Tokens (tailwind.config.ts)

### Fonts
```
font-bebas-neue   →  Bebas Neue (headings/display)
font-outfit       →  Outfit (body text, default sans)
font-jetbrains    →  JetBrains Mono (code/mono)
```

### Key Color Tokens
```
emerald-500  #10b981   (primary accent)
violet-500   #8b5cf6
cyan-500     #06b6d4
amber-500    #f59e0b
rose-500     #ef4444
```

## CSS Utilities (globals.css)

### Card Classes
```css
.dashboard-unified-card   /* ALWAYS use this for dashboard cards */
.glass-card               /* backdrop-blur(12px), dark bg, subtle border */
.card-glow                /* glowing border on hover */
```

Tinted variants: `.glass-card-emerald`, `.glass-card-violet`, `.glass-card-cyan`, `.glass-card-amber`

### Layout
```css
.bento-grid               /* 4-col responsive grid */
.safe-area-top/bottom     /* iOS notch handling */
```

### Animations (keyframes in globals.css)
```css
fade-in          0.5s opacity
slide-up         0.5s upward slide
pulse-slow       3s pulsing
waterFill        water glass fill
waterWaveSlide   continuous wave motion
waterSurfaceGlow pulsing glow
```

## Responsive Breakpoints

```
sm   640px
md   768px
lg   1024px   ← sidebar appears above this
xl   1280px
```

## Gotchas

- Do not create new card classes — reuse `dashboard-unified-card` or existing tinted variants
- Scrollbars are hidden globally (`scrollbar-width: none`) — intentional
- Reduced motion: check `prefers-reduced-motion` before adding animations; globals.css has the `@media` block for this
