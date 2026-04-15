# Skills

## Meta-skills (always present)

| Skill | File | Purpose |
|-------|------|---------|
| Agent Naming | `skills/agent-naming.md` | Rule for naming agent folders with human first names |

## Technology Stack

| Skill | Version | Skill File | Used By |
|-------|---------|-----------|---------|
| Next.js (App Router) | 14 | `skills/nextjs.md` | Fullstack Agent |
| TypeScript | 5.7 | (see nextjs.md) | All Agents |
| MongoDB + Mongoose | 8 | `skills/mongodb.md` | Fullstack Agent |
| NextAuth.js | 4 | (see nextjs.md) | Fullstack Agent |
| Tailwind CSS + globals.css | 3.4 | `skills/tailwind.md` | UI Frontend Agent |
| Framer Motion | 11.15 | (see tailwind.md) | UI Frontend Agent |
| Recharts | 2.15 | (see tailwind.md) | UI Frontend Agent |
| OpenAI GPT-4o-mini | latest | `skills/openai.md` | Fullstack Agent |
| AES-256-GCM encryption | Node built-in | (see mongodb.md) | Fullstack Agent |
| Vercel | latest | (see devops agent) | DevOps Agent |

## Actions

- **New technology added?** Create a skill file and link it to the relevant agent.
- **Version changed?** Update the version in this table and the skill file.
- **Technology removed?** Delete the skill file and remove from this table.
