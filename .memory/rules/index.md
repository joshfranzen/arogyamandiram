# Rules

## Active Rules

| Rule | File | Applies To | Summary |
|------|------|-----------|---------|
| Code Style | `rules/code-style.md` | All Agents | TypeScript strict, naming conventions, component patterns, no inline styles |
| Architecture | `rules/architecture.md` | All Agents | Data flow, response masking, auth checks, DB access, component structure |
| Security | `rules/security.md` | Fullstack Agent | Password hashing, API key encryption, response masking, input validation |

## Enforcement

Every agent MUST load relevant rules before writing code.

- Fullstack Agent: read all three rule files
- UI Frontend Agent: read code-style + architecture
- DevOps Agent: read architecture (for env var and config conventions)

## Actions

- **New convention discovered?** Create a rule file and add it here.
- **Rule violated repeatedly?** Strengthen the rule in its file.
- **New security concern?** Add to `rules/security.md`.
