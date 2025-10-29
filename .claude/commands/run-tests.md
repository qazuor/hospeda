# Run Tests Command

## Purpose

Execute comprehensive test suite across all packages and validate coverage requirements. STOPS at first test failure or insufficient coverage.

## Usage

```bash
/run-tests
```text

## Description

Runs the complete test suite across all packages in the monorepo with strict quality requirements. Uses **STOP on first error** strategy to ensure immediate attention to test failures. Validates minimum 90% test coverage requirement.

---

## Execution Flow

### Step 1: Unit Test Execution

**Command**: `pnpm test`

**Process**:

- Navigate to project root
- Execute `pnpm test` (runs turbo test across all packages)
- Run tests across:
  - `apps/api/` - API endpoint tests, service tests, model tests
  - `apps/web/` - Component tests, page tests, utility tests
  - `apps/admin/` - Admin component tests, form tests
  - All `packages/*` - Library unit tests

**STOP Condition**: First test failure encountered

**Test Categories**:

- **Unit Tests**: Individual function/method testing
- **Integration Tests**: Service-to-model integration
- **API Tests**: Endpoint behavior validation
- **Component Tests**: React component functionality

### Step 2: Coverage Validation

**Command**: `pnpm test:coverage`

**Process**:

- Execute coverage analysis with Vitest
- Validate coverage thresholds:
  - **Statements**: ≥ 90%
  - **Branches**: ≥ 90%
  - **Functions**: ≥ 90%
  - **Lines**: ≥ 90%

**STOP Condition**: Coverage below 90% in any category

**Coverage Reporting**:

- Generate HTML coverage reports
- Identify uncovered code paths
- Report coverage by package

---

## Quality Standards

### Test Quality Requirements

- ✅ **Test Structure**: AAA pattern (Arrange, Act, Assert)
- ✅ **Test Isolation**: No dependencies between tests
- ✅ **Mocking**: Proper mocks for external dependencies
- ✅ **Assertions**: Clear, specific assertions

### Coverage Requirements

- ✅ **Minimum 90%**: Across all packages
- ✅ **Critical Paths**: 100% coverage for business logic
- ✅ **Edge Cases**: Error conditions tested
- ✅ **Integration**: Service-layer integration tested

---

## Output Format

### Success Case

```text
✅ TESTS PASSED

Test Results:
✅ Unit Tests: 156/156 passed
✅ Integration Tests: 43/43 passed
✅ API Tests: 78/78 passed
✅ Component Tests: 92/92 passed

Coverage Results:
✅ Statements: 94.2% (target: ≥90%)
✅ Branches: 91.8% (target: ≥90%)
✅ Functions: 96.1% (target: ≥90%)
✅ Lines: 93.7% (target: ≥90%)

🚀 All tests passing with excellent coverage
```text

### Failure Case (Test Failure)

```text
❌ TESTS FAILED

Test Failure:
❌ apps/api/src/services/accommodation/accommodation.service.test.ts

FAIL: should create accommodation with valid data
Expected: 201
Received: 500

  at AccommodationService.create (accommodation.service.ts:45:12)
  at accommodation.service.test.ts:78:25

Error: Cannot read property 'id' of undefined

Stack Trace:
  AccommodationService.create
  → Model.create
  → Database insert operation

Fix Required: Check accommodation data validation before database insertion
```text

### Failure Case (Coverage)

```text
❌ TESTS FAILED - Insufficient Coverage

Coverage Results:
❌ Statements: 87.3% (target: ≥90%) - BELOW THRESHOLD
✅ Branches: 91.8% (target: ≥90%)
✅ Functions: 96.1% (target: ≥90%)
❌ Lines: 89.1% (target: ≥90%) - BELOW THRESHOLD

Uncovered Files:

- packages/service-core/src/services/booking/booking.service.ts

  Lines: 45-52, 67-74 (error handling paths)

- apps/api/src/routes/payments/webhook.ts

  Lines: 23-31 (webhook validation)

Fix Required: Add tests for uncovered code paths
```text

---

## Technical Implementation

### Test Framework Configuration

**Vitest Configuration**:

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
```text

### TurboRepo Integration

**Parallel Test Execution**:

- Tests run in parallel across packages
- Dependency-aware execution order
- Shared test utilities and mocks

**Test Scripts**:

```json
{
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```text

---

## Test Categories by Package

### API Package (`apps/api/`)

- **Route Tests**: HTTP endpoint behavior
- **Service Tests**: Business logic validation
- **Model Tests**: Database interaction
- **Middleware Tests**: Authentication, validation
- **Integration Tests**: End-to-end request flows

### Web Package (`apps/web/`)

- **Component Tests**: React component rendering
- **Page Tests**: Astro page functionality
- **Hook Tests**: Custom React hooks
- **Utility Tests**: Helper functions

### Admin Package (`apps/admin/`)

- **Form Tests**: TanStack form validation
- **Table Tests**: Data display components
- **Auth Tests**: Admin authentication flows

### Shared Packages (`packages/*`)

- **Unit Tests**: Pure function testing
- **Mock Tests**: Mock implementations
- **Type Tests**: TypeScript type validation

---

## Error Categories

### Critical Errors (STOP execution)

- Test failures (assertions, exceptions)
- Coverage below 90% threshold
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
- `/review-code` - Code quality analysis

---

## When to Use

- **Required**: Before every commit
- **Required**: As part of `/quality-check`
- **During Development**: After significant code changes
- **CI/CD Pipeline**: Automated quality gate

---

## Prerequisites

- All code changes saved and compiled
- Database available for integration tests
- Test data fixtures prepared
- Dependencies installed (`pnpm install`)

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

- **Parallel Execution**: Tests run concurrently across packages
- **Test Isolation**: Each package's tests are isolated
- **Cache**: Test results cached for unchanged files
- **Typical Duration**: 2-5 minutes for full test suite
- **Watch Mode**: Available for development (`pnpm test:watch`)

