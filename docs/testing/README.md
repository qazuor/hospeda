# Testing Documentation

## Overview

Hospeda's testing infrastructure is built on **Test-Driven Development (TDD)** principles with a strict **90% code coverage requirement**. All code must be tested before merge, with no exceptions.

This documentation provides comprehensive guides for writing and maintaining tests across the entire platform.

## 📖 Documentation

| Document | Description | Lines |
|----------|-------------|-------|
| [Testing Strategy](./strategy.md) | Testing philosophy, TDD workflow, and test pyramid | ~1,200 |
| [Unit Testing](./unit-testing.md) | Unit test patterns with AAA methodology | ~1,500 |
| [Integration Testing](./integration-testing.md) | Integration test patterns and database testing | ~1,200 |
| [E2E Testing](./e2e-testing.md) | End-to-end testing with Playwright | ~1,000 |
| [Test Factories](./test-factories.md) | Factory patterns for test data generation | ~800 |
| [Mocking Strategies](./mocking.md) | Comprehensive mocking guide with Vitest | ~900 |
| [Coverage Requirements](./coverage.md) | 90% coverage requirements and enforcement | ~600 |

## 🎯 Testing Philosophy

### Core Principles

1. **TDD First**: Red → Green → Refactor cycle is mandatory
2. **90% Coverage**: No exceptions, enforced in CI/CD
3. **AAA Pattern**: Arrange → Act → Assert for all tests
4. **Fast Tests**: Unit < 100ms, Integration < 1s, E2E < 10s
5. **Test Isolation**: Each test independent and repeatable

### Test Pyramid

```text
       /\
      /  \  E2E (5%)
     /----\
    /      \  Integration (25%)
   /--------\
  /          \ Unit (70%)
 /____________\
```

**Distribution Guidelines**:

- **70% Unit Tests**: Fast, isolated, focused on single functions/methods
- **25% Integration Tests**: Multiple components working together
- **5% E2E Tests**: Critical user flows through entire system

This distribution ensures fast feedback loops while maintaining confidence in system behavior.

## 🚀 Quick Start

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (auto-rerun on changes)
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Open coverage HTML report
open coverage/index.html

# Specific package
cd packages/db && pnpm test

# Specific file
pnpm test:file test/models/accommodation.model.test.ts

# Interactive UI mode
pnpm test:ui
```

### Writing Your First Test

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AccommodationModel } from '../src/models/accommodation/accommodation.model';

describe('AccommodationModel', () => {
  let model: AccommodationModel;

  beforeEach(() => {
    model = new AccommodationModel();
    vi.clearAllMocks();
  });

  it('should create accommodation with valid data', async () => {
    // Arrange: Set up test data
    const data = {
      name: 'Hotel Paradise',
      city: 'Buenos Aires',
      address: '123 Main St'
    };

    // Act: Execute the code under test
    const result = await model.create(data);

    // Assert: Verify expected outcome
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Hotel Paradise');
    expect(result.data.id).toBeDefined();
  });
});
```

## ✅ Quality Checklist

### Pre-Commit

Before committing code, ensure:

- [ ] All tests pass (`pnpm test`)
- [ ] Coverage ≥ 90% (`pnpm test:coverage`)
- [ ] No skipped tests (`.skip` or `.only`)
- [ ] Tests follow AAA pattern
- [ ] Tests are isolated (no shared state)
- [ ] Descriptive test names (starts with "should")
- [ ] All async operations properly handled
- [ ] Mocks cleaned up in `afterEach`

### Pre-PR

Before creating pull request:

- [ ] Full test suite passes
- [ ] Coverage meets 90% threshold
- [ ] Integration tests pass
- [ ] E2E tests pass (critical paths)
- [ ] No flaky tests
- [ ] Test names follow conventions
- [ ] Complex logic has test comments

## 🔧 Configuration

### Project Root

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:file": "vitest run"
  }
}
```

### Per-Package Configuration

Each package has its own `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      exclude: [
        '**/test/**/mocks/**',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**'
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      }
    },
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'build']
  }
});
```

**Key Settings**:

- **globals**: Enable global test APIs (describe, it, expect)
- **environment**: Node.js environment for backend tests
- **coverage.provider**: V8 for fast, accurate coverage
- **coverage.thresholds**: Enforce 90% minimum
- **include**: Tests in `test/**/*.test.ts`

## 📊 Coverage Requirements

### Minimum Thresholds

| Metric | Threshold | Description |
|--------|-----------|-------------|
| **Statements** | 90% | Individual code statements executed |
| **Branches** | 90% | if/else branches tested |
| **Functions** | 90% | Functions/methods called |
| **Lines** | 90% | Code lines covered |

### Enforcement

Coverage is enforced at multiple levels:

1. **Local**: `pnpm test:coverage` fails if < 90%
2. **Pre-commit**: Husky hook checks coverage
3. **CI/CD**: GitHub Actions fails build if < 90%
4. **Per-package**: Each package must meet threshold

**No exceptions**: All production code must meet 90% coverage.

## 🎨 Test Patterns

### AAA Pattern (Arrange-Act-Assert)

Every test should follow this structure:

```typescript
it('should calculate total price', async () => {
  // 1. ARRANGE: Set up test data and conditions
  const cart = {
    items: [
      { price: 10, quantity: 2 },
      { price: 20, quantity: 1 }
    ]
  };
  const discountRate = 0.1;

  // 2. ACT: Execute the code under test
  const total = calculateTotal(cart, discountRate);

  // 3. ASSERT: Verify the expected outcome
  expect(total).toBe(36); // (10*2 + 20*1) * 0.9
});
```

### Test Organization

```typescript
describe('AccommodationService', () => {
  // Group related tests
  describe('create', () => {
    it('should create with valid data', () => {});
    it('should reject invalid data', () => {});
    it('should handle duplicates', () => {});
  });

  describe('update', () => {
    it('should update existing', () => {});
    it('should reject non-existent', () => {});
  });

  describe('delete', () => {
    it('should soft delete', () => {});
    it('should maintain audit trail', () => {});
  });
});
```

### Test Naming Convention

**Format**: `should [expected behavior] when [condition]`

```typescript
// Good ✅
it('should create accommodation with valid data', () => {});
it('should reject duplicate name', () => {});
it('should return null when not found', () => {});

// Bad ❌
it('creates accommodation', () => {}); // Missing "should"
it('test update', () => {}); // Unclear
it('works', () => {}); // Too vague
```

## 🔗 Testing Infrastructure

### Vitest

**Why Vitest?**

- **Fast**: 10x faster than Jest
- **Modern**: ESM support out of the box
- **Compatible**: Jest-compatible API
- **Integrated**: Works seamlessly with Vite
- **TypeScript**: First-class TypeScript support

**Key Features**:

- Watch mode with smart re-runs
- UI mode for interactive debugging
- Coverage with V8 provider
- Snapshot testing
- Mocking utilities

### Test Database

**Strategy**: In-memory PostgreSQL for integration tests

```typescript
import { setupTestDatabase, cleanupTestDatabase } from './test-utils';

describe('AccommodationModel Integration', () => {
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  beforeEach(async () => {
    await db.clearAll();
  });

  // Tests with real database
});
```

### Mocking

**Vitest Mocking API**:

```typescript
import { vi } from 'vitest';

// Mock module
vi.mock('./accommodation.model', () => ({
  AccommodationModel: vi.fn()
}));

// Mock function
const mockFn = vi.fn().mockReturnValue(42);

// Spy on method
const spy = vi.spyOn(obj, 'method');

// Clear all mocks
vi.clearAllMocks();
```

## 📈 Test Metrics

### Performance Targets

| Test Type | Target | Maximum | Failure Action |
|-----------|--------|---------|----------------|
| Unit | < 100ms | 500ms | Optimize or split |
| Integration | < 1s | 3s | Review database queries |
| E2E | < 10s | 30s | Investigate bottlenecks |
| Full Suite | < 5min | 10min | Parallelize or optimize |

### Coverage Tracking

```bash
# View coverage summary
pnpm test:coverage

# Output example:
# File                     | % Stmts | % Branch | % Funcs | % Lines
# -------------------------|---------|----------|---------|--------
# src/models/accommodation | 95.5    | 92.3     | 96.2    | 95.5
# src/services/accommodation| 91.2   | 89.7     | 93.1    | 91.2
# -------------------------|---------|----------|---------|--------
# All files                | 93.4    | 91.0     | 94.7    | 93.4
```

## 🛠️ Common Tasks

### Add Test for New Feature

```bash
# 1. Create test file (TDD: test first!)
touch test/models/new-feature.model.test.ts

# 2. Write failing test
# 3. Implement feature
# 4. Make test pass
# 5. Refactor

# 6. Verify coverage
pnpm test:coverage
```

### Debug Failing Test

```bash
# Run specific test in watch mode
pnpm test:file test/models/accommodation.model.test.ts

# Or use UI mode for debugging
pnpm test:ui
```

### Fix Coverage Gap

```bash
# 1. Generate coverage report
pnpm test:coverage

# 2. Open HTML report
open coverage/index.html

# 3. Navigate to red/yellow lines
# 4. Add tests for uncovered code
# 5. Re-run coverage
```

## 🚨 Common Issues

### Flaky Tests

**Problem**: Tests pass sometimes, fail other times

**Solutions**:

- Remove shared state between tests
- Use `beforeEach` to reset state
- Avoid timing-dependent logic
- Mock unpredictable dependencies

### Slow Tests

**Problem**: Test suite takes too long

**Solutions**:

- Mock expensive operations
- Use in-memory database
- Run tests in parallel
- Optimize database queries

### Low Coverage

**Problem**: Coverage below 90%

**Solutions**:

- Review uncovered lines in HTML report
- Add tests for edge cases
- Test error handling paths
- Remove dead code

## 📚 Learning Resources

### Documentation

- [Testing Strategy](./strategy.md) - Start here for philosophy
- [Unit Testing Guide](./unit-testing.md) - Writing unit tests
- [Integration Testing Guide](./integration-testing.md) - Testing interactions
- [Mocking Guide](./mocking.md) - Effective mocking strategies

### External Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TDD by Example](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)

## 🎯 Testing by Component

### Models (Database Layer)

- **Focus**: CRUD operations, queries, transactions
- **Type**: Unit + Integration
- **Coverage**: 95%+
- **Guide**: [Unit Testing](./unit-testing.md)

### Services (Business Logic)

- **Focus**: Business rules, validation, orchestration
- **Type**: Unit + Integration
- **Coverage**: 95%+
- **Guide**: [Integration Testing](./integration-testing.md)

### API Routes

- **Focus**: HTTP handling, middleware, validation
- **Type**: Integration + E2E
- **Coverage**: 90%+
- **Guide**: [E2E Testing](./e2e-testing.md)

### Frontend Components

- **Focus**: Rendering, user interactions, state
- **Type**: Unit + E2E
- **Coverage**: 85%+
- **Guide**: [Component Testing](./component-testing.md)

## 🔄 Continuous Integration

### GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test

      - name: Check coverage
        run: pnpm test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
pnpm test
pnpm test:coverage
```

## 📊 Metrics Dashboard

Track testing health:

- **Coverage Trend**: Track over time
- **Test Duration**: Monitor performance
- **Flaky Tests**: Identify and fix
- **Failed Tests**: Quick remediation

## 🎓 Best Practices Summary

### DO ✅

- Write tests first (TDD)
- Follow AAA pattern
- Use descriptive names
- Test edge cases
- Mock dependencies
- Keep tests fast
- Clean up after tests
- Maintain 90% coverage

### DON'T ❌

- Skip tests (`.skip`, `.only`)
- Share state between tests
- Test implementation details
- Write tests after code
- Ignore failing tests
- Use real external services
- Commit flaky tests
- Lower coverage standards

## 🆘 Getting Help

- **Documentation Issues**: Check [docs/testing/](.)
- **Test Failures**: Review error messages carefully
- **Coverage Issues**: Use HTML report for gaps
- **Best Practices**: Review [Testing Strategy](./strategy.md)
- **Technical Help**: Ask in #testing Slack channel

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Code Standards](../development/code-standards.md)
- [Architecture Patterns](../architecture/patterns.md)
- [Development Workflow](../development/workflow.md)
