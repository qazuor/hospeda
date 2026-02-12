# Development Workflow

## Overview

This document defines the **mandatory development workflow** for all non-trivial changes. The workflow combines **Spec Driven Development (SDD)** and **Test Driven Development (TDD)** to ensure every feature is fully specified before coding begins, and every line of code is backed by tests.

**Core philosophy:** Nothing is done without a spec. Nothing is done without tests. No exceptions.

---

## Methodology: SDD + TDD

This workflow uses the best of two complementary methodologies:

### Spec Driven Development (SDD)

The **specification is the single source of truth**. Before any code is written, a detailed spec defines:

- What to build (user stories, acceptance criteria)
- How to build it (technical approach, architecture decisions)
- How to verify it (testing strategy, quality gates)
- What NOT to build (explicit scope boundaries)

**Principle:** If it is not in the spec, it does not get built. If it is in the spec, it MUST be built AND tested.

### Test Driven Development (TDD)

**Tests are written BEFORE implementation code.** Every task follows the Red-Green-Refactor cycle:

1. **RED** — Write a failing test that defines the expected behavior
2. **GREEN** — Write the minimum code to make the test pass
3. **REFACTOR** — Improve the code while keeping tests green

**Principle:** If there is no test, the work is not done. Code without tests does not exist in this workflow.

### How SDD and TDD Work Together

```
SDD defines WHAT to test (acceptance criteria, edge cases, behaviors)
         ↓
TDD defines HOW to implement (test first, then code)
         ↓
Quality gates VERIFY everything passes (lint, typecheck, tests)
```

The spec provides the test cases. TDD ensures those test cases are written before the implementation. The quality gate ensures nothing ships without passing.

| SDD Provides | TDD Executes |
|---|---|
| User stories with acceptance criteria | Unit tests for each acceptance criterion |
| Edge cases and error scenarios | Tests for each edge case and error |
| API request/response shapes | API integration tests |
| Data model validation rules | Validation unit tests |
| User flows | E2E tests for critical flows |

---

## The Iron Rule: No Tests = Not Done

**A task, feature, fix, or change is NEVER considered complete without tests.**

### Minimum Testing Requirements

Every piece of work MUST include at minimum:

| Change Type | Required Tests |
|---|---|
| **Any code change** | Unit tests for all new/modified public functions |
| **Service/business logic** | Unit tests + integration tests with dependencies |
| **API endpoints** | Integration tests for all endpoints (success, error, auth, validation) |
| **Database changes** | Unit tests for model methods + integration tests for queries |
| **Frontend components** | Unit tests for logic + interaction tests |
| **User-facing flows** | E2E tests for critical paths (when applicable) |
| **Bug fixes** | Regression test that reproduces the bug and verifies the fix |

### Test Coverage Expectations

- **Unit tests:** ALWAYS required. Every public function, every branch, every error path.
- **Integration tests:** Required when the code interacts with databases, APIs, external services, or multiple components working together.
- **E2E tests:** Required when the change involves user-facing flows, critical paths, or multi-step processes that span the full stack.

### What "Done" Means

A task is ONLY considered done when ALL of the following are true:

1. Implementation is complete per the task description
2. **Unit tests are written and passing** for all new/modified code
3. **Integration tests are written and passing** where applicable
4. **E2E tests are written and passing** where applicable
5. Lint passes with no errors
6. Typecheck passes with no errors
7. ALL existing tests still pass (no regressions)
8. Task state is updated

**If any of these conditions are not met, the task is NOT done.** Period.

---

## Workflow Summary

```
Request → Plan Mode → Spec (SDD) → Tasks → Development (TDD) → Done
```

| Step | Action | Methodology | Output |
|------|--------|-------------|--------|
| 1 | User requests a change | — | Requirement description |
| 2 | Enter Plan Mode | SDD | Approved plan with full clarity |
| 3 | Generate specification | SDD | Approved spec with test strategy |
| 4 | Generate tasks | SDD | Approved atomic tasks with test requirements |
| 5 | Develop in order | TDD | Completed tasks with tests and state updates |

---

## Step 1: User Requests a Change

The workflow begins when the user requests a feature, fix, improvement, or refactor.

**Assess the request:**

- **Trivial** (typo, config tweak, 1-2 lines): Skip to direct implementation. No plan or spec needed. **But still write a test if the change affects behavior.**
- **Small** (single file, clear scope, < 1 hour): Consider a standalone task via `/new-task`. **Must include unit tests.**
- **Medium or larger** (multiple files, unclear scope, architecture decisions): **MUST follow the full SDD+TDD workflow below.**

**When in doubt, follow the full workflow.** It is always better to over-plan than to start coding with unclear requirements.

---

## Step 2: Plan Mode — Discuss and Clarify (SDD)

**Purpose:** Eliminate ALL ambiguity before writing a single line of spec or code. Nothing should be left to free interpretation during development.

### Enter Plan Mode

When the request is non-trivial, **immediately enter Plan Mode** before doing anything else. Plan Mode is for discussing, questioning, and aligning — NOT for coding.

### Ask Many Questions

This is the most critical part of the entire workflow. The goal is to **ask the user as many questions as needed** until there is zero ambiguity about what needs to be built and how.

**Question categories to cover:**

#### Functional Requirements

- What exactly should happen from the user's perspective?
- What are all the possible user flows?
- What should happen on success? On failure? On edge cases?
- Are there different user roles with different behaviors?
- What data is involved? What are the validation rules?
- What are the acceptance criteria for each behavior?

#### Technical Requirements

- Which parts of the codebase are affected?
- Are there architectural decisions to make (patterns, libraries, approaches)?
- Are there database changes needed? What migrations?
- Are there API changes? New endpoints? Modified endpoints?
- Are there performance requirements or constraints?
- Are there security considerations?

#### Scope Boundaries

- What is explicitly IN scope?
- What is explicitly OUT of scope?
- Are there related features that should NOT be touched?
- What is the minimal viable version vs nice-to-have?

#### Testing Strategy

- What test coverage is expected?
- What unit tests are needed for each component?
- Which interactions require integration tests?
- Which user flows require E2E tests?
- Are there specific edge cases that MUST be tested?
- What existing tests might be affected?

#### Dependencies and Risks

- Are there external dependencies needed?
- Are there internal dependencies or blockers?
- What could go wrong? What are the risks?
- Are there backwards compatibility concerns?

### Question Guidelines

- **Do NOT assume.** If something is unclear, ask.
- **Do NOT interpret freely.** If the user's answer is ambiguous, ask for clarification.
- **Ask follow-up questions.** One answer often reveals the need for more questions.
- **Validate understanding.** Summarize what you understood and ask the user to confirm.
- **Cover ALL angles.** Functional, technical, UX, testing, security, performance.
- **It is OK to ask many questions.** 10-20 questions is normal for a complex feature. The user prefers thorough questioning over bad assumptions.

### Plan Mode Output

The result of Plan Mode should be a **clear, complete plan** that covers:

1. What will be built (functional description)
2. How it will be built (technical approach)
3. What files will be created/modified
4. What the user flows look like
5. What the edge cases and error handling look like
6. **What the testing strategy is** (unit, integration, E2E — specific to this feature)
7. What is out of scope

**The user must explicitly approve the plan before proceeding to Step 3.**

---

## Step 3: Generate Specification (SDD)

**Purpose:** Transform the approved plan into a formal, detailed specification document that serves as the single source of truth for implementation AND testing.

### Run `/spec`

Once the plan is approved, generate the specification using `/spec`. The spec command will:

1. Check for overlaps with existing specs and tasks
2. Assess complexity (medium → spec-lite, high → spec-full)
3. Write a structured spec using the appropriate template
4. Present it for user approval

### Spec Quality Requirements

The generated spec MUST be **super detailed**. It is the contract for both development AND testing. Everything a developer needs to implement and test the feature should be in the spec:

- **User stories** with detailed acceptance criteria (Given/When/Then) — these become test cases
- **Technical approach** with specific file paths, patterns to follow, and architecture decisions
- **Code examples** showing expected patterns, API shapes, data structures
- **Data model changes** with exact table/column definitions
- **API design** with request/response examples — these become integration test assertions
- **Error handling** for every failure scenario — each becomes a test case
- **Edge cases** explicitly documented — each becomes a test case
- **Performance considerations** if applicable
- **Security considerations** if applicable

### Testing Strategy in the Spec

Every spec MUST include a dedicated **Testing Strategy** section that defines:

1. **Unit tests required:** List each component/function that needs unit tests and what behaviors to test
2. **Integration tests required:** List each interaction point (API endpoints, service-to-database, etc.) that needs integration tests
3. **E2E tests required:** List each user flow that needs end-to-end testing (if applicable)
4. **Edge case tests:** List specific edge cases and error scenarios that must have dedicated tests
5. **Regression tests:** For bug fixes, define the regression test that reproduces the original bug

**The acceptance criteria in user stories directly translate to test assertions.** Each "Given/When/Then" criterion is a test case that MUST be implemented.

**The user must explicitly approve the spec before proceeding to Step 4.**

---

## Step 4: Generate Tasks (SDD)

**Purpose:** Break the approved spec into ultra-granular atomic tasks organized by phases, with clear dependencies, execution order, and test requirements.

### Task Generation

After spec approval, task generation happens automatically (or via the task-from-spec skill). The task generator will:

1. Parse the approved spec
2. Break it into atomic tasks using the task-atomizer
3. Score complexity for each task
4. Build the dependency graph
5. Organize tasks by phase
6. Present the task breakdown for approval

### Task Granularity Requirements

Tasks MUST be **extremely granular and atomic**. Each task should:

- Be completable independently
- Touch a focused set of files (ideally 1-5)
- Have clear start and end conditions
- **Include specific test requirements** (what tests to write for this task)
- Be verifiable through quality gates (lint, typecheck, tests)

**There is no maximum number of tasks.** It is far better to have 30 small, clear tasks than 8 large, ambiguous ones. Granularity is preferred over brevity.

### Test Requirements Per Task

Every task description MUST specify:

- **What unit tests to write** — specific functions, behaviors, edge cases
- **What integration tests to write** (if applicable) — specific interactions to verify
- **What E2E tests to write** (if applicable) — specific user flows to automate
- **Expected test patterns** — AAA structure, fixtures needed, mocks needed

A task without test requirements in its description is incomplete and should not be approved.

### Phase Organization

Tasks are organized into phases that create natural pause points:

1. **Setup** — Configuration, dependencies, environment
2. **Core** — Database, models, services, business logic (with unit tests per TDD)
3. **Integration** — API routes, frontend components, connections (with integration tests per TDD)
4. **Testing** — Cross-cutting integration tests, E2E tests, performance tests
5. **Docs** — Documentation updates
6. **Cleanup** — Refactoring, optimization, dead code removal

**Note on the Testing phase:** Unit tests and component-level integration tests are written DURING the Core and Integration phases (TDD). The Testing phase is for cross-cutting tests that span multiple components, E2E tests, and performance tests.

**Between phases, the user can pause, review progress, and adjust course.** Each phase completion is a checkpoint.

### Task Approval

The complete task breakdown with phases and dependencies is presented to the user for approval. The user can:

- Approve as-is
- Request modifications (split, merge, reorder, add, remove tasks)
- Request re-generation with different granularity

**The user must explicitly approve the task breakdown before proceeding to Step 5.**

---

## Step 5: Development — Execute Tasks with TDD

**Purpose:** Implement each task following TDD (Red-Green-Refactor), updating state after each completion.

### Task Execution Flow

For each task, follow this cycle:

```
Pick task → Write tests (RED) → Implement (GREEN) → Refactor → Quality gate → Update state → Commit → Next task
```

#### 5a. Pick the Next Task

Use `/next-task` to find the next available task. The system considers:

- Dependency resolution (blocked tasks are skipped)
- Phase ordering (setup before core before integration...)
- Complexity scoring (quick wins vs critical path)

#### 5b. Write Tests First (TDD — RED Phase)

**Before writing any implementation code:**

1. Read the task description and its test requirements
2. Write the test(s) that define the expected behavior
3. Run the tests — they MUST fail (red)
4. The failing tests define exactly what needs to be implemented

**What to write in the RED phase:**

- Unit tests for each public function the task will create or modify
- Integration tests for each API endpoint or service interaction (if applicable)
- Edge case tests for each documented edge case
- Error handling tests for each failure scenario

```
RED: Write failing tests
  ↓ Tests fail — this is expected and correct
```

#### 5c. Implement the Minimum Code (TDD — GREEN Phase)

**Now write the implementation:**

1. Write the minimum code necessary to make the failing tests pass
2. Do not over-engineer — just make the tests green
3. Run the tests — they MUST all pass (green)
4. Focus ONLY on what the task specifies — do not scope-creep

```
GREEN: Write minimum code to pass tests
  ↓ All tests pass — implementation is correct
```

#### 5d. Refactor (TDD — REFACTOR Phase)

**With green tests as a safety net:**

1. Improve code quality, naming, structure
2. Remove duplication
3. Run tests after each refactor — they MUST stay green
4. If a refactor breaks a test, undo it and try a different approach

```
REFACTOR: Improve code with green tests as safety net
  ↓ Tests still pass — refactoring is safe
```

#### 5e. Run Quality Gate

Before marking a task as complete, ALL quality checks must pass:

1. **Lint** — no lint errors
2. **Typecheck** — no type errors
3. **Tests** — ALL tests pass (new tests AND existing tests)
4. **Test existence** — the task MUST have new tests (a task with zero new tests is NOT done)

If any check fails, fix the issues before completing the task.

**The quality gate will reject task completion if no new tests were written for the task.** Writing code without tests is not acceptable.

#### 5f. Update Task State

After quality gates pass, the task state MUST be updated:

- Task status → `completed`
- Completion timestamp recorded
- Quality gate results recorded (including test coverage)
- Summary statistics updated
- TODOs.md regenerated
- Newly unblocked tasks identified

**State updates are mandatory.** Never skip updating state after completing a task. The task dashboard (`/tasks`) and next-task selection depend on accurate state.

#### 5g. Commit the Work

After task completion:

- Create an atomic commit for the task's changes (implementation + tests together)
- Follow conventional commits format
- Stage ONLY the files related to this task (source files AND test files)
- Run quality checks before committing
- No attribution lines (no Co-Authored-By, no Generated by)

**Implementation and tests are committed together.** They are a single atomic unit. Never commit implementation without its tests.

#### 5h. Phase Boundaries

When finishing the last task of a phase:

1. Report phase completion to the user
2. Show progress summary including test coverage
3. **Pause and ask the user** if they want to continue to the next phase or review first
4. This is a natural checkpoint for course correction

### TDD Within Each Phase

| Phase | TDD Application |
|---|---|
| **Setup** | Write config validation tests, then set up configuration |
| **Core** | Write unit tests for models/services, then implement them |
| **Integration** | Write integration tests for APIs/connections, then implement them |
| **Testing** | Write E2E and cross-cutting tests (this phase IS the test writing) |
| **Docs** | N/A (no TDD for documentation) |
| **Cleanup** | Ensure existing tests pass after each refactor step |

### Handling Issues During Development

- **Task too large:** If a task turns out to be larger than expected, consider splitting it into sub-tasks using `/replan`
- **Blocked by external dependency:** Mark the task as blocked and pick the next available one
- **Spec clarification needed:** Ask the user. Do not guess or assume.
- **Scope creep detected:** Create a new task or note for the user. Do not expand the current task's scope.
- **Test is hard to write:** This usually means the design needs improvement. Refactor for testability before proceeding.
- **Existing tests break:** Fix them immediately. Do not leave broken tests for later.

---

## Workflow Commands Reference

| Step | Command | Purpose |
|------|---------|---------|
| Plan | Enter Plan Mode | Discuss and clarify requirements (SDD) |
| Spec | `/spec` | Generate specification from approved plan (SDD) |
| Tasks | (automatic from /spec) | Generate atomic tasks with test requirements |
| Dashboard | `/tasks` | View all tasks and progress |
| Next | `/next-task` | Find and start the next task |
| Status | `/task-status` | Detailed progress report |
| Replan | `/replan` | Modify tasks when requirements change |
| Commit | `/commit` | Generate commit for completed work |

---

## Anti-Patterns to Avoid

### Skipping Plan Mode

**Never** start writing specs or code without first discussing requirements with the user. Even if the request seems clear, ask clarifying questions.

### Vague Specs

**Never** generate a spec that leaves room for interpretation. If something is unclear in the plan, go back to Plan Mode and ask more questions.

### Specs Without Testing Strategy

**Never** approve a spec that does not define what tests are required. The spec must specify unit, integration, and E2E test expectations.

### Large Tasks

**Never** create tasks that take more than a few hours. If a task feels big, break it down further. Granularity is always preferred.

### Tasks Without Test Requirements

**Never** approve a task that does not specify what tests to write. Every task description must include its test requirements.

### Code Without Tests

**Never** consider any code "done" without tests. Unit tests are ALWAYS required. Integration tests are required for multi-component interactions. E2E tests are required for user-facing flows. **Without tests, the work is not done.**

### Implementation Before Tests

**Never** write implementation code before writing the tests. Follow TDD: Red → Green → Refactor. The tests define the expected behavior; the implementation fulfills it.

### Committing Implementation Without Tests

**Never** commit source code without its corresponding tests. Implementation and tests are a single atomic unit. They are committed together, always.

### Skipping State Updates

**Never** complete a task without updating its state. The entire system depends on accurate state tracking.

### Scope Creep During Tasks

**Never** add functionality that is not part of the current task. If you discover something that needs to be done, create a new task for it.

### Skipping Quality Gates

**Never** mark a task as complete without passing lint, typecheck, and tests. Quality is non-negotiable.

### Committing Without Checks

**Never** commit code that fails lint, typecheck, or tests. Run all quality checks before every commit.

---

## Summary

The development workflow combines **Spec Driven Development** and **Test Driven Development** to ensure every non-trivial change follows a structured, test-backed path from requirement to implementation:

1. **Plan Mode (SDD)** — Ask questions, eliminate ambiguity, define testing strategy, align with the user
2. **Specification (SDD)** — Document everything in detail including test requirements, get approval
3. **Task Breakdown (SDD)** — Ultra-granular atomic tasks with test requirements per task, organized by phase, get approval
4. **Development (TDD)** — For each task: write tests first (RED), implement (GREEN), refactor, pass quality gates, update state, commit atomically
5. **Phase Checkpoints** — Pause between phases, review progress and test coverage, adjust if needed

### The Three Absolutes

1. **No spec, no code.** Everything starts with a specification.
2. **No tests, no done.** Code without tests is not finished.
3. **No green, no commit.** All quality gates must pass before committing.

This process prioritizes **clarity over speed**, **thoroughness over assumptions**, and **tested code over untested code**. The goal is zero surprises during development and zero untested code in the codebase.
