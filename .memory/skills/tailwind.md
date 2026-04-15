---
name: Tailwind CSS + Custom Styles
type: skill
last_updated: 2026-04-15
updated_by: codex-gpt-5
---

# Tailwind CSS 3.4 + `globals.css`

## How It's Used Here

Dark mode is effectively the active product mode. `tailwind.config.ts` defines custom tokens, fonts, and animation hooks. `app/globals.css` does a large share of the real UI work: glass cards, dashboard layout primitives, safe-area handling, hidden scrollbars, and animation helpers.

## Custom Tokens

### Fonts

```text
font-bebas-neue   -> Bebas Neue
font-outfit       -> Outfit
font-jetbrains    -> JetBrains Mono
```

### Key Color Tokens

```text
emerald  #34d399
violet   #8b5cf6
cyan     #06b6d4
amber    #f59e0b
rose     #ef4444
gold     #ffdf00 / #d4af37
```

## Core Classes

```text
.glass-card
.card-glow
.bento-grid
.bento-ring-stats
.mobile-dash
```

## Responsive Breakpoints

```text
sm 640px
md 768px
lg 1024px
xl 1280px
```

## Gotchas

- Hidden scrollbars are intentional
- Check `prefers-reduced-motion` before adding more motion
- A lot of visual behavior lives in handwritten CSS rather than Tailwind utility composition alone; inspect `app/globals.css` before redesigning layout primitives
