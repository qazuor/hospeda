# CI/CD Documentation

Comprehensive guide to Continuous Integration and Continuous Deployment workflows for the Hospeda tourism platform.

## Table of Contents

- [Overview](#overview)
- [Workflow: CI (ci.yml)](#workflow-ci-ciyml)
- [Workflow: Documentation CI (docs.yml)](#workflow-documentation-ci-docsyml)
- [Workflow: Documentation Validation (validate-docs.yml)](#workflow-documentation-validation-validate-docsyml)
- [Workflow: Planning Cleanup (planning-cleanup.yml)](#workflow-planning-cleanup-planning-cleanupyml)
- [Workflow: Refresh Search Index (refresh-search.yml)](#workflow-refresh-search-index-refresh-searchyml)
- [Secrets Management](#secrets-management)
- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)
- [Adding New Workflows](#adding-new-workflows)
- [CI/CD Best Practices](#cicd-best-practices)

---

## Overview

### CI/CD Philosophy

The Hospeda project follows a **quality-first, automated** approach to continuous integration and deployment:

**Core Principles:**

1. **Quality Gates**: Every change must pass automated checks before merging
2. **Fast Feedback**: Developers know within minutes if their changes break anything
3. **Comprehensive Testing**: 90% minimum test coverage enforced automatically
4. **Documentation Quality**: Documentation is validated like code
5. **Zero-Trust Security**: All deployments require passing security checks
6. **Automated Maintenance**: Routine tasks run on schedules

**Benefits:**

- **Confidence**: Every merge to main is production-ready
- **Speed**: Automated checks run in parallel for fast feedback
- **Consistency**: Same checks run locally and in CI
- **Transparency**: Clear visibility into build and test status
- **Maintainability**: Automated cleanup and maintenance tasks

### GitHub Actions Overview

All CI/CD workflows run on **GitHub Actions** using:

- **Runner**: Ubuntu latest (ubuntu-latest)
- **Node.js**: Version 20.x
- **Package Manager**: PNPM 9.x
- **Caching**: PNPM cache enabled for faster builds
- **Concurrency**: Multiple jobs run in parallel when possible

**Workflow Execution Times:**

- CI Workflow: ~8-12 minutes (with cache)
- Documentation CI: ~2-3 minutes
- Documentation Validation: ~3-5 minutes
- Planning Cleanup: ~1-2 minutes
- Refresh Search Index: ~1-2 minutes

### Workflow Summary

| Workflow | Trigger | Purpose | Timeout | Secrets Required |
|----------|---------|---------|---------|------------------|
| **CI** | Push/PR to main | Build, test, lint, type check | 30 min | Yes (5) |
| **Docs CI** | Changes to docs/** | Validate documentation quality | 15 min | No |
| **Docs Validation** | Changes to .claude/** | Validate .claude structure | 10 min | No |
| **Planning Cleanup** | Schedule (weekly) | Archive completed planning sessions | 10 min | No |
| **Search Refresh** | Schedule (daily) | Refresh database search indexes | 15 min | Yes (1) |

### Quick Links

**Workflow Files:**

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- [.github/workflows/docs.yml](../../.github/workflows/docs.yml)
- [.github/workflows/validate-docs.yml](../../.github/workflows/validate-docs.yml)
- [.github/workflows/planning-cleanup.yml](../../.github/workflows/planning-cleanup.yml)
- [.github/workflows/refresh-search.yml](../../.github/workflows/refresh-search.yml)

**Related Documentation:**

- [Deployment Overview](./README.md)
- [Environment Setup](./environment-setup.md)
- [Testing Standards](../.claude/docs/standards/testing-standards.md)

---

## Workflow: CI (ci.yml)

### Purpose

The **CI Workflow** is the primary quality gate for all code changes. It ensures that:

- All packages and apps build successfully
- TypeScript code is type-safe across the monorepo
- Code follows established linting rules
- All tests pass with required coverage (90% minimum)
- No regressions are introduced

**This workflow must pass before any PR can be merged to main.**

### Triggers

```yaml
on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
```

**When it runs:**

- **Push to main**: After every direct commit (protected, requires PR)
- **Pull Request**: On every push to a PR targeting main
- **Concurrent runs**: Automatically cancelled for outdated commits

### Job Breakdown

The CI workflow consists of a single job (`test`) with multiple steps that run sequentially:

```mermaid
graph TB
    Start([Trigger: Push/PR to main]) --> Checkout[Checkout Code]
    Checkout --> NodeSetup[Setup Node.js 20]
    NodeSetup --> PNPMSetup[Setup PNPM 9]
    PNPMSetup --> Cache[Restore PNPM Cache]
    Cache --> Install[pnpm install --frozen-lockfile]
    Install --> Build[pnpm build]
    Build --> Typecheck[pnpm typecheck]
    Typecheck --> Lint[pnpm lint]
    Lint --> Test[pnpm test:coverage]
    Test --> Coverage[Check Coverage Threshold]
    Coverage --> Success([✓ CI Passed])
    Coverage --> Failure([✗ CI Failed])

    style Success fill:#d4edda,stroke:#28a745
    style Failure fill:#f8d7da,stroke:#dc3545
```

### Build Process

**Step**: `pnpm build`

**Purpose**: Verify that all packages and applications compile successfully

**What it builds:**

1. **Packages** (in dependency order):
   - `@repo/logger` - Logging utilities
   - `@repo/config` - Configuration management
   - `@repo/utils` - Shared utilities
   - `@repo/schemas` - Zod validation schemas
   - `@repo/db` - Database models and migrations
   - `@repo/service-core` - Business logic services
   - `@repo/payments` - Payment processing
   - `@repo/auth-ui` - Authentication UI components

2. **Applications**:
   - `api` - Hono backend API
   - `web` - Astro + React frontend
   - `admin` - TanStack Start admin dashboard

**Build Tool**: TurboRepo orchestrates builds respecting dependency graph

**Output**: Compiled JavaScript in `dist/` directories

**Failure Scenarios:**

- TypeScript compilation errors
- Missing dependencies
- Build script failures
- Out of memory (large builds)

**Example Success:**

```bash
Tasks:    16 successful, 16 total
Cached:   0 cached, 16 total
Time:     45.3s
```

**Example Failure:**

```bash
apps/api:build: src/routes/bookings.ts(15,3): error TS2322: Type 'string' is not assignable to type 'number'.
apps/api:build: command finished with error
```

### Type Checking

**Step**: `pnpm typecheck`

**Purpose**: Ensure type safety across entire monorepo

**What it checks:**

- All TypeScript files type check correctly
- No `any` types used (strict mode enabled)
- Imports resolve correctly across packages
- Types are correctly inferred from Zod schemas
- Generic types are properly constrained

**Configuration**: Each package has its own `tsconfig.json` extending base configs

**Parallelization**: TurboRepo runs type checks in parallel where possible

**Example Success:**

```bash
@repo/db:typecheck: Found 0 errors
apps/api:typecheck: Found 0 errors
apps/web:typecheck: Found 0 errors
```

**Example Failure:**

```bash
packages/service-core:typecheck: src/services/booking.service.ts(42,5): error TS2345:
Argument of type 'unknown' is not assignable to parameter of type 'string'.
```

**Common Type Errors:**

1. **Missing Types**:
   ```typescript
   // ❌ Bad
   function process(data) { ... }

   // ✓ Good
   function process(data: ProcessInput) { ... }
   ```

2. **Incorrect Inference**:
   ```typescript
   // ❌ Bad - any type
   const schema = z.object({});

   // ✓ Good - inferred type
   const schema = z.object({ id: z.string() });
   type Schema = z.infer<typeof schema>;
   ```

3. **Import Errors**:
   ```typescript
   // ❌ Bad - relative import across packages
   import { User } from '../../../db/models';

   // ✓ Good - package import
   import { User } from '@repo/db';
   ```

### Linting

**Step**: `pnpm lint`

**Purpose**: Enforce code quality and consistency standards

**What it lints:**

- **ESLint**: JavaScript/TypeScript code quality
- **Prettier**: Code formatting (via ESLint integration)
- **TypeScript ESLint**: TypeScript-specific rules

**Rules Enforced:**

1. **No `any` types**: Use `unknown` with type guards
2. **Named exports only**: No default exports
3. **Consistent formatting**: 2 spaces, single quotes, semicolons
4. **Import order**: External → internal → relative
5. **Unused variables**: No unused imports or variables
6. **Complexity limits**: Max cyclomatic complexity 15
7. **File length**: Max 500 lines (excludes tests, docs, JSON)

**Auto-fix**: Many issues can be auto-fixed with `pnpm lint:fix`

**Example Success:**

```bash
✓ @repo/db:lint (347ms)
✓ @repo/service-core:lint (423ms)
✓ apps/api:lint (512ms)
```

**Example Failure:**

```bash
apps/api:lint:
  src/routes/accommodations.ts
    15:7  error  'unusedVar' is defined but never used  @typescript-eslint/no-unused-vars
    23:1  error  Expected named export                  import/no-default-export
```

**Configuration Files:**

- `.eslintrc.js` - Root ESLint config
- `.eslintrc.js` - Package-specific overrides
- `.prettierrc` - Prettier formatting rules
- `.eslintignore` - Files to ignore

### Testing with Coverage

**Step**: `pnpm test:coverage`

**Purpose**: Run all tests and verify minimum coverage requirements

**What it tests:**

1. **Unit Tests**: Individual functions, classes, methods
2. **Integration Tests**: Service interactions, API endpoints
3. **E2E Tests**: Full user workflows (in apps)

**Test Framework**: Vitest (fast, ESM-native, TypeScript-first)

**Coverage Tool**: Vitest coverage (c8/v8 provider)

**Test Pattern**: Test-Driven Development (TDD)

- Red: Write failing test
- Green: Make test pass
- Refactor: Improve code while keeping tests green

**Example Test Output:**

```bash
✓ packages/db/test/models/accommodation.model.test.ts (12 tests) 234ms
✓ packages/service-core/test/services/booking.service.test.ts (25 tests) 456ms
✓ apps/api/test/routes/accommodations.test.ts (18 tests) 387ms

Test Files  47 passed (47)
     Tests  523 passed (523)
  Start at  10:23:45
  Duration  12.34s (transform 2.1s, setup 0.5s, collect 3.2s, tests 6.5s)
```

### Coverage Requirements

**Minimum Coverage**: 90% across all metrics

**Coverage Metrics:**

- **Statements**: 90% minimum
- **Branches**: 90% minimum
- **Functions**: 90% minimum
- **Lines**: 90% minimum

**Coverage Levels:**

1. **Per-Package**: Each package must meet 90% coverage individually
2. **Global Average**: Overall monorepo must meet 90% coverage

**Coverage Report**:

```bash
---------------------|---------|----------|---------|---------|-------------------
File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
---------------------|---------|----------|---------|---------|-------------------
All files            |   92.45 |    91.23 |   93.67 |   92.45 |
 db/models           |   94.12 |    93.45 |   95.23 |   94.12 |
  accommodation.ts   |   95.67 |    94.12 |   96.45 |   95.67 | 45,67,123
  booking.ts         |   93.23 |    92.34 |   94.56 |   93.23 | 78,145
 service-core        |   91.34 |    90.12 |   92.45 |   91.34 |
  booking.service.ts |   92.45 |    91.23 |   93.67 |   92.45 | 234,456
---------------------|---------|----------|---------|---------|-------------------
```

**Failure Scenarios:**

If coverage falls below 90%, the CI fails:

```bash
ERROR: Coverage for statements (89.45%) does not meet global threshold (90%)
ERROR: Coverage for branches (88.23%) does not meet global threshold (90%)
```

**Excluded from Coverage:**

- Test files (`*.test.ts`, `*.spec.ts`)
- Type definition files (`*.d.ts`)
- Migration files (`packages/db/drizzle/*`)
- Build output (`dist/`, `build/`, `.next/`)
- Configuration files

**Coverage Configuration**:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/dist/**',
        '**/drizzle/**',
      ],
    },
  },
});
```

### Required Secrets

The CI workflow requires the following secrets to be configured in GitHub:

| Secret Name | Purpose | Example Value |
|-------------|---------|---------------|
| `HOSPEDA_DATABASE_URL` | PostgreSQL connection for tests | `postgresql://user:pass@localhost:5432/test` |
| `HOSPEDA_CLERK_SECRET_KEY` | Clerk authentication (backend) | `YOUR_TEST_SECRET_HERE` |
| `HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication (frontend) | `YOUR_TEST_PUBLISHABLE_HERE` |
| `HOSPEDA_API_URL` | API endpoint for tests | `http://localhost:3000` |
| `HOSPEDA_SITE_URL` | Frontend URL for tests | `http://localhost:4321` |

**Setting Secrets**: See [Secrets Management](#secrets-management) section

### Troubleshooting Common Failures

#### Build Failures

**Symptom**: `pnpm build` fails with compilation errors

**Common Causes:**

1. **TypeScript Errors**:
   ```bash
   Error: src/models/user.ts(15,3): error TS2322
   ```
   **Solution**: Fix TypeScript errors locally first (`pnpm typecheck`)

2. **Missing Dependencies**:
   ```bash
   Error: Cannot find module '@repo/schemas'
   ```
   **Solution**: Ensure dependencies are declared in `package.json`

3. **Build Order Issues**:
   ```bash
   Error: Package @repo/db not built
   ```
   **Solution**: TurboRepo should handle this; check `turbo.json` dependencies

#### Test Failures

**Symptom**: Tests fail or coverage is below 90%

**Common Causes:**

1. **Failing Tests**:
   ```bash
   ✗ should create booking (245ms)
   Expected: 201
   Received: 400
   ```
   **Solution**: Run tests locally (`pnpm test`), fix failing tests

2. **Coverage Below Threshold**:
   ```bash
   ERROR: Coverage for statements (89.45%) does not meet threshold (90%)
   ```
   **Solution**: Add tests for uncovered code paths

3. **Flaky Tests**:
   ```bash
   ✗ should handle concurrent requests
   Timeout of 5000ms exceeded
   ```
   **Solution**: Increase timeout, fix race conditions, use proper test isolation

#### Lint Failures

**Symptom**: `pnpm lint` fails with rule violations

**Common Causes:**

1. **Unused Variables**:
   ```bash
   error: 'userId' is defined but never used
   ```
   **Solution**: Remove unused variables or prefix with `_` if intentional

2. **Formatting Issues**:
   ```bash
   error: Delete `␍` (prettier/prettier)
   ```
   **Solution**: Run `pnpm lint:fix` to auto-format

3. **Import Order**:
   ```bash
   error: Import order is incorrect
   ```
   **Solution**: Run `pnpm lint:fix` to auto-sort imports

#### Environment Issues

**Symptom**: Tests fail due to missing environment variables

**Common Causes:**

1. **Missing Secrets**:
   ```bash
   Error: HOSPEDA_DATABASE_URL is not defined
   ```
   **Solution**: Ensure all required secrets are configured in GitHub

2. **Database Connection**:
   ```bash
   Error: connect ECONNREFUSED 127.0.0.1:5432
   ```
   **Solution**: CI uses in-memory database; ensure tests don't require real DB

### Local Pre-flight Checks

Before pushing, run these commands locally to catch issues early:

```bash
# Full CI simulation
pnpm build
pnpm typecheck
pnpm lint
pnpm test:coverage

# Or use the shorthand
pnpm ci
```

**Expected Duration**: ~5-8 minutes locally (with warm cache)

---

## Workflow: Documentation CI (docs.yml)

### Purpose

The **Documentation CI Workflow** ensures that all project documentation maintains high quality standards:

- Markdown files are properly formatted
- Internal links are valid and not broken
- Code examples in documentation compile and run
- Documentation follows style guidelines

**This workflow runs only when documentation files change.**

### Triggers

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'
      - '.github/workflows/docs.yml'
  pull_request:
    branches:
      - main
    paths:
      - 'docs/**'
      - '.github/workflows/docs.yml'
```

**When it runs:**

- **Push to main**: Only if files in `docs/` directory changed
- **Pull Request**: Only if PR includes changes to `docs/`
- **Workflow changes**: Runs if the workflow file itself changes

**Path filtering benefits:**

- Faster CI for non-documentation changes
- Focused validation on relevant files
- Reduced GitHub Actions minutes usage

### Job: Validate Documentation

```mermaid
graph TB
    Start([Trigger: docs/** changed]) --> Checkout[Checkout Code]
    Checkout --> NodeSetup[Setup Node.js 20]
    NodeSetup --> PNPMSetup[Setup PNPM 9]
    PNPMSetup --> Install[pnpm install]
    Install --> LintMd[Lint Markdown]
    LintMd --> CheckLinks[Check Internal Links]
    CheckLinks --> ValidateExamples[Validate TypeScript Examples]
    ValidateExamples --> Success([✓ Docs Valid])

    LintMd --> Failure([✗ Validation Failed])
    CheckLinks --> Failure
    ValidateExamples --> Failure

    style Success fill:#d4edda,stroke:#28a745
    style Failure fill:#f8d7da,stroke:#dc3545
```

### Markdown Linting

**Step**: `pnpm run lint:md:docs`

**Purpose**: Ensure consistent Markdown formatting across all documentation

**What it checks:**

1. **Heading Structure**:
   - No skipped heading levels (h1 → h3)
   - No duplicate headings at same level
   - No trailing punctuation in headings

2. **Code Blocks**:
   - All code blocks have language specified
   - Proper fencing (```)
   - No unclosed code blocks

3. **Lists**:
   - Consistent indentation (2 spaces)
   - Proper marker style (-, *, 1.)
   - Blank lines around lists

4. **Links**:
   - Valid link syntax
   - No empty links
   - Proper relative/absolute paths

5. **Formatting**:
   - Blank lines around headings
   - Blank lines around code blocks
   - Blank lines around tables
   - No trailing whitespace

**Linter**: markdownlint-cli2

**Configuration**: `.markdownlint.json`

**Example Success:**

```bash
✓ docs/README.md
✓ docs/deployment/README.md
✓ docs/development/getting-started.md

Linted 23 files successfully
```

**Example Failure:**

```bash
docs/deployment/vercel.md:15:1 MD022/blanks-around-headings
  Headings should be surrounded by blank lines
docs/deployment/vercel.md:42:80 MD013/line-length
  Line length exceeds 120 characters
docs/deployment/vercel.md:67:1 MD040/fenced-code-language
  Code block should have language specified
```

**Auto-fix**: Run `pnpm format:md:docs` locally to auto-fix most issues

### Link Checking

**Step**: `pnpm run docs:check-links`

**Purpose**: Verify all internal links resolve correctly

**What it checks:**

- Links to other documentation files
- Links to code files
- Anchor links to headings
- Relative vs absolute paths

**Tool**: Custom script using markdown-link-check

**Scope**: Only internal links (external links not checked in CI)

**Example Success:**

```bash
Checking docs/README.md
  ✓ [Quick Start](./development/quick-start.md)
  ✓ [CI/CD](./deployment/ci-cd.md)
  ✓ [Architecture](../.claude/docs/standards/architecture-patterns.md)

Checked 145 links, 0 broken
```

**Example Failure:**

```bash
Checking docs/deployment/vercel.md
  ✗ [Environment Setup](./environment-setup.md) → 404 Not Found
  ✗ [#database-configuration] → Anchor not found

Found 2 broken links
```

**Common Issues:**

1. **Case Sensitivity**:
   ```markdown
   ❌ [Link](./Environment-Setup.md)  # File is environment-setup.md
   ✓ [Link](./environment-setup.md)
   ```

2. **Wrong Path**:
   ```markdown
   ❌ [Link](../deployment/vercel.md)  # Should be ./vercel.md
   ✓ [Link](./vercel.md)
   ```

3. **Missing Anchor**:
   ```markdown
   ❌ [Section](#non-existent-section)
   ✓ [Section](#existing-section)
   ```

### TypeScript Example Validation

**Step**: `pnpm run docs:validate-examples`

**Purpose**: Ensure code examples in documentation are valid TypeScript

**What it validates:**

1. **Syntax**: Code blocks with `typescript` or `ts` language compile
2. **Types**: Type annotations are correct
3. **Imports**: Import statements resolve correctly
4. **Examples**: Standalone examples are runnable

**Process**:

1. Extract TypeScript code blocks from Markdown
2. Wrap in appropriate context (imports, types)
3. Type-check with `tsc --noEmit`
4. Report compilation errors

**Example Success:**

```bash
Validating examples in docs/development/getting-started.md
  ✓ Example 1: Creating a service (line 45)
  ✓ Example 2: API route (line 120)
  ✓ Example 3: Database query (line 203)

Validated 23 examples, 0 errors
```

**Example Failure:**

```bash
Validating examples in docs/development/getting-started.md
  ✗ Example 2: API route (line 120)
    Type 'string' is not assignable to type 'number'

    export const route = createRoute({
      handler: async (c) => {
        return c.json({ id: "123" });  // Should be number
                             ^^^^
      }
    });
```

**Excluded Examples**:

- Examples marked with `// @skip-validation`
- Pseudo-code examples
- Examples with `...` placeholders

### Troubleshooting

#### Markdown Lint Failures

**Issue**: Heading structure violations

```bash
MD022/blanks-around-headings: Headings should be surrounded by blank lines
```

**Solution**:

```markdown
❌ Bad:
## Heading
Content starts immediately

✓ Good:
## Heading

Content has blank line above
```

**Issue**: Code blocks without language

```bash
MD040/fenced-code-language: Code block should have language specified
```

**Solution**:

```markdown
❌ Bad:
```
const x = 123;
```

✓ Good:
```typescript
const x = 123;
```
```

#### Link Check Failures

**Issue**: Broken internal links

**Solution**: Update link path to match actual file location

**Issue**: Broken anchor links

**Solution**: Ensure heading exists and anchor matches (lowercase, hyphens)

```markdown
# Database Configuration  →  #database-configuration
```

#### Example Validation Failures

**Issue**: Import errors in examples

**Solution**: Add necessary imports or use relative imports

```typescript
// ❌ Bad
const service = new AccommodationService();

// ✓ Good
import { AccommodationService } from '@repo/service-core';
const service = new AccommodationService();
```

**Issue**: Type errors in examples

**Solution**: Ensure examples use correct types from actual codebase

---

## Workflow: Documentation Validation (validate-docs.yml)

### Purpose

The **Documentation Validation Workflow** ensures the `.claude/` documentation system maintains structural integrity:

- Directory structure follows conventions
- Required files exist
- File counts match expectations (15 agents, 23 commands, 19 skills)
- JSON schemas are valid
- No broken links
- Health checks pass

**This workflow runs when .claude/ documentation changes.**

### Triggers

```yaml
on:
  push:
    branches:
      - main
    paths:
      - '.claude/**'
      - 'CLAUDE.md'
      - '.github/workflows/validate-docs.yml'
  pull_request:
    branches:
      - main
    paths:
      - '.claude/**'
      - 'CLAUDE.md'
      - '.github/workflows/validate-docs.yml'
```

**When it runs:**

- **Push to main**: When `.claude/` files or `CLAUDE.md` change
- **Pull Request**: When PR includes changes to documentation system
- **Workflow changes**: When the workflow file itself changes

### Job: Validate Structure

```mermaid
graph TB
    Start([Trigger: .claude/** changed]) --> Checkout[Checkout Code]
    Checkout --> NodeSetup[Setup Node.js 20]
    NodeSetup --> PNPMSetup[Setup PNPM 9]
    PNPMSetup --> Install[pnpm install]
    Install --> ValidateStructure[Validate Directory Structure]
    ValidateStructure --> ValidateSchemas[Validate JSON Schemas]
    ValidateSchemas --> HealthCheck[Run Health Check]
    HealthCheck --> LintMd[Lint .claude/ Markdown]
    LintMd --> CheckLinks[Check Broken Links]
    CheckLinks --> ValidateCounts[Validate File Counts]
    ValidateCounts --> Success([✓ Structure Valid])

    ValidateStructure --> Failure([✗ Validation Failed])
    ValidateSchemas --> Failure
    HealthCheck --> Failure
    LintMd --> Failure
    CheckLinks --> Failure
    ValidateCounts --> Failure

    style Success fill:#d4edda,stroke:#28a745
    style Failure fill:#f8d7da,stroke:#dc3545
```

### Structure Validation

**Step**: `pnpm run validate:structure`

**Purpose**: Ensure `.claude/` directory structure is correct

**Required Structure**:

```
.claude/
├── agents/                 # 15 agent definitions (must have exactly 15)
│   ├── README.md
│   └── *.md
├── commands/               # 23 command definitions (must have exactly 23)
│   ├── README.md
│   └── *.md
├── skills/                 # 19 skill definitions (must have exactly 19)
│   ├── README.md
│   └── *.md
├── docs/
│   ├── diagrams/           # Mermaid diagrams
│   ├── learnings/          # Documented learnings
│   ├── standards/          # Code and architecture standards
│   ├── templates/          # Document templates
│   └── workflows/          # Workflow guides
├── sessions/
│   └── planning/           # Planning sessions (P-XXX)
└── schemas/                # JSON schemas for validation
```

**Checks**:

1. All required directories exist
2. All required README.md files exist
3. No unexpected files in root directories
4. Proper naming conventions (kebab-case)

**Example Success**:

```bash
✓ All required directories present
✓ All README.md files present
✓ Naming conventions followed
✓ No unexpected files found

Structure validation passed
```

**Example Failure**:

```bash
✗ Missing directory: .claude/docs/diagrams
✗ Missing file: .claude/agents/README.md
✗ Invalid filename: .claude/commands/Add_Entity.md (should be add-entity.md)

Structure validation failed
```

### JSON Schema Validation

**Step**: `pnpm run validate:schemas`

**Purpose**: Ensure all JSON schemas are valid and consistent

**Schemas Validated**:

- Agent definition schema
- Command definition schema
- Skill definition schema
- Planning session schema
- Workflow schema

**Validation Rules**:

1. **Valid JSON**: All schema files parse correctly
2. **JSON Schema v7**: Schemas follow JSON Schema specification
3. **Required Fields**: All mandatory fields present
4. **Type Consistency**: Types are correctly defined
5. **References**: Schema references resolve correctly

**Example Success**:

```bash
✓ .claude/schemas/agent-schema.json
✓ .claude/schemas/command-schema.json
✓ .claude/schemas/skill-schema.json

All schemas valid
```

**Example Failure**:

```bash
✗ .claude/schemas/agent-schema.json
  Line 15: Unexpected token } in JSON

✗ .claude/schemas/command-schema.json
  Missing required field: "properties"

Schema validation failed
```

### Health Check

**Step**: `pnpm health-check`

**Purpose**: Run comprehensive system health checks

**Checks Performed**:

1. **File Counts**:
   - Exactly 15 agents
   - Exactly 23 commands
   - Exactly 19 skills

2. **Cross-references**:
   - All agent references in docs exist
   - All command references in docs exist
   - All skill references in docs exist

3. **Completeness**:
   - All agents have descriptions
   - All commands have examples
   - All skills have use cases

4. **Consistency**:
   - Agent names match file names
   - Command names match file names
   - Skill names match file names

**Example Success**:

```bash
Health Check Results:
✓ File counts: 15 agents, 23 commands, 19 skills
✓ Cross-references: All valid
✓ Completeness: All required fields present
✓ Consistency: All names match

Health check passed
```

**Example Failure**:

```bash
Health Check Results:
✗ File counts: 14 agents (expected 15), 23 commands, 19 skills
✗ Cross-references: Reference to 'security-specialist' not found
✗ Completeness: Agent 'tech-lead' missing description
✗ Consistency: Command file 'add-entity.md' name doesn't match command 'add-new-entity'

Health check failed
```

### Markdown Linting

**Step**: `pnpm run lint:md:claude`

**Purpose**: Ensure `.claude/` Markdown files follow formatting standards

**Same rules as Documentation CI** (see above), but scoped to `.claude/` directory only

**Additional Checks for .claude/**:

- Frontmatter in agent/command/skill definitions
- Proper template structure
- Required sections present

### Link Checking

**Step**: Check for broken links in `.claude/` documentation

**Scope**: Internal links within `.claude/` and to project files

**Example**:

```bash
Checking .claude/agents/README.md
  ✓ [tech-lead](./tech-lead.md)
  ✓ [Commands](../commands/README.md)
  ✗ [Non-existent](./security-specialist.md) → 404

Found 1 broken link
```

### File Count Validation

**Step**: `pnpm run validate:counts`

**Purpose**: Ensure expected number of tools exist

**Expected Counts**:

| Category | Count | Why This Number? |
|----------|-------|------------------|
| Agents | 15 | Consolidated from 20 (merged security, performance into tech-lead) |
| Commands | 23 | Complete set of planning, quality, review, development, git commands |
| Skills | 19 | Testing (6), Development (5), Design (3), Utils (2), Audit (3) |

**Validation**:

```bash
Validating file counts...
✓ Agents: 15/15
✓ Commands: 23/23
✓ Skills: 19/19

File count validation passed
```

**If counts mismatch**:

```bash
Validating file counts...
✗ Agents: 14/15 (missing 1)
  Expected: 15
  Found: 14
  Missing: security-specialist

File count validation failed
```

**When to update counts**: If you intentionally add/remove agents, commands, or skills, update the expected counts in the workflow.

### Troubleshooting

#### Structure Validation Failures

**Issue**: Missing directories

**Solution**: Create missing directories following the required structure

**Issue**: Invalid filenames

**Solution**: Rename files to kebab-case (e.g., `Add_Entity.md` → `add-entity.md`)

#### Schema Validation Failures

**Issue**: JSON syntax errors

**Solution**: Validate JSON with a linter before committing

**Issue**: Missing required fields

**Solution**: Add required fields per JSON Schema specification

#### Health Check Failures

**Issue**: Incorrect file counts

**Solution**: Add missing files or remove extras to match expected counts

**Issue**: Broken cross-references

**Solution**: Update references to match actual file names

#### Link Check Failures

**Issue**: Broken links to moved files

**Solution**: Update links after moving/renaming files

**Issue**: Links to deleted files

**Solution**: Remove links or restore deleted files if needed

---

## Workflow: Planning Cleanup (planning-cleanup.yml)

### Purpose

The **Planning Cleanup Workflow** automatically archives completed planning sessions to keep the active planning directory clean and organized:

- Moves completed sessions from `.claude/sessions/planning/` to `archived/YYYY/MM/`
- Generates completion reports
- Maintains planning directory hygiene
- Runs on a weekly schedule

**This workflow helps prevent planning session clutter.**

### Triggers

```yaml
on:
  schedule:
    - cron: '0 0 * * 1'  # Every Monday at 00:00 UTC
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run (no actual changes)'
        required: false
        default: 'false'
        type: boolean
```

**When it runs:**

- **Scheduled**: Every Monday at midnight UTC (automatic)
- **Manual**: Via GitHub Actions UI (with optional dry-run)

### Job: Cleanup Sessions

```mermaid
graph TB
    Start([Trigger: Schedule/Manual]) --> Checkout[Checkout Code]
    Checkout --> NodeSetup[Setup Node.js 20]
    NodeSetup --> PNPMSetup[Setup PNPM 9]
    PNPMSetup --> Install[pnpm install]
    Install --> Scan[Scan for Completed Sessions]
    Scan --> HasCompleted{Has Completed?}
    HasCompleted -->|Yes| Move[Move to archived/YYYY/MM/]
    HasCompleted -->|No| Skip[Skip - No Sessions]
    Move --> Report[Generate COMPLETION-REPORT.md]
    Report --> DryRun{Dry Run?}
    DryRun -->|Yes| ShowChanges[Show Changes Only]
    DryRun -->|No| Commit[Commit and Push]
    ShowChanges --> Success([✓ Dry Run Complete])
    Commit --> Success([✓ Cleanup Complete])
    Skip --> Success

    style Success fill:#d4edda,stroke:#28a745
```

### Scheduled Execution

**Schedule**: Every Monday at 00:00 UTC

**Cron Expression**: `0 0 * * 1`

- `0` - Minute (00)
- `0` - Hour (00 UTC)
- `*` - Any day of month
- `*` - Any month
- `1` - Monday (1 = Monday, 0 = Sunday)

**Time Conversions**:

- 00:00 UTC = 21:00 EST (Sunday)
- 00:00 UTC = 21:00 ART (Sunday, Argentina)

**Why Monday**: Start each week with clean planning directory

### Manual Execution

**Trigger Manually**:

1. Go to **Actions** tab in GitHub
2. Select **Planning Cleanup** workflow
3. Click **Run workflow**
4. Choose options:
   - **Branch**: main
   - **Dry run**: Check to preview without changes

**Dry Run Mode**:

When enabled:

- Scans for completed sessions
- Shows which sessions would be archived
- Generates preview of changes
- **Does NOT commit or push changes**

**Use Cases**:

- Preview cleanup before scheduled run
- Test new cleanup logic
- Manually archive sessions mid-week

### Archive Process

**Step 1: Scan for Completed Sessions**

```bash
pnpm planning:cleanup:scan
```

**Criteria for "Completed"**:

A session is considered completed if it has a `COMPLETION-REPORT.md` file:

```
.claude/sessions/planning/
└── P-035-deployment-documentation/
    ├── PDR.md
    ├── tech-analysis.md
    ├── TODOs.md
    └── COMPLETION-REPORT.md  ← Indicates completion
```

**Step 2: Determine Archive Location**

Sessions are archived by completion date:

```
.claude/sessions/planning/archived/
└── 2024/
    └── 01/
        ├── P-001-initial-setup/
        ├── P-002-authentication/
        └── P-003-booking-system/
```

**Archive Path Format**: `archived/YYYY/MM/P-XXX-session-name/`

**Step 3: Move Session**

```bash
# From
.claude/sessions/planning/P-035-deployment-documentation/

# To
.claude/sessions/planning/archived/2024/01/P-035-deployment-documentation/
```

**Files Moved**:

- All session files (PDR, tech-analysis, TODOs)
- COMPLETION-REPORT.md
- Any additional documentation
- Subdirectories if present

**Step 4: Generate Archive Report**

Creates or updates `.claude/sessions/planning/archived/2024/01/README.md`:

```markdown
# Archived Planning Sessions - January 2024

Sessions archived in January 2024.

## P-035: Deployment Documentation

**Archived**: 2024-01-15
**Status**: Completed
**Summary**: CI/CD documentation created

[View Session](./P-035-deployment-documentation/)

---

*Total Sessions: 3*
*Last Updated: 2024-01-15*
```

### Auto-Commit Behavior

**If sessions are archived** (and not dry-run):

1. **Stage Changes**:
   ```bash
   git add .claude/sessions/planning/
   ```

2. **Commit**:
   ```bash
   git commit -m "chore(planning): archive completed sessions"
   ```

3. **Push**:
   ```bash
   git push origin main
   ```

**Commit Message Format**:

```
chore(planning): archive completed sessions

- Archived P-035-deployment-documentation
- Archived P-036-testing-improvements

Automated cleanup run: 2024-01-15
```

**GitHub Actions Bot**: Commits are made by `github-actions[bot]`

### Manual Cleanup Commands

**Scan for Completed Sessions**:

```bash
pnpm planning:cleanup:scan
```

**Output**:

```bash
Found 2 completed sessions:
- P-035-deployment-documentation (completed 2024-01-12)
- P-036-testing-improvements (completed 2024-01-14)
```

**Archive Specific Session**:

```bash
pnpm planning:cleanup:archive P-035-deployment-documentation
```

**Archive All Completed Sessions**:

```bash
pnpm planning:cleanup:auto
```

**Dry Run**:

```bash
pnpm planning:cleanup:auto --dry-run
```

**Restore Archived Session**:

```bash
pnpm planning:cleanup:restore P-035-deployment-documentation
```

Moves session back to active planning directory.

### Troubleshooting

#### No Sessions Archived

**Issue**: Workflow runs but archives nothing

**Possible Causes**:

1. No completed sessions (missing COMPLETION-REPORT.md)
2. Sessions already archived
3. Incorrect completion date

**Solution**: Manually check for `COMPLETION-REPORT.md` files

#### Git Push Failures

**Issue**: Workflow fails to push changes

**Possible Causes**:

1. Branch protection rules
2. Insufficient permissions
3. Merge conflicts

**Solution**: Check GitHub Actions permissions in repository settings

#### Wrong Archive Date

**Issue**: Session archived in wrong month/year

**Cause**: Archive date based on COMPLETION-REPORT.md date, not current date

**Solution**: Ensure COMPLETION-REPORT.md has correct completion date

---

## Workflow: Refresh Search Index (refresh-search.yml)

### Purpose

The **Refresh Search Index Workflow** maintains database search performance by refreshing materialized views:

- Refreshes PostgreSQL materialized views for full-text search
- Runs daily to keep search indexes up-to-date
- Can be triggered manually for immediate refresh
- Ensures search results reflect latest data

**This workflow is critical for search performance.**

### Triggers

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 02:00 UTC
  workflow_dispatch:
```

**When it runs:**

- **Scheduled**: Every day at 02:00 UTC (automatic)
- **Manual**: Via GitHub Actions UI (any time)

**Why 02:00 UTC**:

- Low traffic time (9PM EST, 11PM ART)
- Minimizes impact on active users
- Allows time for overnight data changes to accumulate

### Job: Refresh Indexes

```mermaid
graph TB
    Start([Trigger: Schedule/Manual]) --> Checkout[Checkout Code]
    Checkout --> NodeSetup[Setup Node.js 20]
    NodeSetup --> PNPMSetup[Setup PNPM 9]
    PNPMSetup --> Install[pnpm install]
    Install --> Refresh[Run Refresh Script]
    Refresh --> Success([✓ Indexes Refreshed])
    Refresh --> Failure([✗ Refresh Failed])

    style Success fill:#d4edda,stroke:#28a745
    style Failure fill:#f8d7da,stroke:#dc3545
```

### Materialized View Refresh

**Step**: `node packages/db/scripts/refresh-search-view.mjs`

**Purpose**: Refresh materialized views used for full-text search

**What Gets Refreshed**:

1. **Accommodation Search View**:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY accommodation_search_view;
   ```
   - Full-text search vectors (title, description, amenities)
   - Pre-computed search rankings
   - Location-based search data

2. **Booking Search View**:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY booking_search_view;
   ```
   - Booking status aggregations
   - Date range indexes
   - User-booking relationships

3. **Review Search View**:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY review_search_view;
   ```
   - Review full-text search
   - Rating aggregations
   - Sentiment analysis data

**Refresh Method**: `CONCURRENTLY`

- Allows concurrent reads during refresh
- Requires unique index on view
- Slower than non-concurrent refresh
- Recommended for production

**Duration**: ~2-5 minutes depending on data volume

### Database Requirements

**PostgreSQL Version**: 12 or higher (for `REFRESH MATERIALIZED VIEW CONCURRENTLY`)

**Required Extensions**:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Trigram matching
CREATE EXTENSION IF NOT EXISTS unaccent; -- Accent removal
```

**Materialized Views Must Have**:

- **Unique Index**: Required for concurrent refresh
- **Complete Clause**: View definition must be deterministic

**Example View Definition**:

```sql
CREATE MATERIALIZED VIEW accommodation_search_view AS
SELECT
  a.id,
  a.title,
  a.description,
  setweight(to_tsvector('spanish', a.title), 'A') ||
  setweight(to_tsvector('spanish', a.description), 'B') as search_vector
FROM accommodations a
WHERE a.status = 'active';

CREATE UNIQUE INDEX accommodation_search_view_id_idx ON accommodation_search_view(id);
```

### Manual Triggering

**When to Manually Trigger**:

1. After bulk data imports
2. After major content updates
3. When search results seem stale
4. During debugging/testing

**Steps**:

1. Go to **Actions** tab in GitHub
2. Select **Refresh Search Index** workflow
3. Click **Run workflow**
4. Choose branch (usually `main`)
5. Click **Run workflow** button

**Local Execution**:

```bash
# From project root
node packages/db/scripts/refresh-search-view.mjs
```

**Required Environment**:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/database
```

### Refresh Script Details

**Script**: `packages/db/scripts/refresh-search-view.mjs`

**Process**:

1. **Connect to Database**:
   ```typescript
   const client = new Client({ connectionString: process.env.DATABASE_URL });
   await client.connect();
   ```

2. **Refresh Each View**:
   ```typescript
   await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY accommodation_search_view');
   await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY booking_search_view');
   await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY review_search_view');
   ```

3. **Log Results**:
   ```typescript
   console.log('✓ Refreshed accommodation_search_view');
   console.log('✓ Refreshed booking_search_view');
   console.log('✓ Refreshed review_search_view');
   ```

4. **Disconnect**:
   ```typescript
   await client.end();
   ```

**Output**:

```bash
Connecting to database...
Refreshing materialized views...
✓ Refreshed accommodation_search_view (142,345 rows, 2.3s)
✓ Refreshed booking_search_view (89,234 rows, 1.7s)
✓ Refreshed review_search_view (23,456 rows, 0.8s)

Total time: 4.8s
All materialized views refreshed successfully
```

### Troubleshooting

#### Connection Failures

**Issue**: Cannot connect to database

```bash
Error: connect ECONNREFUSED
```

**Solutions**:

1. **Check DATABASE_URL secret**: Ensure it's correctly configured
2. **Database availability**: Verify database is running
3. **Network access**: Check firewall/security group rules
4. **Credentials**: Verify username/password are correct

#### Refresh Failures

**Issue**: Refresh command fails

```bash
ERROR: could not create unique index "accommodation_search_view_id_idx"
DETAIL: Key (id)=(123) is duplicated
```

**Solutions**:

1. **Duplicate IDs**: Fix duplicate IDs in base tables
2. **Non-deterministic view**: Ensure view definition is deterministic
3. **Missing unique index**: Create unique index on view

**Issue**: Permission denied

```bash
ERROR: permission denied for relation accommodation_search_view
```

**Solutions**:

1. **Database user permissions**: Grant REFRESH permission
   ```sql
   GRANT ALL ON accommodation_search_view TO app_user;
   ```

#### Performance Issues

**Issue**: Refresh takes too long

**Solutions**:

1. **Add indexes**: Ensure base tables have proper indexes
2. **Partitioning**: Consider partitioning large tables
3. **Incremental updates**: Use triggers for real-time updates instead
4. **Increase resources**: Allocate more database resources

**Issue**: High database load during refresh

**Solutions**:

1. **Schedule at low-traffic time**: Already scheduled at 02:00 UTC
2. **Use CONCURRENTLY**: Already implemented
3. **Batch refreshes**: Refresh one view at a time if needed

---

## Secrets Management

### Required Secrets

All secrets must be configured in **GitHub Repository Settings → Secrets and Variables → Actions**.

#### Production Secrets

| Secret Name | Purpose | Example Value | Used By |
|-------------|---------|---------------|---------|
| `HOSPEDA_DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` | CI, Search Refresh |
| `HOSPEDA_CLERK_SECRET_KEY` | Clerk backend auth | `YOUR_SECRET_KEY_HERE` | CI |
| `HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend auth | `YOUR_PUBLISHABLE_KEY_HERE` | CI |
| `HOSPEDA_API_URL` | API endpoint | `https://api.hospeda.com` | CI |
| `HOSPEDA_SITE_URL` | Frontend URL | `https://hospeda.com` | CI |

#### Development Secrets

| Secret Name | Purpose | Example Value | Used By |
|-------------|---------|---------------|---------|
| `HOSPEDA_DEV_DATABASE_URL` | Dev database | `postgresql://dev:pass@localhost:5432/hospeda_dev` | Dev workflows |

### Setting Secrets in GitHub

**Steps**:

1. Navigate to repository on GitHub
2. Click **Settings** tab
3. In left sidebar, click **Secrets and Variables** → **Actions**
4. Click **New repository secret**
5. Enter secret name (e.g., `HOSPEDA_DATABASE_URL`)
6. Enter secret value
7. Click **Add secret**

**Screenshot Path**: Settings → Secrets and Variables → Actions → New repository secret

### Secret Rotation Procedures

**When to Rotate**:

- Every 90 days (recommended)
- When employee leaves with access
- After suspected compromise
- During security audits

**Rotation Steps**:

1. **Generate new secret** (Clerk, database, etc.)
2. **Update GitHub secret** with new value
3. **Deploy applications** with new secret
4. **Verify functionality** in production
5. **Revoke old secret** after 24-48 hours

**Zero-Downtime Rotation**:

For critical secrets like database URLs:

1. Create new database user/password
2. Grant same permissions
3. Update secret in GitHub
4. Deploy new configuration
5. Remove old user after verification

### Environment-Specific Secrets

**Production** (main branch):

```
HOSPEDA_DATABASE_URL          # Production DB
HOSPEDA_CLERK_SECRET_KEY      # Production Clerk
HOSPEDA_API_URL               # https://api.hospeda.com
HOSPEDA_SITE_URL              # https://hospeda.com
```

**Staging** (staging branch):

```
HOSPEDA_DEV_DATABASE_URL      # Staging DB
HOSPEDA_DEV_CLERK_SECRET_KEY  # Staging Clerk
HOSPEDA_DEV_API_URL           # https://staging-api.hospeda.com
HOSPEDA_DEV_SITE_URL          # https://staging.hospeda.com
```

**Development** (local):

Use `.env.local` file (never commit to git):

```bash
DATABASE_URL=postgresql://localhost:5432/hospeda_dev
CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE
CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE
API_URL=http://localhost:3000
SITE_URL=http://localhost:4321
```

### Security Best Practices

**DO**:

- ✅ Use separate secrets for dev/staging/production
- ✅ Rotate secrets regularly (90 days)
- ✅ Use strong, random secrets
- ✅ Limit secret access to necessary people
- ✅ Audit secret usage in workflow logs
- ✅ Use secret scanning tools

**DON'T**:

- ❌ Commit secrets to git (use .gitignore)
- ❌ Share secrets via email/chat
- ❌ Log secret values in workflows
- ❌ Use same secrets across environments
- ❌ Store secrets in plaintext files
- ❌ Grant broad access to secrets

### Secret Scanning

**GitHub Secret Scanning**: Automatically enabled for all repositories

**Detection**:

- Scans all commits for known secret patterns
- Alerts on exposed secrets
- Blocks pushes with secrets (if enabled)

**Common Patterns Detected**:

- API keys (AWS, Google Cloud, etc.)
- Database connection strings
- OAuth tokens
- Private keys
- Passwords

**If Secret Exposed**:

1. **Immediately rotate** the exposed secret
2. **Revoke access** for the old secret
3. **Update GitHub secret** with new value
4. **Deploy new configuration**
5. **Review access logs** for unauthorized usage

### Accessing Secrets in Workflows

**Syntax**:

```yaml
env:
  DATABASE_URL: ${{ secrets.HOSPEDA_DATABASE_URL }}
  CLERK_SECRET_KEY: ${{ secrets.HOSPEDA_CLERK_SECRET_KEY }}
```

**Never Log Secrets**:

```yaml
# ❌ Bad - logs secret value
- run: echo "Database URL: ${{ secrets.HOSPEDA_DATABASE_URL }}"

# ✓ Good - doesn't log secret
- run: echo "Connecting to database..."
  env:
    DATABASE_URL: ${{ secrets.HOSPEDA_DATABASE_URL }}
```

**Masking**: GitHub Actions automatically masks secret values in logs

---

## Local Development

### Running Workflows Locally with Act

**Act** is a tool to run GitHub Actions workflows locally.

**Installation**:

```bash
# macOS
brew install act

# Linux
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Windows (WSL)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | bash
```

**Basic Usage**:

```bash
# List available workflows
act -l

# Run CI workflow
act -j test

# Run with secrets
act -j test --secret-file .env.local

# Dry run (show what would run)
act -j test --dryrun
```

**Create Secrets File**:

```bash
# .env.local
HOSPEDA_DATABASE_URL=postgresql://localhost:5432/hospeda_dev
HOSPEDA_CLERK_SECRET_KEY=YOUR_TEST_SECRET_HERE
HOSPEDA_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_TEST_PUBLISHABLE_HERE
HOSPEDA_API_URL=http://localhost:3000
HOSPEDA_SITE_URL=http://localhost:4321
```

**Run Specific Workflow**:

```bash
act -W .github/workflows/ci.yml
```

**Limitations**:

- May not perfectly replicate GitHub Actions environment
- Some actions may not work locally
- Uses Docker containers (requires Docker installed)

### Testing Before Push

**Pre-push Checklist**:

```bash
# 1. Build all packages
pnpm build

# 2. Type check
pnpm typecheck

# 3. Lint code
pnpm lint

# 4. Run tests with coverage
pnpm test:coverage

# 5. Check coverage threshold
# (Automatically checked in test:coverage)

# 6. Lint markdown (if docs changed)
pnpm lint:md

# 7. Format markdown (if docs changed)
pnpm format:md
```

**Or use the combined command**:

```bash
pnpm ci
```

This runs all quality checks in sequence.

### Pre-commit Hooks

**Husky** is configured to run checks before commits.

**Installation** (automatic on `pnpm install`):

```bash
pnpm prepare
```

**Pre-commit Hook** (`.husky/pre-commit`):

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run lint-staged
pnpm lint-staged
```

**Lint-staged Configuration** (`package.json`):

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.md": [
      "markdownlint-cli2 --fix"
    ]
  }
}
```

**What Runs**:

1. **TypeScript/TSX files**: ESLint + Prettier
2. **Markdown files**: Markdownlint

**Bypass Pre-commit** (not recommended):

```bash
git commit --no-verify -m "message"
```

### Manual Quality Checks

**Individual Checks**:

```bash
# Type checking (per package)
cd packages/db && pnpm typecheck
cd apps/api && pnpm typecheck

# Linting (per package)
cd packages/service-core && pnpm lint
cd apps/web && pnpm lint

# Testing (per package)
cd packages/db && pnpm test
cd apps/api && pnpm test:coverage

# Markdown linting
pnpm lint:md:docs          # docs/ only
pnpm lint:md:claude        # .claude/ only
pnpm lint:md               # all markdown

# Markdown formatting
pnpm format:md:docs        # docs/ only
pnpm format:md:claude      # .claude/ only
pnpm format:md             # all markdown
```

**Full Monorepo Checks**:

```bash
# All packages - type check
pnpm typecheck

# All packages - lint
pnpm lint

# All packages - test
pnpm test

# All packages - build
pnpm build
```

**Quality Check Command**:

```bash
# Via Claude command
/quality-check

# Or manually
pnpm ci
```

---

## Troubleshooting

### Common CI Failures

#### Build Failures

**Symptom**: Build step fails in CI but works locally

**Common Causes**:

1. **Cached node_modules**:
   ```bash
   # CI Solution: Uses fresh install
   pnpm install --frozen-lockfile

   # Local Solution: Clear cache
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **Platform-specific dependencies**:
   ```bash
   # Issue: Native dependencies fail on Linux CI
   # Solution: Check package.json for platform-specific deps
   ```

3. **Missing environment variables**:
   ```bash
   # Issue: Build script expects env var
   # Solution: Add to GitHub secrets or workflow env
   ```

#### Coverage Threshold Failures

**Symptom**: Coverage below 90% threshold

```bash
ERROR: Coverage for statements (89.45%) does not meet threshold (90%)
```

**Solutions**:

1. **Add Missing Tests**:

   ```typescript
   // Identify uncovered lines in coverage report
   // Add tests for those code paths

   describe('Accommodation Service', () => {
     it('should handle edge case X', async () => {
       // Test uncovered code path
     });
   });
   ```

2. **Remove Dead Code**:

   ```typescript
   // If code is unreachable, remove it
   // Don't keep code just to have it
   ```

3. **Exclude Non-testable Code** (rare):

   ```typescript
   /* istanbul ignore next */
   if (process.env.NODE_ENV === 'production') {
     // Production-only code
   }
   ```

**Check Coverage Locally**:

```bash
pnpm test:coverage

# View HTML report
open coverage/index.html
```

#### Build Failures

**Symptom**: TypeScript compilation errors in CI

**Common Causes**:

1. **Type errors**:
   ```typescript
   // Issue: Type mismatch
   const id: number = "123";  // Error

   // Solution: Fix types
   const id: number = 123;
   ```

2. **Missing type definitions**:
   ```bash
   # Issue: Cannot find module '@types/node'
   # Solution: Install type definitions
   pnpm add -D @types/node
   ```

3. **Import errors**:
   ```typescript
   // Issue: Module not found
   import { User } from './user';  // File is user.model.ts

   // Solution: Fix import path
   import { User } from './user.model';
   ```

#### Test Failures

**Symptom**: Tests pass locally but fail in CI

**Common Causes**:

1. **Timezone differences**:
   ```typescript
   // Issue: Date comparison fails in different timezone
   expect(date).toBe('2024-01-15');

   // Solution: Use UTC or normalize timezones
   expect(date.toISOString()).toBe('2024-01-15T00:00:00.000Z');
   ```

2. **Race conditions**:
   ```typescript
   // Issue: Async operations race
   await Promise.all([operation1(), operation2()]);

   // Solution: Ensure proper ordering
   await operation1();
   await operation2();
   ```

3. **Database state**:
   ```typescript
   // Issue: Tests depend on specific DB state
   // Solution: Use beforeEach to reset state
   beforeEach(async () => {
     await clearDatabase();
     await seedTestData();
   });
   ```

#### Link Check Failures

**Symptom**: Documentation link checks fail

**Common Causes**:

1. **Case sensitivity**:
   ```markdown
   ❌ [Link](./Environment-Setup.md)
   ✓ [Link](./environment-setup.md)
   ```

2. **Moved files**:
   ```markdown
   ❌ [Link](./old-location/file.md)
   ✓ [Link](./new-location/file.md)
   ```

3. **Broken anchors**:
   ```markdown
   ❌ [Section](#non-existent)
   ✓ [Section](#existing-section)
   ```

**Solution**: Run link checker locally:

```bash
pnpm docs:check-links
```

#### Permission Errors

**Symptom**: Workflow fails with permission denied

**Common Causes**:

1. **Branch protection**:
   ```
   Error: Protected branch update failed
   ```
   **Solution**: Ensure workflow has proper permissions

2. **Secret access**:
   ```
   Error: Secret HOSPEDA_DATABASE_URL not found
   ```
   **Solution**: Verify secret is configured correctly

3. **File permissions**:
   ```
   Error: EACCES: permission denied
   ```
   **Solution**: Check file permissions in repository

### Debug Strategies

#### Enable Debug Logging

**In workflow file**:

```yaml
- name: Debug step
  run: |
    echo "::debug::Debugging information"
    echo "Current directory: $(pwd)"
    echo "Files: $(ls -la)"
  env:
    ACTIONS_STEP_DEBUG: true
```

**Enable in GitHub UI**:

1. Go to repository **Settings**
2. Navigate to **Secrets and Variables** → **Actions**
3. Add secret: `ACTIONS_STEP_DEBUG` = `true`
4. Re-run workflow

#### Inspect Workflow Logs

**View Logs**:

1. Go to **Actions** tab
2. Click on workflow run
3. Click on job
4. Expand steps to see detailed logs

**Download Logs**:

1. Click on workflow run
2. Click **⋯** (three dots) in top right
3. Select **Download log archive**

#### Re-run Failed Jobs

**Re-run Options**:

1. **Re-run failed jobs**: Only re-runs jobs that failed
2. **Re-run all jobs**: Re-runs entire workflow
3. **Re-run with debug logging**: Re-runs with debug output

**Steps**:

1. Go to failed workflow run
2. Click **Re-run jobs** dropdown
3. Select re-run option

#### Local Reproduction

**Steps to reproduce locally**:

1. **Check environment**:
   ```bash
   node --version   # Should match CI (20.x)
   pnpm --version   # Should match CI (9.x)
   ```

2. **Clean install**:
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install --frozen-lockfile
   ```

3. **Run CI commands**:
   ```bash
   pnpm build
   pnpm typecheck
   pnpm lint
   pnpm test:coverage
   ```

4. **Compare outputs**: Look for differences between local and CI

#### Debugging Tips

**1. Isolate the issue**:

```bash
# Run individual package
cd packages/db
pnpm build
pnpm test

# Run specific test file
pnpm test -- accommodation.model.test.ts
```

**2. Check dependencies**:

```bash
# Verify dependency installation
pnpm list --depth=0

# Check for peer dependency warnings
pnpm install
```

**3. Verify environment**:

```bash
# Print environment variables (sanitize secrets!)
printenv | grep HOSPEDA

# Check Node.js version
node --version

# Check PNPM version
pnpm --version
```

**4. Compare with main**:

```bash
# Check diff from main
git diff main

# Check what changed in package.json
git diff main -- package.json pnpm-lock.yaml
```

---

## Adding New Workflows

### Workflow Structure

**Basic Template**:

```yaml
name: Workflow Name

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  job-name:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup PNPM
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Get PNPM store directory
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup PNPM cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run custom task
        run: pnpm run custom:task
```

### Best Practices

**1. Use Appropriate Triggers**:

```yaml
# Run on push to main and all PRs
on:
  push:
    branches: [main]
  pull_request:

# Run only when specific files change
on:
  push:
    paths:
      - 'src/**'
      - 'package.json'

# Run on schedule
on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
```

**2. Set Timeouts**:

```yaml
jobs:
  test:
    timeout-minutes: 15  # Prevent hanging jobs
```

**3. Use Caching**:

```yaml
- uses: actions/cache@v4
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
```

**4. Fail Fast**:

```yaml
strategy:
  fail-fast: true
  matrix:
    node: [18, 20]
```

**5. Use Secrets Securely**:

```yaml
env:
  DATABASE_URL: ${{ secrets.HOSPEDA_DATABASE_URL }}
# Never log secrets!
```

**6. Add Job Summaries**:

```yaml
- name: Generate summary
  run: |
    echo "## Test Results" >> $GITHUB_STEP_SUMMARY
    echo "✓ All tests passed" >> $GITHUB_STEP_SUMMARY
```

### Testing New Workflows

**1. Use Act Locally**:

```bash
# Test workflow syntax
act -l

# Run workflow
act -W .github/workflows/new-workflow.yml
```

**2. Test in Branch**:

```bash
# Create feature branch
git checkout -b workflow/add-new-check

# Add workflow
git add .github/workflows/new-workflow.yml
git commit -m "feat(ci): add new workflow"
git push origin workflow/add-new-check

# Open PR and verify workflow runs
```

**3. Use Draft PRs**:

- Create PR as draft
- Verify workflow runs correctly
- Mark as ready for review once validated

**4. Test Manual Dispatch**:

```yaml
on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run'
        required: false
        default: 'true'
```

Run manually to test before enabling automatic triggers.

### Documentation Requirements

**When adding a new workflow, update**:

1. **This document** (`docs/deployment/ci-cd.md`):
   - Add workflow section
   - Describe purpose, triggers, jobs
   - Add troubleshooting section

2. **Workflow summary table** (in Overview section):
   - Add row with workflow details

3. **README.md** (`docs/deployment/README.md`):
   - Add workflow to deployment overview

4. **Workflow file comments**:
   ```yaml
   # This workflow validates X
   # Runs on: push to main, PRs
   # Purpose: Ensure Y
   name: Workflow Name
   ```

---

## CI/CD Best Practices

### Atomic Commits

**Rule**: Each commit should contain changes for ONE specific task

**Why**:

- Easier to review
- Easier to revert
- Clearer history
- Better bisecting for bugs

**How**:

```bash
# ❌ Bad: Commits unrelated changes
git add .
git commit -m "Various updates"

# ✓ Good: Commits specific change
git add packages/db/src/models/user.model.ts
git add packages/db/test/models/user.model.test.ts
git commit -m "feat(db): add User model with CRUD operations"
```

**Full Policy**: See [Atomic Commits Standards](../../.claude/docs/standards/atomic-commits.md)

### PR Workflow

**Standard PR Process**:

1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/add-booking-system
   ```

2. **Make Changes** (atomic commits):
   ```bash
   git add specific-files
   git commit -m "feat(service): add booking service"
   ```

3. **Run Local Checks**:
   ```bash
   pnpm ci  # Runs build, typecheck, lint, test
   ```

4. **Push Branch**:
   ```bash
   git push origin feature/add-booking-system
   ```

5. **Open Pull Request**:
   - Use PR template
   - Link related issues
   - Request reviewers

6. **Wait for CI**:
   - All checks must pass
   - Coverage must be ≥90%
   - No lint/type errors

7. **Address Review Comments**:
   - Make changes
   - Commit and push
   - CI re-runs automatically

8. **Merge**:
   - Squash and merge (preferred)
   - Or merge commit (for multi-commit features)
   - Delete branch after merge

### Coverage Requirements

**Minimum**: 90% across all metrics

**Measured Per**:

- Individual package
- Global average

**Metrics**:

- **Statements**: 90%
- **Branches**: 90%
- **Functions**: 90%
- **Lines**: 90%

**When Coverage Drops**:

1. **Add tests** for new code
2. **Don't lower threshold** to make CI pass
3. **Remove dead code** if unreachable
4. **Refactor** complex code to be more testable

**Exceptions** (rare):

- Generated code (migrations)
- Type definitions
- Configuration files

### Code Review Process

**All code requires review before merge**

**Reviewer Checklist**:

- [ ] Code follows project standards
- [ ] Tests are comprehensive (90% coverage)
- [ ] Types are correct (no `any`)
- [ ] No security vulnerabilities
- [ ] Documentation is updated
- [ ] Commit messages are clear
- [ ] No unnecessary dependencies added

**Approval Required**: At least 1 approval from code owner

**Auto-merge**: Not enabled (requires manual merge)

### Deployment Gates

**Main Branch Protection**:

- ✅ Require PR before merging
- ✅ Require status checks to pass (CI workflow)
- ✅ Require branches to be up to date
- ✅ Require code review approval
- ❌ Do not allow force push
- ❌ Do not allow deletions

**Status Checks Required**:

- Build (all packages and apps)
- Type check (all packages)
- Lint (all packages)
- Tests with coverage (≥90%)

**Manual Deploy**:

- Production deploys are manual via Vercel
- Staging auto-deploys on merge to main
- Preview deploys auto-generate for all PRs

### Quality First Mindset

**Principles**:

1. **No shortcuts**: Every change goes through CI
2. **Tests first**: Write tests before code (TDD)
3. **Coverage matters**: 90% is non-negotiable
4. **Documentation**: Update docs with code changes
5. **Review thoroughly**: Don't rubber-stamp PRs

**Culture**:

- Breaking CI is a priority to fix
- Coverage drops are investigated immediately
- Lint errors are fixed, not ignored
- Flaky tests are fixed, not skipped

**Continuous Improvement**:

- Regular CI pipeline reviews
- Monitor and optimize workflow times
- Update dependencies regularly
- Learn from CI failures

---

## Related Documentation

- [Deployment Overview](./README.md)
- [Environment Setup](./environment-setup.md)
- [Vercel Deployment](./vercel.md)
- [Testing Standards](../.claude/docs/standards/testing-standards.md)
- [Atomic Commits](../.claude/docs/standards/atomic-commits.md)

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
**Maintained By**: Tech Lead
