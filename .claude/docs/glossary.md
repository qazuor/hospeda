# Glossary

Comprehensive terminology reference for the Claude Code workflow system.

---

## Core Concepts

### Agent

A specialized AI assistant designed to perform specific tasks within the development workflow. Agents are defined in `.claude/agents/` and have expertise in particular domains (e.g., `product-functional`, `hono-engineer`, `qa-engineer`).

**Key characteristics:**

- Single responsibility principle
- Domain-specific expertise
- Can be invoked via Task tool
- Stateless (each invocation is independent)

**Example:** The `db-drizzle-engineer` agent specializes in Drizzle ORM schemas and database operations.

### Command

A predefined workflow or action that can be executed via slash commands (e.g., `/start-feature-plan`, `/quality-check`). Commands are defined in `.claude/commands/` and provide standardized procedures for common tasks.

**Key characteristics:**

- User-invokable via `/command-name`
- Can orchestrate multiple agents
- Defined in markdown files
- Supports parameters and options

**Example:** `/quality-check` runs lint, typecheck, tests, and code review in sequence.

### Skill

A reusable capability that can be invoked by agents to perform specialized operations. Skills are defined in `.claude/skills/` and provide focused functionality.

**Key characteristics:**

- Invoked via Skill tool
- Composable (can be combined)
- Task-specific expertise
- Stateless operations

**Example:** The `git-commit-helper` skill assists with generating conventional commit messages.

### MCP (Model Context Protocol)

An integration protocol that allows Claude Code to interact with external services and tools. MCP servers provide access to databases, APIs, documentation, and other resources.

**Available MCP servers:**

- Context7 (library documentation)
- Neon (PostgreSQL database)
- Mercado Pago (payment processing)
- GitHub (version control)
- Vercel (deployment)

**Configuration:** Defined in `.claude/mcp.json`

---

## Planning & Organization

### Planning Code

A unique identifier for planning sessions following the pattern `P-XXX` or `PF-XXX` for features, `PR-XXX` for refactors.

**Format:**

- `P-XXX`: Generic planning (e.g., `P-001`)
- `PF-XXX`: Feature planning (e.g., `PF-004`)
- `PR-XXX`: Refactor planning (e.g., `PR-002`)

**Example:** `PF-004-workflow-optimization`

### Task Code

A unique identifier for individual tasks within a planning session following the pattern `PF004-X` or `PF004-X.Y` for subtasks.

**Format:**

- `PF004-1`: Main task
- `PF004-1.1`: Subtask
- `PF004-1.1.1`: Sub-subtask (if needed)

**Constraints:**

- Tasks must be atomized: 0.5-4 hours each
- Sequential numbering within planning session
- Hierarchical for subtasks

**Example:** `PF004-5.2` = Planning PF-004, Task 5, Subtask 2

### PDR (Product Design Requirements)

A comprehensive document that defines user stories, mockups, acceptance criteria, and functional specifications for a feature or initiative.

**Location:** `.claude/sessions/planning/{session}/PDR.md`

**Key sections:**

- User stories (As a... I want... So that...)
- Mockups/wireframes
- Acceptance criteria
- Business rules
- Technical constraints

**Created by:** `product-functional` agent in Phase 1

### Tech Analysis

A technical planning document that outlines architecture, implementation approach, risks, and task breakdown.

**Location:** `.claude/sessions/planning/{session}/tech-analysis.md`

**Key sections:**

- Architecture decisions
- Technology stack
- Implementation approach
- Task breakdown
- Risk assessment
- Testing strategy

**Created by:** `product-technical` agent in Phase 1

### TODOs

The source of truth for task tracking within a planning session. Contains all tasks, priorities, dependencies, and status.

**Location:** `.claude/sessions/planning/{session}/TODOs.md`

**Format:**

```markdown
### PF004-1: Task Title

- [ ] **[2h]** Task description
  - **Priority**: P0 (Critical)
  - **Dependencies**: None
  - **Assignee**: @agent-name
  - **Status**: Not Started
```

**Note:** The code registry (`.code-registry.json`) is computed from TODOs.md, not vice versa.

---

## Workflow System

### Workflow Level

The complexity and formality level of a development workflow.

**Levels:**

1. **Level 1 (Quick Fix)**: Simple, single-file changes (<1 hour)
2. **Level 2 (Feature/Refactor)**: Standard 4-phase workflow (1-40 hours)
3. **Level 3 (Major Initiative)**: Multi-session, coordinated effort (40+ hours)

**Selection criteria:** See `workflows/decision-tree.md`

### Workflow Phase

A stage in the Level 2 (standard) workflow.

**Phases:**

1. **Phase 1 - Planning**: PDR, tech analysis, task breakdown
2. **Phase 2 - Implementation**: TDD, code, tests
3. **Phase 3 - Validation**: QA, code review, security audit
4. **Phase 4 - Finalization**: Documentation, commits, PRs

**Checkpoint:** `.checkpoint.json` tracks current phase and progress

### Checkpoint

A JSON file that tracks workflow state across sessions, enabling cross-device continuity.

**Location:** `.claude/sessions/planning/{session}/.checkpoint.json`

**Key fields:**

- `currentPhase`: 1-4
- `currentTask`: Current task code (e.g., `PF004-5`)
- `tasksCompleted`: Number of completed tasks
- `lastUpdated`: ISO timestamp

**Purpose:** Resume work from any device

---

## Development Practices

### TDD (Test-Driven Development)

A development methodology where tests are written before implementation code.

**Cycle:**

1. **RED**: Write failing test
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Improve while tests remain green

**Requirements:**

- 90% minimum test coverage
- Unit + Integration + E2E tests
- AAA pattern (Arrange, Act, Assert)

### Atomization

The practice of breaking tasks into small, well-defined units of 0.5-4 hours each.

**Benefits:**

- Better estimation accuracy
- Easier progress tracking
- Reduced context switching
- Clear completion criteria

**Validation:** Task hours are validated by `todos.schema.json`

### RO-RO Pattern

"Receive Object, Return Object" - A function design pattern where functions accept a single object parameter and return a single object.

**Example:**

```typescript
// Good: RO-RO
function createUser({ name, email }: CreateUserInput): CreateUserResult {
  return { user, token };
}

// Bad: Multiple params and return
function createUser(name: string, email: string): [User, string] {
  return [user, token];
}
```

**Benefits:**

- Named parameters
- Easy to extend
- Type-safe
- Self-documenting

---

## Quality & Validation

### Schema Validation

JSON Schema-based validation of planning documents and configuration files.

**Tool:** `validate-schemas.ts` using ajv

**Validated files:**

- PDR.md (frontmatter)
- tech-analysis.md (frontmatter)
- TODOs.md (frontmatter)
- .checkpoint.json
- .code-registry.json

**Usage:** `pnpm claude:validate:schemas`

### Code Registry

A computed JSON file that aggregates all task codes from TODOs.md files across all planning sessions.

**Location:** `.claude/sessions/planning/.code-registry.json`

**Purpose:**

- Quick lookup of task codes
- Cross-session task tracking
- Validation and reporting

**Generation:** `sync-registry.sh` or `pnpm claude:sync:registry`

**Important:** This is NOT the source of truth. TODOs.md files are authoritative.

### Quality Check

A comprehensive validation process that runs multiple checks in sequence.

**Checks:**

1. Lint (Biome)
2. Type check (TypeScript)
3. Tests (Vitest)
4. Code review (automated)
5. Security audit
6. Performance analysis

**Command:** `/quality-check`

**Exit behavior:** Stops on first failure

---

## Architecture Patterns

### Base Model

A foundational class that all data models extend, providing common CRUD operations.

**Location:** `@repo/db/models/base.model.ts`

**Features:**

- Generic type parameter
- findById, findAll methods
- Database connection handling
- Error standardization

**Usage:** All models in `@repo/db/models/` extend `BaseModel<T>`

### Base Service

A foundational class that all business logic services extend, providing standard CRUD operations.

**Location:** `@repo/service-core/base-crud.service.ts`

**Features:**

- create, read, update, delete methods
- Model integration
- Validation with Zod schemas
- Transaction support

**Usage:** All services in `@repo/service-core/` extend `BaseCrudService`

### Factory Pattern

A pattern used for creating consistent API routes with shared configuration.

**Examples:**

- `createCRUDRoute`: Full CRUD endpoints
- `createListRoute`: List/search endpoints
- `createAuthRoute`: Authentication endpoints

**Benefits:**

- Consistent error handling
- Shared middleware
- Standardized responses
- Type safety

---

## Conventions

### Naming Conventions

**Agents:** kebab-case, domain-descriptive (e.g., `hono-engineer`, `db-drizzle-engineer`)

**Commands:** kebab-case, action-verb (e.g., `/start-feature-plan`, `/quality-check`)

**Skills:** kebab-case, noun-phrase (e.g., `git-commit-helper`, `qa-criteria-validator`)

**Planning codes:** Uppercase with hyphens (e.g., `PF-004`, `PR-002`)

**Task codes:** Uppercase, no hyphens in task number (e.g., `PF004-5`, `PF004-5.2`)

### File Organization

**Agents:** `.claude/agents/{category}/{agent-name}.md`

**Commands:** `.claude/commands/{category}/{command-name}.md`

**Skills:** `.claude/skills/{category}/{skill-name}.md`

**Docs:** `.claude/docs/{topic}.md` or `.claude/docs/{category}/{topic}.md`

**Schemas:** `.claude/schemas/{name}.schema.json`

**Scripts:** `.claude/scripts/{name}.{sh|ts|cjs}`

### Language Policy

**Code/Comments/Docs:** English only

**Chat responses:** Spanish only (when interacting with Spanish-speaking users)

**Rationale:** Global collaboration, consistency, maintainability

---

## Tools & Scripts

### validate-docs.sh

Shell script that validates documentation structure and consistency.

**Checks:**

- Agent/command/skill counts vs READMEs
- Broken internal links
- Required directory structure

**Usage:** `pnpm claude:validate:docs`

### validate-schemas.ts

TypeScript script that validates JSON files and markdown frontmatter against JSON schemas.

**Features:**

- ajv-based validation
- Schema caching for performance
- Detailed error reporting

**Usage:** `pnpm claude:validate:schemas`

### sync-registry.sh

Shell script that regenerates the code registry from all TODOs.md files.

**Purpose:** Keep `.code-registry.json` in sync with source of truth

**Usage:** `pnpm claude:sync:registry`

### generate-code-registry.cjs

Node.js script that parses TODOs.md files and generates `.code-registry.json`.

**Features:**

- Parses task codes, titles, status
- Extracts estimated hours
- Sorts tasks alphabetically
- Generates metadata

**Invoked by:** `sync-registry.sh`

---

## Git & Version Control

### Conventional Commits

A commit message format that provides semantic meaning to changes.

**Format:** `<type>(<scope>): <description>`

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

**Example:** `feat(planning): implement code registry system`

### GitHub Issues Sync

The process of syncing planning sessions to GitHub Issues for tracking.

**Mapping:**

- Planning session → Parent issue
- Tasks → Sub-issues
- Subtasks → Checklist items

**File:** `.claude/sessions/planning/{session}/issues-sync.json`

**Tool:** `planning-sync` package

---

## External References

**Claude Code Docs:** <https://docs.claude.com/claude-code>

**TurboRepo:** <https://turbo.build/repo/docs>

**Drizzle ORM:** <https://orm.drizzle.team/docs>

**Hono:** <https://hono.dev/>

**TanStack:** <https://tanstack.com/>

**Astro:** <https://astro.build/>

---

*Last updated: 2025-10-31*
