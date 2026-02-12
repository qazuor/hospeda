# Glossary

Comprehensive terminology reference for the Claude Code plugin system.

---

## Plugin System Concepts

### Plugin

A self-contained package of agents, commands, skills, docs, and templates that extends Claude Code capabilities for a specific domain or purpose. Plugins are installed in the `.claude/plugins/` directory.

### Core Plugin

The foundational plugin included with every installation. Provides universal coding standards, templates, and workflows that apply to all projects regardless of tech stack.

### Agent

A specialized AI assistant designed to perform specific tasks within the development workflow. Agents are defined in markdown files and have expertise in particular domains.

**Key characteristics:**

- Single responsibility principle
- Domain-specific expertise
- Can be invoked via Task tool
- Stateless (each invocation is independent)

### Command

A predefined workflow or action that can be executed via slash commands (e.g., `/quality-check`, `/commit`). Commands are defined in markdown files and provide standardized procedures for common tasks.

**Key characteristics:**

- User-invokable via `/command-name`
- Can orchestrate multiple agents
- Supports parameters and options

### Skill

A reusable capability that can be invoked by agents to perform specialized operations. Skills are defined in markdown files and provide focused functionality.

**Key characteristics:**

- Invoked via Skill tool
- Composable (can be combined)
- Task-specific expertise
- Stateless operations

### Hook

A lifecycle event handler that runs automatically at specific points in the development workflow (e.g., pre-commit, post-build). Hooks enable automated checks and transformations.

---

## Planning and Organization

### PDR (Product Design Requirements)

A comprehensive document that defines user stories, acceptance criteria, mockups, and functional specifications for a feature or initiative. Created during the planning phase.

**Key sections:**

- Problem statement and goals
- User stories (As a... I want... So that...)
- Acceptance criteria
- Technical constraints
- Risks and mitigations

### Tech Analysis

A technical planning document that outlines architecture, implementation approach, risks, and task breakdown. Complements the PDR with technical details.

**Key sections:**

- Architecture decisions
- Database design
- API design
- Testing strategy
- Risk assessment

### TODOs

The source of truth for task tracking within a planning session. Contains all tasks, priorities, dependencies, and status.

### Planning Code

A unique identifier for planning sessions. Format: `PF-XXX` (feature), `PR-XXX` (refactor), `PB-XXX` (bugfix).

### Task Code

A unique identifier for individual tasks within a planning session. Format: `PF004-1` (main task), `PF004-1.1` (subtask).

### Atomization

The practice of breaking tasks into small, well-defined units of 0.5-4 hours each. Ensures better estimation accuracy and easier progress tracking.

---

## Development Practices

### TDD (Test-Driven Development)

A development methodology where tests are written before implementation code.

**Cycle:**

1. **RED**: Write failing test
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Improve while tests remain green

### RO-RO Pattern

"Receive Object, Return Object" - A function design pattern where functions accept a single object parameter and return a single object. Improves readability, extensibility, and type safety.

### AAA Pattern

"Arrange, Act, Assert" - The standard structure for writing tests:

- **Arrange**: Set up test data and dependencies
- **Act**: Execute the function being tested
- **Assert**: Verify the result

### Conventional Commits

A commit message format that provides semantic meaning to changes. Format: `<type>(<scope>): <description>`

**Types:** feat, fix, refactor, docs, test, chore, perf, style, ci, build

### Atomic Commit

A commit that contains only the changes related to one specific task. Never mix unrelated changes in a single commit.

---

## Architecture Terms

### Clean Architecture

An architecture pattern where source code dependencies point inward. The domain layer is at the center, free from infrastructure concerns.

### SOLID

Five principles of object-oriented design:

- **S**ingle Responsibility: One reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Subtypes substitutable for base types
- **I**nterface Segregation: Many small interfaces over one large one
- **D**ependency Inversion: Depend on abstractions, not concretions

### Repository Pattern

Abstracts data access behind a consistent interface, hiding the details of the underlying data store from the business logic.

### Service Layer

A layer of the application that contains business logic and orchestrates operations between the data layer and the presentation layer.

### ADR (Architecture Decision Record)

A document that captures an important architectural decision made, along with its context and consequences.

---

## Quality Terms

### Code Coverage

The percentage of code executed during test runs. Minimum target: 90%.

### Core Web Vitals

Google's metrics for measuring user experience on the web:

- **LCP** (Largest Contentful Paint): Loading performance
- **INP** (Interaction to Next Paint): Interactivity
- **CLS** (Cumulative Layout Shift): Visual stability

### OWASP Top 10

The ten most critical web application security risks, as defined by the Open Web Application Security Project.

### WCAG

Web Content Accessibility Guidelines - standards for making web content accessible to people with disabilities.

---

## Workflow Terms

### Workflow Level

The complexity and formality level of a development workflow:

1. **Level 1 (Quick Fix)**: Simple changes (< 30 minutes)
2. **Level 2 (Atomic Task)**: Standard tasks (30 min - 3 hours)
3. **Level 3 (Feature)**: Full feature development (> 3 hours, multi-day)

### Workflow Phase

A stage in the standard development workflow:

1. **Planning**: PDR, tech analysis, task breakdown
2. **Implementation**: TDD, code, tests
3. **Validation**: QA, code review, security audit
4. **Finalization**: Documentation, commits, PRs

### Checkpoint

A state file that tracks workflow progress, enabling session continuity. Tracks current phase, current task, and completion status.

### Quality Check

A comprehensive validation process that runs linting, type checking, tests, code review, security audit, and performance analysis in sequence.

---

## Integration Terms

### MCP (Model Context Protocol)

An integration protocol that allows Claude Code to interact with external services and tools. MCP servers provide access to databases, APIs, documentation, and other resources.

### CI/CD

Continuous Integration / Continuous Deployment - automated processes for building, testing, and deploying code changes.

### GitHub Action

An automated workflow defined in YAML that runs in response to GitHub events (push, PR, schedule, etc.).

---

## File Conventions

### Barrel File

An `index.ts` file that re-exports symbols from multiple files in a directory, providing a clean public API.

### Template File

A file with placeholder markers (e.g., `{{PLACEHOLDER}}`) that serves as a starting point for new documents or configurations.

### Schema File

A JSON Schema or Zod schema file used for validation of data structures, API inputs, or configuration files.

---

<!-- Last updated: 2025-01-29 -->
