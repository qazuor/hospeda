# Quick Start Guide

Get up and running with the Claude Code workflow system in 15 minutes.

---

## Prerequisites (2 min)

Before starting, ensure you have:

- [x] Claude Code CLI installed
- [x] Repository cloned: `git clone https://github.com/qazuor/hospeda.git`
- [x] Node.js ≥18 installed
- [x] pnpm ≥8.15.6 installed

**Verify installation:**

```bash
cd hospeda
pnpm install
```

---

## Step 1: Understand the Structure (3 min)

### Directory Layout

```
.claude/
├── agents/           # Specialized AI assistants (13 total)
│   ├── product/      # Product & planning agents
│   ├── engineering/  # Dev agents (Hono, DB, React, etc.)
│   ├── quality/      # QA & debugging agents
│   ├── design/       # UI/UX agents
│   └── specialized/  # Niche expertise (i18n, tech-writer)
├── commands/         # Slash commands (10 total)
│   ├── audit/        # Audit commands (security, performance, accessibility)
│   ├── meta/         # Meta commands (create-agent, create-command, etc.)
│   ├── git/          # Git operations (/commit)
│   └── formatting/   # Code formatting
├── skills/           # Reusable capabilities (16 total)
│   ├── testing/      # Testing methodologies
│   ├── patterns/     # Development patterns (TDD, error handling)
│   ├── tech/         # Tech specialists (Vercel, Shadcn, Mermaid)
│   └── utils/        # Utilities (add-memory, JSON auditor, PDF)
├── docs/             # Documentation (you are here!)
│   └── standards/    # Code & architecture standards
├── schemas/          # JSON schemas for validation (6 total)
└── scripts/          # Automation scripts
```

### Key Concepts

| Term | Definition | Example |
|------|------------|---------|
| **Agent** | Specialized AI assistant | `hono-engineer`, `qa-engineer` |
| **Command** | Slash-invokable workflow | `/quality-check`, `/add-new-entity` |
| **Skill** | Reusable capability | `git-commit-helper` |

**Learn more:** See [glossary.md](glossary.md) for comprehensive terminology.

---

## Step 2: Choose Your Workflow Level (2 min)

The system supports 3 workflow levels based on task complexity:

### Level 1: Quick Fix (< 30 minutes)

**Use for:**

- Typo fixes in code or docs
- Formatting and style tweaks
- Import organization
- Documentation updates
- Config adjustments (1-2 files)

**Process:** Edit → Quick Validation → Commit

**Example:** Fixing a typo in README.md or comment

### Level 2: Atomic Task / Bugfix-Small (30 min - 3 hours)

**Use for:**

- Bugfixes with logic changes
- Small features (search, filters, sorting)
- Targeted refactoring (2-10 files)
- New validation rules

**Process:** Simplified Planning → TDD Implementation → Quality Check → Commit

**Code:** `PB-XXX` (e.g., PB-042)

**Example:** Adding pagination to a table or fixing a calculation bug

### Level 3: Large Feature (> 3 hours, multi-day)

**Use for:**

- Complete features requiring full design
- Database schema changes
- API contract changes
- Architecture changes

**Process:** 4-phase workflow (Planning → Implementation → Validation → Finalization)

**Code:** `PF-XXX` (feature) or `PR-XXX` (refactor)

**Example:** Building a complete booking system or adding authentication

---

## Step 3: Start Your First Feature (5 min)

Let's walk through the typical workflow for implementing a feature.

### Planning

Use the Task Master plugin to plan and break down your feature:

```bash
# Create a spec for a new feature
/spec "User profile page"

# Generate tasks from the spec
/tasks

# Start working on the next task
/next-task
```

### Implementation

Follow TDD (test first, then code) for each task:

1. Write tests first (RED)
2. Implement the solution (GREEN)
3. Refactor (keep tests green)
4. Commit incrementally

### Validation

Run quality checks:

```bash
/quality-check
```

This runs:

- Lint (Biome)
- Type check
- Tests (90% coverage required)
- Code review
- Security audit
- Performance analysis

Fix any issues identified during validation.

### Finalization

Generate commits:

```bash
/commit
```

Claude will:

- Analyze all changes
- Group related files
- Generate conventional commits
- Present for your approval

---

## Step 4: Validate Your Setup (3 min)

Run validation scripts to ensure everything is configured correctly:

```bash
# Validate documentation structure
pnpm claude:validate:docs

# Validate JSON schemas
pnpm claude:validate:schemas

# Run all validations
pnpm claude:validate
```

**Expected output:**

- Documentation validation: May show warnings (expected if READMEs not updated yet)
- Schema validation: Should pass for .checkpoint.json files

---

## Common Tasks Reference

### Starting Work

| Task | Command/Action |
|------|----------------|
| New feature | `/spec` + `/tasks` (Task Master plugin) |
| Next task | `/next-task` (Task Master plugin) |
| Bug fix (small) | Edit directly (Level 1) |

### During Development

| Task | Command/Action |
|------|----------------|
| Run tests | `pnpm test` |
| Type check | `pnpm typecheck` |
| Lint code | `pnpm lint` |
| Quality check | `/quality-check` |
| Code review | `/review-code` |

### Finishing Work

| Task | Command/Action |
|------|----------------|
| Create commits | `/commit` |
| Update docs | `/update-docs` |

### Validation & Maintenance

| Task | Command/Action |
|------|----------------|
| Validate docs | `pnpm claude:validate:docs` |
| Validate schemas | `pnpm claude:validate:schemas` |
| Format markdown | `pnpm format:md` |

---

## Best Practices

### ✅ DO

- Follow TDD (test first, code second)
- Keep tasks atomic (0.5-4 hours)
- Write all code/comments in English
- Run `/quality-check` before finalizing
- Update TODOs.md as source of truth
- Commit incrementally per task

### ❌ DON'T

- Skip writing tests
- Create tasks >4 hours (atomize them)
- Use `any` type (use `unknown` instead)
- Make commits without user approval
- Write code/comments in Spanish

---

## Getting Help

### Documentation

- **This guide:** Quick overview and common tasks
- **[glossary.md](glossary.md):** Comprehensive terminology reference
- **[standards/](standards/):** Code and architecture standards
- **[INDEX.md](INDEX.md):** Master index to all documentation

### Agent Assistance

Ask Claude to invoke specialized agents:

```
"Invoke the tech-lead agent to review my architecture decisions"
"Use the db-drizzle-engineer to help design my Drizzle schema"
"Call the qa-engineer to validate my test coverage"
```

### Commands

Explore available commands:

```bash
# List all commands
ls .claude/commands/**/*.md

# Read command documentation
cat .claude/commands/git/commit.md
```

---

## Next Steps

Now that you're familiar with the basics:

1. **Explore agents:** Browse `.claude/agents/` to see available expertise
2. **Review standards:** Understand code patterns in `.claude/docs/standards/`
3. **Try a feature:** Use `/spec` to plan a small feature with the Task Master plugin

**Happy coding!**

---

Last updated: 2026-01-29
