---
name: code-check
description: Run linting and type checking across all packages, auto-detecting package manager and tooling. STOPS at first error to allow immediate fixing.
---

# Code Check Command

## Purpose

Run linting and type checking across all packages. STOPS at first error to allow
immediate fixing.

## Usage

```bash
/code-check
```

## Description

Runs comprehensive code quality checks (type checking and linting) across the
entire project. Uses **STOP on first error** strategy to allow developers to fix
issues immediately rather than being overwhelmed with multiple errors.

Auto-detects:

- **Package manager**: pnpm, npm, or yarn (checks for lock files)
- **Linter**: Biome, ESLint, or other configured linter
- **Type checker**: TypeScript `tsc --noEmit`

---

## Execution Flow

### Step 0: Auto-Detection

**Process:**

Detect the project's tooling by checking for configuration files and lock files:

1. **Package Manager Detection**:
   - `pnpm-lock.yaml` present -> use `pnpm`
   - `yarn.lock` present -> use `yarn`
   - `package-lock.json` present -> use `npm`

2. **Linter Detection**:
   - `biome.json` or `biome.jsonc` -> Biome
   - `.eslintrc.*` or `eslint.config.*` -> ESLint
   - Check `package.json` scripts for `lint` command

3. **Type Checker Detection**:
   - `tsconfig.json` present -> TypeScript
   - Check `package.json` scripts for `typecheck` command

---

### Step 1: Lint Validation

**Command**: `{package_manager} lint` (or `{package_manager} run lint`)

**Process**:

- Execute linting across all packages
- Apply configured linting rules:
  - Code style consistency
  - Import organization
  - Unused variable detection
  - Best practice enforcement

**STOP Condition**: First linting error encountered

**Output on Error**:

```text
Lint Error Found

File: src/services/user/user.service.ts:23:8
Error: 'result' is assigned a value but never used

Please fix this error before proceeding.
```

---

### Step 2: Type Checking

**Command**: `{package_manager} typecheck` (or `{package_manager} run typecheck`)

**Process**:

- Execute type checking across all packages
- Check TypeScript compilation across all source files
- Verify type safety, import resolution, and strict mode compliance

**STOP Condition**: First type error encountered

**Output on Error**:

```text
TypeScript Error Found

File: src/routes/users/index.ts:45:12
Error: Property 'id' does not exist on type 'CreateUserRequest'

Please fix this error before proceeding.
```

---

## Quality Standards

### Type Checking Standards

- **Strict Mode**: Respect project tsconfig strict settings
- **No Any Types**: Explicit typing preferred
- **Import Resolution**: All imports resolve correctly
- **Type Safety**: No unsafe type assertions

### Linting Standards

- **Code Style**: Consistent formatting and structure
- **Import Organization**: Sorted and grouped imports
- **Unused Code**: No unused variables or imports
- **Best Practices**: Following JavaScript/TypeScript conventions

---

## Output Format

### Success Case

```text
CODE CHECK PASSED

Lint:
  All linting rules passed
  Code style consistent
  No unused code detected

Type Check:
  All packages compile successfully
  No type errors found
  Strict mode compliance verified

Code quality standards met
```

### Failure Case (Lint)

```text
CODE CHECK FAILED - Lint Error

File: src/services/user/user.service.ts
Line: 23, Column: 8
Rule: no-unused-vars
Error: 'result' is assigned a value but never used

Context:
  21 | async create(data: CreateUserData): Promise<User> {
  22 |   const validation = this.validateCreateData(data);
> 23 |   const result = await this.model.create(validation); // Unused variable
  24 |   // Missing return statement
  25 | }

Fix Required: Return 'result' or remove unused variable
```

### Failure Case (TypeScript)

```text
CODE CHECK FAILED - TypeScript Error

File: src/routes/users/index.ts
Line: 45, Column: 12
Error: Property 'id' does not exist on type 'CreateUserRequest'

Context:
  43 | const user = await userService.create({
  44 |   ...validatedData,
> 45 |   id: generateId(), // ERROR: 'id' not in CreateUserRequest
  46 |   createdAt: new Date()
  47 | });

Fix Required: Remove 'id' field or update type definition
```

---

## Technical Implementation

### Package Manager Auto-Detection

```text
Detection Priority:
1. pnpm-lock.yaml   -> pnpm
2. yarn.lock        -> yarn
3. package-lock.json -> npm
4. Default          -> npm
```

### Script Resolution

The command looks for these scripts in `package.json`:

```json
{
  "scripts": {
    "lint": "biome check .",
    "typecheck": "tsc --noEmit"
  }
}
```

If using a monorepo with Turborepo, Nx, or similar:

```json
{
  "scripts": {
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  }
}
```

### Error Detection Strategy

**Linting Errors**:

- Parse linter output for rule violations
- Extract file path, line number, and error message
- Show suggested fixes when available

**Type Errors**:

- Parse `tsc` output for compilation errors
- Extract file path, line number, and error message
- Show code context around error

---

## Error Categories

### Critical Errors (STOP execution)

- Linting rule violations
- TypeScript compilation failures
- Import resolution errors
- Type definition conflicts

### Info Messages (Report but continue)

- Auto-fix suggestions
- Informational messages
- Performance optimization hints

---

## Related Commands

- `/quality-check` - Includes code-check + tests + reviews
- `/run-tests` - Test execution validation
- `/commit` - Generate commit messages after passing checks

---

## When to Use

- **During Development**: Before committing changes
- **Before Reviews**: Ensure clean code for review
- **CI/CD Pipeline**: Automated quality gate
- **Required by**: `/quality-check` command

---

## Prerequisites

- All code changes saved
- Dependencies installed
- No syntax errors in files

---

## Post-Command Actions

**If PASSED**: Proceed with development or run `/run-tests`

**If FAILED**: Fix reported error and re-run `/code-check`

---

## Performance Notes

- **Parallel Execution**: Monorepo tools may run checks in parallel
- **Incremental**: Only checks changed packages when possible
- **Cache**: Results cached for unchanged packages
- **Typical Duration**: 15-60 seconds depending on project size
