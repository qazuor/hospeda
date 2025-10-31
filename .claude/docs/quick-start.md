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
├── commands/         # Slash commands (18 total)
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
│   ├── standards/    # Code & architecture standards
│   ├── workflows/    # Workflow guides
│   └── templates/    # Document templates
├── schemas/          # JSON schemas for validation (7 total)
├── scripts/          # Automation scripts (10 total)
└── sessions/
    └── planning/     # Planning session artifacts
```

### Key Concepts

| Term | Definition | Example |
|------|------------|---------|
| **Agent** | Specialized AI assistant | `hono-engineer`, `qa-engineer` |
| **Command** | Slash-invokable workflow | `/start-feature-plan`, `/quality-check` |
| **Skill** | Reusable capability | `git-commit-helper` |
| **Planning Code** | Session identifier | `PF-004` (feature), `PR-002` (refactor) |
| **Task Code** | Atomic task identifier | `PF004-5` (main), `PF004-5.2` (subtask) |

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

**Guide:** [quick-fix-protocol.md](workflows/quick-fix-protocol.md)

### Level 2: Atomic Task / Bugfix-Small (30 min - 3 hours)

**Use for:**

- Bugfixes with logic changes
- Small features (search, filters, sorting)
- Targeted refactoring (2-10 files)
- New validation rules

**Process:** Simplified Planning → TDD Implementation → Quality Check → Commit

**Code:** `PB-XXX` (e.g., PB-042)

**Example:** Adding pagination to a table or fixing a calculation bug

**Guide:** [atomic-task-protocol.md](workflows/atomic-task-protocol.md)

### Level 3: Large Feature (> 3 hours, multi-day)

**Use for:**

- Complete features requiring full design
- Database schema changes
- API contract changes
- Architecture changes

**Process:** 4-phase workflow (Planning → Implementation → Validation → Finalization)

**Code:** `PF-XXX` (feature) or `PR-XXX` (refactor)

**Example:** Building a complete booking system or adding authentication

**Guides:** [phase-1-planning.md](workflows/phase-1-planning.md) through [phase-4-finalization.md](workflows/phase-4-finalization.md)

**Decision tool:** See [workflows/decision-tree.md](workflows/decision-tree.md)

---

## Step 3: Start Your First Feature (5 min)

Let's create a simple feature using Level 2 workflow.

### Phase 1: Planning

1. **Start planning session:**

   ```bash
   # Invoke command
   /start-feature-plan
   ```

   - Provide feature name (e.g., "User profile page")
   - Answer agent questions
   - Review generated PDR.md and tech-analysis.md

2. **Files created:**

   ```
   .claude/sessions/planning/PF-XXX-{feature-name}/
   ├── PDR.md              # Product requirements
   ├── tech-analysis.md    # Technical plan
   ├── TODOs.md            # Task list (source of truth)
   └── .checkpoint.json    # Progress tracker
   ```

3. **Review and approve:**
   - Check user stories in PDR.md
   - Verify task breakdown in TODOs.md
   - Ensure atomization (each task ≤ 4 hours)

### Phase 2: Implementation

1. **Start implementing:**

   Claude will:
   - Read checkpoint to resume from correct task
   - Follow TDD (test first, then code)
   - Update checkpoint after each task
   - Commit incrementally

2. **You monitor progress:**

   ```bash
   # Check current task
   cat .claude/sessions/planning/PF-XXX-*/. checkpoint.json

   # View task list
   cat .claude/sessions/planning/PF-XXX-*/TODOs.md
   ```

### Phase 3: Validation

1. **Run quality checks:**

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

2. **Fix any issues** identified during validation

### Phase 4: Finalization

1. **Generate commits:**

   ```bash
   /commit
   ```

   Claude will:
   - Analyze all changes
   - Group related files
   - Generate conventional commits
   - Present for your approval

2. **Create PR (optional):**

   Push changes and create PR via GitHub interface

---

## Step 4: Validate Your Setup (3 min)

Run validation scripts to ensure everything is configured correctly:

```bash
# Validate documentation structure
pnpm claude:validate:docs

# Validate JSON schemas
pnpm claude:validate:schemas

# Sync code registry
pnpm claude:sync:registry

# Run all validations
pnpm claude:validate
```

**Expected output:**

- Documentation validation: May show warnings (expected if READMEs not updated yet)
- Schema validation: Should pass for .checkpoint.json and .code-registry.json
- Registry sync: Should complete successfully

---

## Common Tasks Reference

### Starting Work

| Task | Command/Action |
|------|----------------|
| New feature | `/start-feature-plan` |
| Refactoring | `/start-refactor-plan` |
| Bug fix (small) | Edit directly (Level 1) |
| Resume work | Claude reads `.checkpoint.json` automatically |

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
| Sync to GitHub | `pnpm planning:sync {session-path}` |

### Validation & Maintenance

| Task | Command/Action |
|------|----------------|
| Validate docs | `pnpm claude:validate:docs` |
| Validate schemas | `pnpm claude:validate:schemas` |
| Sync registry | `pnpm claude:sync:registry` |
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
- Modify `.code-registry.json` directly (regenerate via script)
- Write code/comments in Spanish

---

## Getting Help

### Documentation

- **This guide:** Quick overview and common tasks
- **[glossary.md](glossary.md):** Comprehensive terminology reference
- **[workflows/](workflows/):** Detailed workflow guides
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
2. **Read workflows:** Check `.claude/docs/workflows/` for detailed guides
3. **Review standards:** Understand code patterns in `.claude/docs/standards/`
4. **Try a feature:** Start with `/start-feature-plan` for a small feature

**Happy coding! 🚀**

---

*Last updated: 2025-10-31*
