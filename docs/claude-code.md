# Claude Code Configuration

> Hospeda-specific Claude Code setup: agents, commands, skills, and workflows.

## Available Agents

| Agent | When to Use |
|-------|-------------|
| `content-writer` | Documentation, content creation |
| `code-reviewer` | Systematic code review |
| `debugger` | Bug investigation and root cause analysis |
| `qa-engineer` | Test validation, acceptance criteria |
| `react-senior-dev` | React components, hooks, performance |
| `hono-engineer` | API routes, middleware, validation |
| `db-drizzle-engineer` | Database schemas, migrations, queries |
| `astro-engineer` | Astro pages, islands, SSR |
| `tanstack-start-engineer` | Admin app routes, loaders, server functions |
| `design-reviewer` | Visual UI review with Playwright screenshots |
| `devops-engineer` | CI/CD, Docker, deployment |
| `tech-lead` | Architecture oversight, security audits |
| `node-typescript-engineer` | Shared packages, utilities |

## Key Skills (Slash Commands)

| Skill | Description |
|-------|-------------|
| `/commit` | Generate conventional commit message from staged changes |
| `/code-check` | Run lint + typecheck across all packages |
| `/run-tests` | Execute test suite with coverage validation |
| `/quality-check` | Full quality validation (lint, types, tests, review) |
| `/code-review` | Systematic code review of changes |
| `/security-audit` | OWASP-aligned security assessment |
| `/performance-audit` | Performance analysis across all layers |
| `/format-markdown` | Format and lint markdown files |

## Task Master Skills

| Skill | Description |
|-------|-------------|
| `/spec` | Generate specification from requirements |
| `/next-task` | Find and start next available task |
| `/tasks` | Task dashboard with progress and statistics |
| `/auto-loop` | Autonomous work loop processing tasks sequentially |

## Common Workflows

### Adding a New Feature

1. `/spec` - Generate specification
2. Review and approve spec
3. `/next-task` - Start first task
4. Implement with tests (test-informed development)
5. `/commit` - Commit changes
6. `/quality-check` - Validate before PR

### Fixing a Bug

1. `/five-why` - Root cause analysis
2. Write failing test
3. Fix the bug
4. `/run-tests` - Verify fix
5. `/commit` - Commit fix

### Code Review

1. `/code-review` - Review staged changes
2. `/security-audit` - Check for vulnerabilities
3. `/design-review` - Visual validation (if UI changes)

## Troubleshooting

### Pre-commit Hook Fails

Biome runs on all staged files. Common issues:

- `useDefaultParameterLast`: Move defaulted params after required ones
- `noExplicitAny`: Use proper types, not `any`
- `noUnusedVariables`: Prefix unused params with `_`

Fix the issue and create a NEW commit (never amend).

### Tests Fail

Run `pnpm test` to see failures. Use `pnpm test:watch` for interactive mode.

### TypeScript Errors

Run `pnpm typecheck` from root. Check `@repo/schemas` for type changes that may affect downstream packages.
