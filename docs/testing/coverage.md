# Coverage Requirements

## Overview

Code coverage measures **how much of your code is executed during tests**. Hospeda enforces a strict **90% minimum coverage threshold** across all metrics with no exceptions.

**Why 90%?**

- **High Confidence**: Catches most bugs and edge cases
- **Industry Standard**: Widely accepted professional threshold
- **Forces Quality**: Can't skip "hard to test" code
- **Safety Net**: Enables confident refactoring
- **Team Accountability**: Clear, measurable quality metric

## Coverage Metrics

### Four Core Metrics

Coverage is measured across four dimensions:

| Metric | Description | Example |
|--------|-------------|---------|
| **Statements** | Individual code statements executed | `const x = 5;` |
| **Branches** | if/else, switch, ternary paths tested | `if (x > 0) { ... } else { ... }` |
| **Functions** | Functions/methods called | `function calculate() { ... }` |
| **Lines** | Physical lines of code covered | Line 42 executed |

### Statement Coverage

Percentage of code statements executed:

```typescript
function calculatePrice(price: number, discount: number) {
  const subtotal = price;                    // Statement 1 ✅
  const discountAmount = price * discount;   // Statement 2 ✅
  return subtotal - discountAmount;          // Statement 3 ✅
}

// Test
it('should calculate price', () => {
  expect(calculatePrice(100, 0.1)).toBe(90);
});

// Coverage: 3/3 statements = 100%
```

### Branch Coverage

Percentage of decision paths taken:

```typescript
function validateAge(age: number): string {
  if (age < 0) {              // Branch 1 ❌ Not tested
    return 'Invalid';
  } else if (age < 18) {      // Branch 2 ✅ Tested
    return 'Minor';
  } else {                    // Branch 3 ✅ Tested
    return 'Adult';
  }
}

// Tests
it('should return Minor for age 16', () => {
  expect(validateAge(16)).toBe('Minor');
});

it('should return Adult for age 25', () => {
  expect(validateAge(25)).toBe('Adult');
});

// Coverage: 2/3 branches = 66.7% ❌ FAILS (need 90%)

// Add missing test
it('should return Invalid for negative age', () => {
  expect(validateAge(-1)).toBe('Invalid');
});

// Coverage: 3/3 branches = 100% ✅
```

### Function Coverage

Percentage of functions called:

```typescript
class Calculator {
  add(a: number, b: number) {        // Function 1 ✅
    return a + b;
  }

  subtract(a: number, b: number) {   // Function 2 ❌ Not tested
    return a - b;
  }

  multiply(a: number, b: number) {   // Function 3 ✅
    return a * b;
  }
}

// Tests
it('should add', () => {
  expect(calculator.add(2, 3)).toBe(5);
});

it('should multiply', () => {
  expect(calculator.multiply(2, 3)).toBe(6);
});

// Coverage: 2/3 functions = 66.7% ❌ FAILS
```

### Line Coverage

Percentage of executable lines run:

```typescript
function processOrder(order: Order) {
  const total = calculateTotal(order);     // Line 1 ✅
  const tax = calculateTax(total);         // Line 2 ✅
  const shipping = calculateShipping();    // Line 3 ❌ Not covered

  return {
    total,
    tax,
    grandTotal: total + tax + shipping     // Line 4 ❌ Not covered
  };
}

// Test only covers lines 1-2
it('should calculate tax', () => {
  const result = processOrder(mockOrder);
  expect(result.tax).toBeDefined();
});

// Coverage: 2/4 lines = 50% ❌ FAILS
```

## Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary', 'lcov'],

      // 90% threshold enforced
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      },

      // Exclude from coverage
      exclude: [
        '**/test/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/index.ts', // Barrel files
        '**/mocks/**',
        '**/fixtures/**'
      ],

      // Include only source files
      include: ['src/**/*.ts'],

      // Fail CI if coverage below threshold
      all: true,
      skipFull: false
    }
  }
});
```

### Per-Package Configuration

Each package has its own coverage requirements:

```typescript
// packages/db/vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        statements: 95, // Higher for critical packages
        branches: 95,
        functions: 95,
        lines: 95
      }
    }
  }
});

// packages/utils/vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      }
    }
  }
});
```

## Running Coverage

### Command Line

```bash
# Generate coverage report
pnpm test:coverage

# Coverage for specific package
cd packages/db && pnpm test:coverage

# Coverage with watch mode
pnpm test:coverage --watch

# Coverage for specific file
pnpm test:coverage -- test/models/accommodation.test.ts

# Generate only HTML report
pnpm test:coverage --reporter=html
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Run tests with coverage
        run: pnpm test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true
          flags: unittests

      - name: Comment coverage on PR
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Reading Coverage Reports

### Terminal Output

```bash
pnpm test:coverage

# Output:
# ----------------------------------------------------------------
# File                     | % Stmts | % Branch | % Funcs | % Lines
# ----------------------------------------------------------------
# All files                |   92.5  |   91.2   |   93.1  |   92.8
#  src/models             |   95.3  |   94.1   |   96.2  |   95.5
#   accommodation.model.ts |   94.8  |   93.5   |   95.0  |   94.9
#   destination.model.ts   |   95.8  |   94.7   |   97.4  |   96.1
#  src/services           |   91.2  |   89.7   |   92.1  |   91.5
#   accommodation.service  |   90.5  |   88.2   |   91.3  |   90.8
#   booking.service        |   92.1  |   91.5   |   93.2  |   92.4
# ----------------------------------------------------------------
```

**Color Coding**:

- 🟢 Green (≥90%): Meets threshold
- 🟡 Yellow (80-89%): Warning
- 🔴 Red (<80%): Failing

### HTML Report

```bash
# Generate and open HTML report
pnpm test:coverage
open coverage/index.html
```

**HTML Report Features**:

- **File Browser**: Navigate source tree
- **Line-by-line Coverage**: See exactly what's covered
- **Color Coding**:
  - 🟢 Green lines: Covered
  - 🔴 Red lines: Not covered
  - 🟡 Yellow lines: Partially covered (some branches)
- **Summary Statistics**: Overall and per-file metrics
- **Interactive**: Click files to drill down

**Example HTML View**:

```typescript
// accommodation.service.ts
export class AccommodationService {
  async create(data: CreateAccommodationData) {  // 🟢 Covered
    const validated = this.validate(data);        // 🟢 Covered

    if (!validated.success) {                     // 🟡 Partial (only true tested)
      return validated;                           // 🔴 Not covered
    }

    const accommodation = await this.model.create(validated.data); // 🟢 Covered
    return { success: true, data: accommodation }; // 🟢 Covered
  }
}
```

### JSON Report

```bash
# Generate JSON report
pnpm test:coverage --reporter=json

# Output: coverage/coverage-final.json
{
  "src/models/accommodation.model.ts": {
    "lines": {
      "total": 100,
      "covered": 95,
      "skipped": 0,
      "pct": 95
    },
    "statements": {
      "total": 120,
      "covered": 114,
      "skipped": 0,
      "pct": 95
    },
    "functions": {
      "total": 15,
      "covered": 15,
      "skipped": 0,
      "pct": 100
    },
    "branches": {
      "total": 40,
      "covered": 38,
      "skipped": 0,
      "pct": 95
    }
  }
}
```

## Improving Coverage

### Step-by-Step Process

#### 1. Identify Uncovered Code

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/index.html

# Navigate to file with low coverage
# Look for red/yellow lines
```

#### 2. Analyze Gaps

**Red Lines** (Not Covered):

```typescript
// accommodation.service.ts
if (accommodation.isDeleted) {  // 🔴 Line 42 not covered
  return null;
}
```

**Yellow Lines** (Partial Coverage):

```typescript
// Only `true` branch tested
if (price > 0) {        // 🟡 Partial
  return price;         // 🟢 Covered
} else {
  return 0;             // 🔴 Not covered
}
```

#### 3. Write Missing Tests

```typescript
// ❌ Current test (partial coverage)
it('should return accommodation when found', async () => {
  const result = await service.findById('acc-1');
  expect(result).toBeDefined();
});

// ✅ Add test for uncovered branch
it('should return null when accommodation is deleted', async () => {
  const accommodation = await service.create({ name: 'Hotel' });
  await service.softDelete(accommodation.id);

  const result = await service.findById(accommodation.id);

  expect(result).toBeNull(); // Now line 42 is covered ✅
});
```

#### 4. Verify Improvement

```bash
# Run coverage again
pnpm test:coverage

# Check specific file
pnpm test:coverage -- test/services/accommodation.service.test.ts
```

### Common Coverage Gaps

#### Error Handling

```typescript
// Uncovered error handling
async function createBooking(data: BookingData) {
  try {
    return await db.insert(bookings).values(data);
  } catch (error) {                           // 🔴 Not covered
    logger.error('Failed to create booking'); // 🔴 Not covered
    throw error;                              // 🔴 Not covered
  }
}

// Add error test
it('should handle database error', async () => {
  vi.spyOn(db, 'insert').mockRejectedValue(new Error('DB error'));

  await expect(createBooking(data)).rejects.toThrow('DB error');
  expect(logger.error).toHaveBeenCalled();
});
```

#### Edge Cases

```typescript
// Uncovered edge case
function calculateDiscount(price: number, rate: number) {
  if (rate === 0) {     // 🟢 Covered
    return 0;
  }

  if (rate === 1) {     // 🔴 Not covered
    return price;       // 🔴 Not covered
  }

  return price * rate;  // 🟢 Covered
}

// Add edge case test
it('should return full price for 100% discount', () => {
  expect(calculateDiscount(100, 1)).toBe(100);
});
```

#### Validation Branches

```typescript
// Uncovered validation
function validateAge(age: number) {
  if (age < 0) {          // 🔴 Not tested
    throw new Error('Age cannot be negative');
  }

  if (age > 150) {        // 🔴 Not tested
    throw new Error('Age unrealistic');
  }

  return true;            // 🟢 Covered
}

// Add validation tests
it('should reject negative age', () => {
  expect(() => validateAge(-1)).toThrow('negative');
});

it('should reject unrealistic age', () => {
  expect(() => validateAge(200)).toThrow('unrealistic');
});
```

## Coverage Exclusions

### When to Exclude

**Valid Exclusions**:

- Test files
- Configuration files
- Type definitions
- Generated code
- Barrel files (index.ts)
- Mock files

**Invalid Exclusions**:

- Production code
- Business logic
- Critical paths
- "Hard to test" code

### Excluding Code

#### Via Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/test/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/index.ts',
        '**/mocks/**'
      ]
    }
  }
});
```

#### Via Comments

```typescript
/* c8 ignore start */
function debugHelper() {
  // Development-only debugging code
  console.log('Debug info');
}
/* c8 ignore stop */

/* c8 ignore next */
const developmentOnly = () => console.log('Dev mode');

// Or single line
const devLog = () => console.log('Dev'); /* c8 ignore next */
```

**⚠️ Warning**: Use ignore comments sparingly and only for legitimate cases.

## Coverage vs Quality

### Coverage Doesn't Guarantee Quality

**❌ 100% Coverage, Poor Tests**:

```typescript
// Bad test: High coverage, low value
it('should execute function', () => {
  service.create({ name: 'Hotel' });
  // No assertions! ❌
});

it('should not throw', () => {
  expect(() => service.create({ name: 'Hotel' })).not.toThrow();
  // Weak assertion ❌
});
```

**✅ 90% Coverage, Good Tests**:

```typescript
it('should create accommodation with valid data', async () => {
  const result = await service.create({
    name: 'Hotel Paradise',
    city: 'Buenos Aires'
  });

  expect(result.success).toBe(true);
  expect(result.data.id).toBeDefined();
  expect(result.data.name).toBe('Hotel Paradise');

  // Verify database state
  const saved = await db.query.accommodations.findFirst({
    where: eq(accommodations.id, result.data.id)
  });

  expect(saved).toBeDefined();
  expect(saved.name).toBe('Hotel Paradise');
});
```

### Quality Metrics Beyond Coverage

1. **Assertion Quality**: Meaningful, specific assertions
2. **Test Independence**: No shared state
3. **Test Clarity**: Clear arrange-act-assert
4. **Edge Cases**: Boundaries, errors, nulls tested
5. **Behavior Focus**: Test what, not how

## Enforcement

### Local Development

```bash
# Pre-commit hook
# .husky/pre-commit
#!/bin/sh
pnpm test:coverage

# Fails commit if coverage < 90%
```

### Pull Requests

```yaml
# .github/workflows/pr-check.yml
name: PR Check

on:
  pull_request:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2

      - name: Install dependencies
        run: pnpm install

      - name: Check coverage
        run: pnpm test:coverage

      - name: Fail if coverage below 90%
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 90" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 90%"
            exit 1
          fi
```

### Branch Protection

```yaml
# GitHub Branch Protection Rules
# Settings → Branches → main → Branch protection rules

Required status checks:
  ✅ Test / coverage (90% minimum)

Require branches to be up to date before merging: ✅
```

## Troubleshooting

### Coverage Not Generated

```bash
# Problem: No coverage directory
# Solution: Check coverage.provider

# vitest.config.ts
coverage: {
  provider: 'v8' // Or 'istanbul'
}
```

### Inaccurate Coverage

```bash
# Problem: Coverage shows 0% for tested code
# Solution: Ensure source maps enabled

// vitest.config.ts
test: {
  coverage: {
    provider: 'v8',
    include: ['src/**/*.ts']
  }
}
```

### Coverage Failing in CI

```bash
# Problem: Passes locally, fails in CI
# Solution: Same Node version

# .github/workflows/test.yml
- uses: actions/setup-node@v4
  with:
    node-version: '20' # Match local version
```

## Coverage Badges

### Codecov Badge

```markdown
# README.md
[![codecov](https://codecov.io/gh/hospeda/hospeda/branch/main/graph/badge.svg)](https://codecov.io/gh/hospeda/hospeda)
```

### Custom Badge

```markdown
![Coverage](https://img.shields.io/badge/coverage-92%25-brightgreen)
```

### Dynamic Badge from CI

```yaml
# .github/workflows/coverage-badge.yml
name: Update Coverage Badge

on:
  push:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2

      - name: Generate coverage
        run: pnpm test:coverage

      - name: Extract coverage
        id: coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "coverage=$COVERAGE" >> $GITHUB_OUTPUT

      - name: Create badge
        uses: schneegans/dynamic-badges-action@v1.6.0
        with:
          auth: ${{ secrets.GIST_SECRET }}
          gistID: your-gist-id
          filename: coverage.json
          label: Coverage
          message: ${{ steps.coverage.outputs.coverage }}%
          color: brightgreen
```

## Best Practices

### DO ✅

```typescript
// Test all branches
it('should handle positive', () => { ... });
it('should handle negative', () => { ... });
it('should handle zero', () => { ... });

// Test error paths
it('should throw on invalid input', () => { ... });

// Test edge cases
it('should handle empty array', () => { ... });
it('should handle null value', () => { ... });

// Meaningful assertions
expect(result.success).toBe(true);
expect(result.data.name).toBe('Hotel Paradise');

// Check coverage regularly
pnpm test:coverage
```

### DON'T ❌

```typescript
// Don't test for coverage sake
it('executes', () => {
  service.method(); // No assertion ❌
});

// Don't ignore uncovered code
/* c8 ignore next */
function importantBusinessLogic() { ... } // ❌

// Don't lower thresholds
coverage: {
  thresholds: {
    statements: 70 // ❌ Must be 90%
  }
}

// Don't skip difficult tests
it.skip('hard to test', () => { ... }); // ❌
```

## Summary

- **90% minimum** across all metrics (statements, branches, functions, lines)
- **Enforced** in local development, CI/CD, and branch protection
- **Coverage ≠ Quality**: Write meaningful tests, not just coverage tests
- **Use HTML reports** to identify and fix gaps
- **No exceptions**: All production code must meet threshold

## Next Steps

- [Unit Testing](./unit-testing.md) - Write testable code
- [Integration Testing](./integration-testing.md) - Test with real dependencies
- [Testing Strategy](./strategy.md) - Overall testing approach

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Testing Philosophy](./README.md)
- [TDD Workflow](.claude/docs/workflows/phase-2-implementation.md)
