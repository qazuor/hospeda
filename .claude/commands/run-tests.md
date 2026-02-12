---
name: run-tests
description: Execute comprehensive test suite with coverage validation, auto-detecting test runner. STOPS at first test failure or insufficient coverage.
---

# Run Tests Command

## Purpose

Execute comprehensive test suite across all packages and validate coverage
requirements. STOPS at first test failure or insufficient coverage.

## Usage

```bash
/run-tests
```

## Description

Runs the complete test suite across all packages with strict quality
requirements. Uses **STOP on first error** strategy to ensure immediate
attention to test failures. Validates minimum coverage requirement (default 90%).

Auto-detects:

- **Test runner**: Vitest, Jest, or other configured runner
- **Package manager**: pnpm, npm, or yarn
- **Coverage tool**: Built-in coverage from detected test runner

---

## Execution Flow

### Step 0: Auto-Detection

**Process:**

1. **Test Runner Detection**:
   - `vitest.config.*` present -> Vitest
   - `jest.config.*` present -> Jest
   - Check `package.json` for test framework dependencies
   - Check `package.json` scripts for `test` command

2. **Package Manager Detection**:
   - `pnpm-lock.yaml` -> pnpm
   - `yarn.lock` -> yarn
   - `package-lock.json` -> npm

3. **Coverage Configuration**:
   - Read coverage thresholds from test runner config
   - Default minimum: **90%** if not configured

---

### Step 1: Test Execution

**Command**: `{package_manager} test` (or `{package_manager} run test`)

**Process**:

- Execute test suite across all packages
- Run all test categories:
  - **Unit Tests**: Individual function/method testing
  - **Integration Tests**: Service and component interaction testing
  - **API Tests**: Endpoint behavior validation (if present)
  - **Component Tests**: UI component functionality (if present)

**STOP Condition**: First test failure encountered

---

### Step 2: Coverage Validation

**Command**: `{package_manager} test:coverage` (or equivalent)

**Process**:

- Execute coverage analysis
- Validate coverage thresholds:
  - **Statements**: meets configured minimum (default 90%)
  - **Branches**: meets configured minimum (default 90%)
  - **Functions**: meets configured minimum (default 90%)
  - **Lines**: meets configured minimum (default 90%)

**STOP Condition**: Coverage below configured minimum in any category

**Coverage Reporting**:

- Generate coverage reports (HTML, text, lcov as configured)
- Identify uncovered code paths
- Report coverage by package/module

---

## Quality Standards

### Test Quality Requirements

- **Test Structure**: AAA pattern (Arrange, Act, Assert)
- **Test Isolation**: No dependencies between tests
- **Mocking**: Proper mocks for external dependencies
- **Assertions**: Clear, specific assertions

### Coverage Requirements

- **Minimum Threshold**: Configurable, default 90% across all packages
- **Critical Paths**: Business logic should have highest coverage
- **Edge Cases**: Error conditions tested
- **Integration**: Service-layer integration tested

---

## Output Format

### Success Case

```text
TESTS PASSED

Test Results:
  Unit Tests: 156/156 passed
  Integration Tests: 43/43 passed
  API Tests: 78/78 passed
  Component Tests: 92/92 passed

Coverage Results:
  Statements: 94.2% (target: >=90%)
  Branches: 91.8% (target: >=90%)
  Functions: 96.1% (target: >=90%)
  Lines: 93.7% (target: >=90%)

All tests passing with excellent coverage
```

### Failure Case (Test Failure)

```text
TESTS FAILED

Test Failure:
  src/services/booking/booking.service.test.ts

FAIL: should create booking with valid data
Expected: 201
Received: 500

  at BookingService.create (booking.service.ts:45:12)
  at booking.service.test.ts:78:25

Error: Cannot read property 'id' of undefined

Fix Required: Check data validation before database insertion
```

### Failure Case (Coverage)

```text
TESTS FAILED - Insufficient Coverage

Coverage Results:
  Statements: 87.3% (target: >=90%) - BELOW THRESHOLD
  Branches: 91.8% (target: >=90%)
  Functions: 96.1% (target: >=90%)
  Lines: 89.1% (target: >=90%) - BELOW THRESHOLD

Uncovered Files:

- src/services/booking/booking.service.ts
  Lines: 45-52, 67-74 (error handling paths)

- src/routes/payments/webhook.ts
  Lines: 23-31 (webhook validation)

Fix Required: Add tests for uncovered code paths
```

---

## Technical Implementation

### Test Framework Configuration

**Vitest Example**:

```javascript
// vitest.config.ts
export default {
  test: {
    coverage: {
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      },
      exclude: [
        'dist/**',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  }
}
```

**Jest Example**:

```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90
    }
  }
}
```

### Script Resolution

The command looks for these scripts in `package.json`:

```json
{
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Error Categories

### Critical Errors (STOP execution)

- Test failures (assertions, exceptions)
- Coverage below configured threshold
- Test suite configuration errors
- Database connection failures (for integration tests)

### Warning Issues (Report but continue)

- Slow test execution (>5s per test)
- Deprecation warnings in test utilities
- Memory usage concerns

---

## Related Commands

- `/quality-check` - Includes run-tests + code check + reviews
- `/code-check` - Code quality validation before tests
- `/commit` - Generate commit messages after tests pass

---

## When to Use

- **Required**: Before every commit
- **Required**: As part of `/quality-check`
- **During Development**: After significant code changes
- **CI/CD Pipeline**: Automated quality gate

---

## Prerequisites

- All code changes saved and compiled
- Dependencies installed
- Test data fixtures prepared (if applicable)
- External services available for integration tests (if applicable)

---

## Post-Command Actions

**If PASSED**: Proceed with development or quality checks

**If FAILED**:

1. Review test failure details
2. Fix failing tests or add missing tests for coverage
3. Re-run `/run-tests`
4. Consider running specific test suites for faster feedback

---

## Performance Notes

- **Parallel Execution**: Tests run concurrently across packages (if supported)
- **Test Isolation**: Each package's tests are isolated
- **Cache**: Test results cached for unchanged files (if supported)
- **Typical Duration**: 30 seconds to 5 minutes depending on project size
- **Watch Mode**: Available for development with most test runners

---

## Configuration

### Coverage Threshold

The default coverage minimum is **90%**. Override this in your test runner
configuration file. The command will read the configured thresholds
automatically.

If no thresholds are configured, the command applies these defaults:

| Metric     | Default Minimum |
| ---------- | --------------- |
| Statements | 90%             |
| Branches   | 90%             |
| Functions  | 90%             |
| Lines      | 90%             |
