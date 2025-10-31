# Commands - Available Actions

This directory contains command definitions for automated workflows in the Hospeda project. All command files are **READ-ONLY** and should never be modified.

## How Commands Work

Commands are invoked using the `/command-name` syntax. Each command:

- Has a specific purpose and workflow
- Invokes relevant agents as needed
- Produces specific deliverables
- Follows a consistent execution pattern

Commands are organized into subdirectories by category for better organization and discoverability.

---

## Directory Structure

```
.claude/commands/
├── README.md                     # This file
├── start-feature-plan.md         # Planning commands (root level)
├── start-refactor-plan.md
├── quality-check.md              # Quality commands (root level)
├── code-check.md
├── run-tests.md
├── add-new-entity.md             # Development commands (root level)
├── update-docs.md
├── commit.md                     # Git commands (root level)
├── five-why.md                   # Analysis commands (root level)
├── audit/                        # Comprehensive audit commands
│   ├── security-audit.md
│   ├── performance-audit.md
│   └── accessibility-audit.md
└── meta/                         # System management commands
    ├── create-agent.md
    ├── create-command.md
    ├── create-skill.md
    └── help.md
```

---

## Planning Commands (2)

### `/start-feature-plan`

**Purpose:** Initialize comprehensive planning for a new feature

**File:** [start-feature-plan.md](./start-feature-plan.md)

**Process:**

1. Create `.claude/sessions/planning/{feature_name}/` directory
2. Invoke `product-functional` → Create PDR.md
3. Invoke `ux-ui-designer` → Mockups/wireframes
4. Invoke `product-technical` → tech-analysis.md
5. Break down into atomic tasks (1-2 hours each)
6. Iteratively refine until fully atomic
7. Create TODOs.md with priorities and dependencies
8. Update PDR.md with links

**Output:** Complete planning package ready for implementation

---

### `/start-refactor-plan`

**Purpose:** Plan refactoring work safely

**File:** [start-refactor-plan.md](./start-refactor-plan.md)

**Process:**

1. Invoke `debugger` → Analyze current code
2. Invoke `tech-lead` → Identify architectural issues
3. Invoke `product-technical` → Create refactor plan
4. Break down into safe, incremental steps
5. Identify tests to add/update
6. Create TODO list with priorities

**Output:** Refactoring plan with step-by-step tasks

---

## Quality Assurance Commands (3)

### `/quality-check`

**Purpose:** Complete quality validation before merge

**File:** [quality-check.md](./quality-check.md)

**Execution Order:**

1. `/code-check` (lint + typecheck) - **STOP on first error**
2. `/run-tests` - **STOP on first error**
3. `/security-audit --automated` - report all findings
4. `/performance-audit --quick` - report all findings
5. Code review by `tech-lead` - report all findings

**Output:** Consolidated quality report with all findings

---

### `/code-check`

**Purpose:** Run linting and type checking

**File:** [code-check.md](./code-check.md)

**Process:**

1. Navigate to package root
2. Run `pnpm typecheck` - stop on first error
3. Run `pnpm lint` - stop on first error
4. Report issues with file locations

**Output:** Lint and type check results

---

### `/run-tests`

**Purpose:** Execute test suite with coverage

**File:** [run-tests.md](./run-tests.md)

**Process:**

1. Run `pnpm test:coverage` from repo root
2. Check coverage against 90% threshold
3. Report failures with details
4. Suggest missing test cases

**Output:** Test results with coverage report

---

## Audit Commands (3)

Comprehensive audit commands for security, performance, and accessibility validation.

### `/security-audit`

**Purpose:** Comprehensive security vulnerability assessment and penetration testing

**File:** [audit/security-audit.md](./audit/security-audit.md)

**Scope:** Combines previous `/review-security` and `/pen-test` functionality

**Process:**

1. Authentication & authorization review
2. Input validation & sanitization checks
3. Data protection & privacy validation
4. API security assessment
5. Infrastructure & configuration review
6. Code security patterns analysis
7. Frontend security validation
8. Penetration testing simulation

**Options:**
- `--scope <area>`: auth, api, database, frontend, all
- `--depth <level>`: quick, standard, thorough
- `--report`: Generate detailed security-audit-report.md
- `--fix-suggestions`: Include automated fix suggestions

**Output:** Security audit report with categorized findings (Critical, High, Medium, Low)

**Audit Areas:** 8 comprehensive security checks covering OWASP Top 10 and best practices

---

### `/performance-audit`

**Purpose:** Performance optimization analysis and bottleneck identification

**File:** [audit/performance-audit.md](./audit/performance-audit.md)

**Scope:** Replaces previous `/review-performance` with enhanced metrics

**Process:**

1. Database performance (N+1 queries, indexes, query time)
2. API performance (response time, throughput, payload size)
3. Frontend performance (LCP, FID, CLS, TTI)
4. Bundle size & assets (code splitting, tree shaking)
5. Rendering performance (React profiler, re-renders)
6. Network performance (HTTP/2, CDN, caching)
7. Memory & resource usage (leaks, allocations)
8. Third-party performance impact

**Options:**
- `--scope <area>`: database, api, frontend, all
- `--profile`: Enable detailed profiling with measurements
- `--report`: Generate detailed performance-audit-report.md
- `--benchmarks`: Compare against performance baselines

**Output:** Performance audit report with metrics, trends, and optimization recommendations

**Benchmarks:**
- Query time < 100ms (p95)
- API response < 200ms (p95)
- LCP < 2.5s, FID < 100ms, CLS < 0.1
- Bundle < 500KB gzipped

---

### `/accessibility-audit`

**Purpose:** WCAG 2.1 Level AA compliance validation and assistive technology testing

**File:** [audit/accessibility-audit.md](./audit/accessibility-audit.md)

**Scope:** New comprehensive accessibility audit

**Process:**

1. **Perceivable** - Text alternatives, time-based media, adaptable, distinguishable
2. **Operable** - Keyboard accessible, enough time, seizures prevention, navigable, input modalities
3. **Understandable** - Readable, predictable, input assistance
4. **Robust** - Compatible with assistive technologies
5. Screen reader testing (NVDA, JAWS, VoiceOver, TalkBack)
6. Keyboard navigation validation
7. Mobile accessibility testing
8. Form accessibility verification

**Options:**
- `--scope <area>`: navigation, forms, content, all
- `--level <wcag>`: A, AA, AAA (default: AA)
- `--report`: Generate detailed accessibility-audit-report.md
- `--automated-only`: Run only automated tests (faster)

**Output:** Accessibility audit report with WCAG compliance status and remediation guidance

**Standards:** WCAG 2.1 Level AA compliance (95+ checks)

---

## Development Commands (2)

### `/add-new-entity`

**Purpose:** Create complete full-stack entity

**File:** [add-new-entity.md](./add-new-entity.md)

**Process:**

1. Invoke `product-technical` for entity design
2. Create in order:
   - Zod schemas (`@repo/schemas`)
   - Types via `z.infer<typeof schema>`
   - Drizzle schema (`@repo/db/schemas`)
   - Model extending BaseModel (`@repo/db/models`)
   - Service extending BaseCrudService (`@repo/service-core`)
   - API routes using factory pattern (`apps/api/routes`)
3. Generate migration
4. Create comprehensive tests (unit + integration)
5. Update barrel files (index.ts)
6. Generate documentation

**Output:** Complete entity with tests and docs

---

### `/update-docs`

**Purpose:** Update project documentation

**File:** [update-docs.md](./update-docs.md)

**Process:**

1. Invoke `tech-writer`
2. Identify what needs documentation
3. Update or create:
   - API documentation (OpenAPI)
   - Component usage guides
   - Architecture decisions
   - Deployment guides
4. Generate diagrams if needed
5. Update README files

**Output:** Updated documentation in `/docs`

---

## Meta Commands (4)

System management and workflow enhancement commands.

### `/create-agent`

**Purpose:** Interactive wizard to create new specialized AI agent

**File:** [meta/create-agent.md](./meta/create-agent.md)

**Process:**

1. **Agent Discovery**: Name, category, responsibilities, phase involvement
2. **Configuration**: Tools, model preference, related agents
3. **File Generation**: Create agent file with YAML frontmatter and system prompt
4. **Integration**: Update agents/README.md, CLAUDE.md, documentation
5. **Validation**: Validate structure, test invocation
6. **Commit**: Generate commit message

**Interactive Wizard:** Step-by-step guidance through agent creation

**Output:** New agent file + updated documentation

**Templates:** Technical, Product, Quality, Design agent templates

---

### `/create-command`

**Purpose:** Interactive wizard to create new slash command

**File:** [meta/create-command.md](./meta/create-command.md)

**Process:**

1. **Command Discovery**: Name, type, category, purpose
2. **Specification**: Options, parameters, examples, process steps
3. **File Generation**: Create command file with YAML frontmatter
4. **Integration**: Update commands/README.md, documentation
5. **Validation**: Validate structure, test execution
6. **Commit**: Generate commit message

**Interactive Wizard:** Step-by-step command creation

**Output:** New command file + updated documentation

**Templates:** Workflow, Audit, Utility command templates

---

### `/create-skill`

**Purpose:** Interactive wizard to create new skill for reusable workflows

**File:** [meta/create-skill.md](./meta/create-skill.md)

**Process:**

1. **Skill Discovery**: Name, category, purpose, primary users
2. **Workflow Definition**: Input, process steps, output, success criteria
3. **File Generation**: Create skill file with comprehensive workflow
4. **Integration**: Update skills/README.md, agent documentation
5. **Validation**: Validate structure, test invocation
6. **Commit**: Generate commit message

**Interactive Wizard:** Step-by-step skill creation

**Output:** New skill file + updated documentation

**Templates:** Workflow, Validation, Utility skill templates

---

### `/help`

**Purpose:** Interactive help system with search and topic navigation

**File:** [meta/help.md](./meta/help.md)

**Topics:**
- `commands` - List and search all commands
- `agents` - Browse agents by category
- `skills` - View available skills
- `workflow` - Understand development workflow phases
- `quick-start` - 15-minute getting started guide
- `architecture` - Project structure overview
- `glossary` - Terminology and concepts

**Options:**
- `--search <query>`: Search across all documentation
- `--category <cat>`: Filter by category
- `--details`: Show detailed information
- `--examples`: Show usage examples

**Interactive Menu:** Navigate through help topics with prompts

**Output:** Context-aware help information

**Search:** Full-text search across commands, agents, skills, and documentation

---

## Git Commands (1)

### `/commit`

**Purpose:** Generate conventional commit messages

**File:** [commit.md](./commit.md)

**Process:**

1. Analyze changed files by feature/type
2. Group changes logically
3. Generate commit messages following `commitlint.config.js`
4. Format as copy-paste ready commands
5. **DO NOT stage files** (user does manually)

**Output Format:**

```bash
# Commit 1: {title}
git add {files...}
git commit -m "{type}({scope}): {subject}

{body with bullet points}"

# Commit 2: {title}
git add {files...}
git commit -m "{type}({scope}): {subject}

{body}"
```

**Output:** Formatted git commit commands ready to copy-paste

---

## Analysis Commands (1)

### `/five-why`

**Purpose:** Root cause analysis using 5 Whys technique

**File:** [five-why.md](./five-why.md)

**Use Cases:**

- Debugging complex bugs
- Analyzing architectural decisions
- Understanding recurring problems
- Root cause analysis of issues

**Process:**

1. Invoke `debugger`
2. Perform 5 Whys analysis:
   - Problem statement
   - Why? (1st level)
   - Why? (2nd level)
   - Why? (3rd level)
   - Why? (4th level)
   - Why? (5th level - root cause)
3. Identify root cause
4. Propose solutions with tradeoffs
5. Present options to user

**Output:** 5 Whys analysis document with root cause and solution options

---

## Total: 16 Commands

## Command Categories Summary

- **Planning**: 2 commands (feature planning, refactor planning)
- **Quality Assurance**: 3 commands (quality check, code check, tests)
- **Audit**: 3 commands (security, performance, accessibility)
- **Development**: 2 commands (entity creation, documentation)
- **Meta**: 4 commands (create agent/command/skill, help)
- **Git**: 1 command (commit messages)
- **Analysis**: 1 command (5 Whys root cause)

---

## Command Evolution

### Deprecated Commands

The following commands have been deprecated and replaced with enhanced versions:

- **`/review-code`** → Functionality absorbed into `/quality-check`
- **`/review-security`** → Replaced by `/security-audit` (enhanced)
- **`/review-performance`** → Replaced by `/performance-audit` (enhanced)
- **`/pen-test`** → Merged into `/security-audit`

### New Command Categories

- **Audit Commands** (`audit/`): Comprehensive, report-generating audit commands
- **Meta Commands** (`meta/`): System management and workflow enhancement

---

## Command Execution Guidelines

### Stop on Error vs Report All

**STOP on first error:**

- `/code-check` - Stop at first lint or typecheck error
- `/run-tests` - Stop at first test failure
- `/quality-check` - Stop at lint/typecheck/test errors (Phase 1)

**REPORT all findings:**

- `/quality-check` - Report all review/audit findings (Phase 2)
- `/security-audit` - Report all security findings
- `/performance-audit` - Report all performance issues
- `/accessibility-audit` - Report all accessibility violations

### When to Use Each Command

**Before starting work:**

- `/start-feature-plan` - Every new feature
- `/start-refactor-plan` - Before refactoring
- `/help quick-start` - First time using the system

**During implementation:**

- `/code-check` - Frequently during development
- `/run-tests` - After each significant change
- `/five-why` - When encountering bugs or unclear decisions
- `/help --search <topic>` - When looking for specific guidance

**Before merge:**

- `/quality-check` - **Always** before requesting merge
- `/security-audit` - If security-related changes
- `/performance-audit` - If performance-critical changes
- `/accessibility-audit` - If UI/UX changes

**After implementation:**

- `/update-docs` - After feature complete
- `/commit` - When ready to commit

**Specialized needs:**

- `/add-new-entity` - When adding new domain entities
- `/create-agent` - When new specialized role needed
- `/create-command` - When automating repetitive workflows
- `/create-skill` - When codifying reusable procedures

**System exploration:**

- `/help` - Interactive help system
- `/help commands` - Browse all commands
- `/help agents` - Explore available agents
- `/help workflow` - Understand development workflow

---

## Audit Command Benefits

The new audit commands provide significant improvements over previous review commands:

### Security Audit
- **8 audit areas** vs previous ad-hoc checks
- **95+ security checks** comprehensively documented
- **Penetration testing simulation** integrated
- **Automated report generation** with severity levels
- **Fix suggestions** with code examples

### Performance Audit
- **8 performance areas** systematically analyzed
- **Performance budgets** with baseline comparisons
- **Trend analysis** over time
- **Automated profiling** with measurements
- **Actionable recommendations** prioritized by impact

### Accessibility Audit
- **WCAG 2.1 Level AA** comprehensive validation
- **4 WCAG principles** (Perceivable, Operable, Understandable, Robust)
- **Screen reader testing** (NVDA, JAWS, VoiceOver, TalkBack)
- **Keyboard navigation** validation
- **Mobile accessibility** testing

---

## Meta Command Benefits

Meta commands enable self-improvement of the workflow system:

### System Growth
- **Create agents** when new specialized expertise needed
- **Create commands** to automate repetitive workflows
- **Create skills** to codify reusable procedures
- **Self-documenting** with integrated help system

### Consistency
- **Templates** ensure consistent structure
- **Validation** prevents malformed definitions
- **Best practices** built into wizards
- **Integration** automatically updates documentation

### Discoverability
- **Interactive help** with search and navigation
- **Quick start** gets developers productive in 15 minutes
- **Examples** for every command, agent, and skill
- **Glossary** for terminology understanding

---

## Command Files are READ-ONLY

All files in `.claude/commands/` are **READ-ONLY** and must not be modified. They contain precise instructions for Claude Code to execute specific workflows.

If a command needs improvement:

1. Document the issue in CLAUDE.md Recent Learnings
2. Discuss with user
3. Update command file only after user approval
4. Consider using `/create-command` to create enhanced version

---

## Related Documentation

- **Agents**: `.claude/agents/README.md` - Available AI specialists
- **Skills**: `.claude/skills/README.md` - Reusable workflows
- **Workflow**: `.claude/docs/workflows/` - Detailed workflow guides
- **Standards**: `.claude/docs/standards/` - Code and architecture standards
- **Quick Start**: `.claude/docs/quick-start.md` - 15-minute onboarding
- **Main Guide**: `CLAUDE.md` - Comprehensive project guide

---

**For detailed execution instructions, see individual command files.**

**For interactive help, use `/help`**
