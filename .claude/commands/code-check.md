# Code Check Command

## Purpose

Run linting and type checking across all packages. STOPS at first error to allow immediate fixing.

## Usage

```bash
/code-check
```text

## Description

Runs comprehensive code quality checks (TypeScript compilation and Biome linting) across the entire monorepo. Uses **STOP on first error** strategy to allow developers to fix issues immediately rather than being overwhelmed with multiple errors.

---

## Execution Flow

### Step 1: TypeScript Validation

**Command**: `pnpm typecheck`

**Process**:

- Navigate to project root
- Execute `pnpm typecheck` (runs turbo typecheck across all packages)
- Check TypeScript compilation across:
  - `apps/api/` - Hono backend
  - `apps/web/` - Astro frontend
  - `apps/admin/` - TanStack Start admin
  - All `packages/*` - Shared libraries

**STOP Condition**: First TypeScript error encountered

**Output on Error**:

```text
❌ TypeScript Error Found

File: apps/api/src/routes/accommodations/index.ts:45:12
Error: Property 'id' does not exist on type 'CreateAccommodationRequest'

Please fix this error before proceeding.
```text

### Step 2: Lint Validation

**Command**: `pnpm lint`

**Process**:

- Execute `pnpm lint` (runs turbo lint across all packages)
- Apply Biome linting rules:
  - Code style consistency
  - Import organization
  - Unused variable detection
  - Best practice enforcement

**STOP Condition**: First linting error encountered

**Output on Error**:

```text
❌ Lint Error Found

File: packages/service-core/src/services/accommodation/accommodation.service.ts:23:8
Error: 'result' is assigned a value but never used

Please fix this error before proceeding.
```text

---

## Quality Standards

### TypeScript Standards

- ✅ **Strict Mode**: All packages use TypeScript strict mode
- ✅ **No Any Types**: Explicit typing required
- ✅ **Import Resolution**: All imports resolve correctly
- ✅ **Type Safety**: No type assertion abuse

### Biome Linting Standards

- ✅ **Code Style**: Consistent formatting and structure
- ✅ **Import Organization**: Sorted and grouped imports
- ✅ **Unused Code**: No unused variables/imports
- ✅ **Best Practices**: Following JavaScript/TypeScript conventions

---

## Output Format

### Success Case

```text
✅ CODE CHECK PASSED

TypeScript:
✅ All packages compile successfully
✅ No type errors found
✅ Strict mode compliance verified

Biome Lint:
✅ All linting rules passed
✅ Code style consistent
✅ No unused code detected

🚀 Code quality standards met
```text

### Failure Case (TypeScript)

```text
❌ CODE CHECK FAILED - TypeScript Error

Package: apps/api
File: src/routes/accommodations/index.ts
Line: 45, Column: 12
Error: Property 'id' does not exist on type 'CreateAccommodationRequest'

Context:
  43 | const accommodation = await accommodationService.create({
  44 |   ...validatedData,
> 45 |   id: nanoid(), // ERROR: 'id' not in CreateAccommodationRequest
  46 |   createdAt: new Date()
  47 | });

Fix Required: Remove 'id' field or update type definition
```text

### Failure Case (Biome Lint)

```text
❌ CODE CHECK FAILED - Lint Error

Package: packages/service-core
File: src/services/accommodation/accommodation.service.ts
Line: 23, Column: 8
Rule: no-unused-vars
Error: 'result' is assigned a value but never used

Context:
  21 | async create(data: CreateAccommodationData): Promise<Accommodation> {
  22 |   const validation = this.validateCreateData(data);
> 23 |   const result = await this.model.create(validation); // Unused variable
  24 |   // Missing return statement
  25 | }

Fix Required: Return 'result' or remove unused variable
```text

---

## Technical Implementation

### Monorepo Integration

**TurboRepo Commands**:

- `pnpm typecheck` → `turbo run typecheck`
- `pnpm lint` → `turbo run lint`

**Package-Level Execution**:

Each package defines:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "biome check ."
  }
}
```text

### Error Detection Strategy

**TypeScript Errors**:

- Parse `tsc` output for compilation errors
- Extract file path, line number, and error message
- Show code context around error

**Biome Lint Errors**:

- Parse Biome JSON output
- Extract rule violations
- Show suggested fixes when available

---

## Error Categories

### Critical Errors (STOP execution)

- TypeScript compilation failures
- Biome rule violations
- Import resolution errors
- Type definition conflicts

### Info Messages (Report but continue)

- Biome auto-fix suggestions
- TypeScript informational messages
- Performance optimization hints

---

## Related Commands

- `/quality-check` - Includes code-check + tests + reviews
- `/run-tests` - Test execution validation
- `/review-code` - Code quality analysis

---

## When to Use

- **During Development**: Before committing changes
- **Before Reviews**: Ensure clean code for review
- **CI/CD Pipeline**: Automated quality gate
- **Required by**: `/quality-check` command

---

## Prerequisites

- All code changes saved
- Dependencies installed (`pnpm install`)
- No syntax errors in files

---

## Post-Command Actions

**If PASSED**: Proceed with development or run `/run-tests`

**If FAILED**: Fix reported error and re-run `/code-check`

---

## Performance Notes

- **Parallel Execution**: TurboRepo runs checks in parallel
- **Incremental**: Only checks changed packages when possible
- **Cache**: Results cached for unchanged packages
- **Typical Duration**: 30-60 seconds for full monorepo

