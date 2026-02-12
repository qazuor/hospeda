# Quick Start Guide

Get up and running with the Claude Code plugin system in 15 minutes.

---

## Prerequisites

Before starting, ensure you have:

- [x] Claude Code CLI installed
- [x] Your project repository cloned
- [x] Node.js >= 18 installed
- [x] A package manager (npm, pnpm, or yarn)

---

## Step 1: Understand the Structure

### Plugin Directory Layout

```
.claude/
  plugins/
    core/                   # Core plugin (always included)
      agents/               # Specialized AI assistants
      commands/             # Slash commands
      skills/               # Reusable capabilities
      docs/                 # Standards and guides
      templates/            # Document and config templates
    {tech-stack}/           # Tech-specific plugins (e.g., astro, react)
      agents/
      commands/
      skills/
      docs/
```

### Key Concepts

| Term | Definition | Example |
|------|-----------|---------|
| **Agent** | Specialized AI assistant | `qa-engineer`, `db-engineer` |
| **Command** | Slash-invokable workflow | `/quality-check`, `/commit` |
| **Skill** | Reusable capability | `git-commit-helper`, `tdd-workflow` |
| **Template** | Starting point for new docs | `global.md.template`, `settings-template.json` |

**Learn more:** See [glossary.md](glossary.md) for comprehensive terminology.

---

## Step 2: Choose Your Workflow Level

The system supports 3 workflow levels based on task complexity:

### Level 1: Quick Fix (< 30 minutes)

**Use for:** Typo fixes, formatting, import organization, config tweaks

**Process:** Edit -> Quick Validation -> Commit

### Level 2: Atomic Task (30 min - 3 hours)

**Use for:** Bug fixes, small features, targeted refactoring

**Process:** Simplified Planning -> TDD Implementation (Red-Green-Refactor) -> Quality Check -> Commit

### Level 3: Full Feature (> 3 hours)

**Use for:** Complete features, database changes, API changes, architecture changes

**Process:** SDD + TDD workflow (Plan Mode -> Spec -> Tasks -> TDD Development -> Done)

**Methodology:** Combines **Spec Driven Development** (spec is the source of truth) with **Test Driven Development** (tests before code, Red-Green-Refactor).

**See:** [development-workflow.md](development-workflow.md) for the full, detailed workflow.

---

## Step 3: Start Your First Task

### For Quick Fixes (Level 1)

1. Make the change
2. Run tests: `npm test`
3. Commit with conventional format: `fix(scope): description`

### For Standard Tasks (Level 2)

Follow **TDD (Red-Green-Refactor):**

1. **Plan:** Define what you need to build
2. **RED — Test first:** Write a failing test that defines expected behavior
3. **GREEN — Implement:** Write the minimum code to make the test pass
4. **REFACTOR:** Improve the code while tests stay green
5. **Validate:** Run quality checks (lint, typecheck, ALL tests)
6. **Commit:** Stage source files AND test files together, then commit

**No tests = Not done.** Every change must include tests.

### For Features (Level 3)

Follow the **Development Workflow** defined in [development-workflow.md](development-workflow.md):

1. **Plan Mode — Discuss and Clarify:**
   - Enter Plan Mode immediately
   - Ask the user many questions (functional, technical, scope, testing, risks)
   - Leave nothing to free interpretation
   - Get explicit plan approval from the user

2. **Specification — Generate Detailed Spec:**
   - Run `/spec` to generate a formal specification
   - Spec must be super detailed: user stories, technical approach, code examples, testing strategy, edge cases, error handling
   - Get explicit spec approval from the user

3. **Tasks — Generate Atomic Task Breakdown:**
   - Task-master generates ultra-granular atomic tasks from the approved spec
   - Tasks are organized by phases (setup → core → integration → testing → docs → cleanup)
   - No limit on number of tasks — granularity is preferred over brevity
   - Get explicit task breakdown approval from the user

4. **Development — Execute In Order with TDD:**
   - Use `/next-task` to pick the next available task
   - Write tests FIRST (RED), then implement (GREEN), then refactor
   - Pass quality gates (lint, typecheck, ALL tests)
   - Update task state after EVERY completed task
   - Commit implementation + tests together atomically
   - Pause between phases for user review

5. **Done — All Tasks Completed:**
   - All phases complete, all quality gates passed
   - Documentation updated
   - PR ready

---

## Step 4: Use Templates

Templates are available in the `templates/` directory:

| Template | Purpose |
|----------|---------|
| `global.md.template` | Universal CLAUDE.md rules |
| `project-generic.md.template` | Project-specific CLAUDE.md |
| `settings-template.json` | Claude Code settings |
| `brand-config.json.template` | Brand voice configuration |
| `code-review.yml` | GitHub Action for code review |
| `security-review.yml` | GitHub Action for security review |

### Using a Template

1. Copy the template to your project
2. Replace all `{{PLACEHOLDER}}` markers with your values
3. Remove any sections that do not apply

---

## Common Commands Reference

### During Development

| Task | Action |
|------|--------|
| Run tests | `npm test` |
| Type check | `npx tsc --noEmit` |
| Lint code | `npx biome check .` |
| Format code | `npx biome check --apply .` |

### Git Operations

| Task | Action |
|------|--------|
| Check status | `git status` |
| Stage specific files | `git add <file>` |
| Commit | `git commit -m "type(scope): description"` |
| View changes | `git diff` |

---

## Best Practices

### DO

- Follow SDD + TDD (spec first, tests second, code third)
- Write tests BEFORE implementation (Red-Green-Refactor)
- Include unit tests for every public function
- Include integration tests for API endpoints and service interactions
- Include E2E tests for critical user flows
- Keep tasks atomic (0.5-4 hours)
- Write all code and comments in English
- Run quality checks before finalizing
- Commit implementation + tests together
- Use schema validation for all inputs

### DON'T

- Consider work "done" without tests (no tests = not done)
- Write implementation before tests
- Skip writing tests (ever, for any reason)
- Commit implementation without corresponding tests
- Create tasks longer than 4 hours (break them down)
- Use `any` type (use `unknown` with type guards)
- Use `git add .` (stage files individually)
- Commit without running all tests

---

## Getting Help

### Documentation

- **This guide:** Quick overview and common tasks
- **[glossary.md](glossary.md):** Terminology reference
- **[code-standards.md](code-standards.md):** Coding standards
- **[testing-standards.md](testing-standards.md):** Testing practices
- **[architecture-patterns.md](architecture-patterns.md):** Architecture guide
- **[atomic-commits.md](atomic-commits.md):** Git commit policy
- **[development-workflow.md](development-workflow.md):** Full development workflow

### Agent Assistance

Ask Claude to invoke specialized agents:

```
"Use the qa-engineer agent to validate my test coverage"
"Invoke the db-engineer agent to help design my schema"
"Call the tech-lead agent to review my architecture"
```

---

## Next Steps

1. **Read the standards:** Review docs in `plugins/core/docs/`
2. **Set up templates:** Copy relevant templates to your project
3. **Configure settings:** Use `settings-template.json` as a starting point
4. **Start coding:** Pick a task and follow the appropriate workflow level
