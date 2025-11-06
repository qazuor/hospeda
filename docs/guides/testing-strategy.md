# Testing Strategy Guide

Simplified, practical testing strategy guide for the Hospeda platform. This guide complements the comprehensive [Testing Strategy](../testing/strategy.md) documentation with hands-on, actionable guidance.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Types Overview](#test-types-overview)
- [The Test Pyramid](#the-test-pyramid)
- [Writing Your First Test](#writing-your-first-test)
- [Testing Services](#testing-services)
- [Testing API Routes](#testing-api-routes)
- [Testing React Components](#testing-react-components)
- [Coverage Requirements](#coverage-requirements)
- [Running Tests](#running-tests)
- [Debugging Tests](#debugging-tests)
- [Best Practices](#best-practices)
- [Common Mistakes](#common-mistakes)
- [Resources](#resources)

## Quick Start

Get testing immediately with this 5-minute quick start:

### 1. Install Dependencies

Already done if you've cloned the repo:

```bash
pnpm install
```

### 2. Run Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode (recommended during development)
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

### 3. Write Your First Test

Create a test file next to your source file:

```typescript
// src/utils/slugify.ts
export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}
```

```typescript
// test/utils/slugify.test.ts
import { describe, it, expect } from 'vitest';
import { slugify } from '../../src/utils/slugify';

describe('slugify', () => {
  it('should convert text to slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });
});
```

### 4. Run Your Test

```bash
pnpm test slugify
```

```text
✅ PASS  test/utils/slugify.test.ts
  slugify
    ✓ should convert text to slug (2ms)
```

You're testing! 🎉

## Test Types Overview

Hospeda uses three types of tests, following the **test pyramid** principle:

### Unit Tests (70% of tests)

**What:** Test individual functions/methods in isolation.

**When:** Testing pure functions, utility methods, validation logic.

**Speed:** Very fast (< 100ms per test)

**Example:**

```typescript
describe('calculateDiscount', () => {
  it('should calculate 20% discount', () => {
    const price = 100;
    const discount = 0.2;

    const result = calculateDiscount(price, discount);

    expect(result).toBe(80);
  });
});
```

**Characteristics:**

- No database access
- No external services
- Mock all dependencies
- Test one thing at a time

### Integration Tests (25% of tests)

**What:** Test multiple components working together.

**When:** Testing services, database operations, business workflows.

**Speed:** Moderate (< 1s per test)

**Example:**

```typescript
describe('AccommodationService Integration', () => {
  let service: AccommodationService;

  beforeEach(async () => {
    await db.clearAll();
    service = new AccommodationService(ctx);
  });

  it('should create and retrieve accommodation', async () => {
    const created = await service.create({ actor, data: validData });

    const found = await service.findById({ actor, id: created.data.id });

    expect(found.data?.name).toBe(validData.name);
  });
});
```

**Characteristics:**

- Use real database (test database)
- Real models and services
- Mock external services (payment, email)
- Test interactions between components

### E2E Tests (5% of tests)

**What:** Test complete user flows through the system.

**When:** Testing critical paths, API endpoints, user workflows.

**Speed:** Slow (3-10s per test)

**Example:**

```typescript
describe('Accommodation Creation Flow E2E', () => {
  it('should create accommodation via API', async () => {
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(accommodationData)
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.name).toBe(accommodationData.name);

    // Verify in database
    const saved = await db.query.accommodations.findFirst({
      where: eq(accommodations.id, data.id)
    });

    expect(saved).toBeDefined();
  });
});
```

**Characteristics:**

- Real HTTP requests
- Real database
- Real authentication
- Test complete flows

## The Test Pyramid

Visual representation of our testing strategy:

```text
       /\
      /  \  E2E (5%)
     /----\  Critical paths
    /      \  User flows
   /--------\
  / Integra \ (25%)
 /    tion   \ Services + DB
/____________\ Real components
      Unit      (70%)
   Functions   Fast & isolated
    Methods    Pure logic
```

### Why This Distribution?

**70% Unit Tests:**

- Fast feedback loop
- Easy to write and maintain
- Pinpoint failures precisely
- Run constantly during development

**25% Integration Tests:**

- Test realistic scenarios
- Catch integration issues
- Verify database operations
- Balance speed vs confidence

**5% E2E Tests:**

- Highest confidence
- Test critical paths only
- Expensive to run and maintain
- Run on CI/CD

### Choosing the Right Test Type

| What You're Testing | Test Type | Why |
|---------------------|-----------|-----|
| Pure function | Unit | Fast, isolated, focused |
| Utility method | Unit | No dependencies |
| Business logic | Unit | Easy to test |
| Service method (with DB) | Integration | Need real DB behavior |
| Multiple services | Integration | Test interactions |
| API endpoint | Integration or E2E | Test HTTP layer |
| User workflow | E2E | Test complete flow |
| Payment processing | E2E | Critical path |

## Writing Your First Test

Let's write a complete test from scratch.

### Step 1: Choose What to Test

Pick a simple, isolated function first:

```typescript
// packages/utils/src/format/currency.ts
export function formatCurrency(amount: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency
  }).format(amount);
}
```

### Step 2: Create Test File

Mirror the source file structure:

```text
packages/utils/
├── src/
│   └── format/
│       └── currency.ts
└── test/
    └── format/
        └── currency.test.ts
```

### Step 3: Write Test Structure

```typescript
// packages/utils/test/format/currency.test.ts
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../../src/format/currency';

describe('formatCurrency', () => {
  // Tests will go here
});
```

### Step 4: Write First Test (Happy Path)

```typescript
describe('formatCurrency', () => {
  it('should format amount in ARS', () => {
    const result = formatCurrency(1234.56);

    expect(result).toBe('$ 1.234,56');
  });
});
```

### Step 5: Run Test

```bash
cd packages/utils
pnpm test currency
```

```text
✅ PASS  test/format/currency.test.ts
  formatCurrency
    ✓ should format amount in ARS (5ms)
```

### Step 6: Add Edge Cases

```typescript
describe('formatCurrency', () => {
  it('should format amount in ARS', () => {
    expect(formatCurrency(1234.56)).toBe('$ 1.234,56');
  });

  it('should format amount in USD', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('US$ 1.234,56');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$ 0,00');
  });

  it('should handle negative amounts', () => {
    expect(formatCurrency(-1234.56)).toBe('-$ 1.234,56');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1234567.89)).toBe('$ 1.234.567,89');
  });
});
```

### Step 7: Run All Tests

```bash
pnpm test currency
```

```text
✅ PASS  test/format/currency.test.ts
  formatCurrency
    ✓ should format amount in ARS (3ms)
    ✓ should format amount in USD (2ms)
    ✓ should handle zero (1ms)
    ✓ should handle negative amounts (2ms)
    ✓ should handle large numbers (2ms)

Tests: 5 passed, 5 total
```

### Step 8: Check Coverage

```bash
pnpm test:coverage -- currency
```

```text
File: src/format/currency.ts
Coverage: 100%
```

Done! You've written your first comprehensive test suite.

## Testing Services

Services are the core of Hospeda's business logic. Here's how to test them properly.

### Basic Service Test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AccommodationService } from '../../src/services/accommodation';
import { setupTestDatabase, cleanupTestDatabase } from '@repo/db/test-utils';
import { createAdminActor, createTestAccommodation } from '../factories';

describe('AccommodationService', () => {
  let service: AccommodationService;
  let ctx: ServiceContext;
  let db: Database;

  beforeEach(async () => {
    db = await setupTestDatabase();
    ctx = { logger: createTestLogger() };
    service = new AccommodationService(ctx);
  });

  afterEach(async () => {
    await cleanupTestDatabase(db);
  });

  describe('create', () => {
    it('should create accommodation with valid data', async () => {
      // ARRANGE
      const actor = createAdminActor();
      const data = {
        name: 'Test Hotel',
        slug: 'test-hotel',
        description: 'A test hotel with a long enough description',
        address: '123 Main St',
        city: 'Buenos Aires',
        state: 'Buenos Aires',
        priceRange: '$$' as const
      };

      // ACT
      const result = await service.create({ actor, data });

      // ASSERT
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.name).toBe('Test Hotel');
      expect(result.data?.id).toBeDefined();
    });
  });
});
```

### Testing Error Cases

```typescript
it('should reject invalid data', async () => {
  const actor = createAdminActor();
  const invalidData = {
    name: '', // Invalid: empty
    description: 'Short' // Invalid: too short
  };

  const result = await service.create({
    actor,
    data: invalidData as any
  });

  expect(result.error).toBeDefined();
  expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
});
```

### Testing Permissions

```typescript
it('should reject create without permission', async () => {
  const actor = createUserActor(); // Regular user, not admin
  const data = validAccommodationData;

  const result = await service.create({ actor, data });

  expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
});
```

### Testing Business Logic

```typescript
it('should prevent duplicate slug', async () => {
  const actor = createAdminActor();
  const data = { name: 'Hotel', slug: 'hotel', /* ... */ };

  // Create first accommodation
  await service.create({ actor, data });

  // Try to create with same slug
  const result = await service.create({ actor, data });

  expect(result.error?.code).toBe(ServiceErrorCode.ALREADY_EXISTS);
  expect(result.error?.message).toContain('slug');
});
```

### Mocking Dependencies

```typescript
describe('BookingService', () => {
  let mockPaymentService: PaymentService;

  beforeEach(() => {
    mockPaymentService = {
      charge: vi.fn().mockResolvedValue({
        data: { id: 'payment-123', status: 'success' }
      })
    } as unknown as PaymentService;
  });

  it('should charge payment on booking', async () => {
    const service = new BookingService(ctx, mockPaymentService);

    await service.createBooking({ actor, data: bookingData });

    expect(mockPaymentService.charge).toHaveBeenCalledWith({
      amount: 100,
      currency: 'ARS'
    });
  });
});
```

## Testing API Routes

Hospeda uses Hono for API routes. Here's how to test them.

### Basic Route Test

```typescript
import { describe, it, expect } from 'vitest';
import { app } from '../../src/index';

describe('GET /api/v1/accommodations', () => {
  it('should list accommodations', async () => {
    // Create test data
    await createTestAccommodation({ name: 'Hotel 1' });
    await createTestAccommodation({ name: 'Hotel 2' });

    // Make request
    const response = await app.request('/api/v1/accommodations');

    // Assert response
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
  });
});
```

### Testing POST Requests

```typescript
it('should create accommodation via POST', async () => {
  const accommodationData = {
    name: 'New Hotel',
    slug: 'new-hotel',
    description: 'A new hotel description',
    address: '123 Main St',
    city: 'Buenos Aires',
    state: 'Buenos Aires',
    priceRange: '$$'
  };

  const response = await app.request('/api/v1/accommodations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(accommodationData)
  });

  expect(response.status).toBe(201);

  const data = await response.json();
  expect(data.success).toBe(true);
  expect(data.data.name).toBe('New Hotel');
});
```

### Testing Authentication

```typescript
it('should reject unauthenticated request', async () => {
  const response = await app.request('/api/v1/accommodations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // No Authorization header
    body: JSON.stringify(accommodationData)
  });

  expect(response.status).toBe(401);

  const data = await response.json();
  expect(data.error.code).toBe('UNAUTHORIZED');
});
```

### Testing Validation

```typescript
it('should validate request body', async () => {
  const invalidData = {
    name: '', // Invalid
    description: 'Short' // Invalid
  };

  const response = await app.request('/api/v1/accommodations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(invalidData)
  });

  expect(response.status).toBe(400);

  const data = await response.json();
  expect(data.error.code).toBe('VALIDATION_ERROR');
});
```

### Testing Pagination

```typescript
it('should paginate results', async () => {
  // Create 25 accommodations
  for (let i = 1; i <= 25; i++) {
    await createTestAccommodation({ name: `Hotel ${i}` });
  }

  const response = await app.request('/api/v1/accommodations?page=2&pageSize=10');

  expect(response.status).toBe(200);

  const data = await response.json();
  expect(data.data).toHaveLength(10);
  expect(data.pagination.page).toBe(2);
  expect(data.pagination.total).toBe(25);
  expect(data.pagination.totalPages).toBe(3);
});
```

## Testing React Components

Component testing ensures UI behaves correctly.

### Basic Component Test

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  it('should render accommodation details', () => {
    const accommodation = {
      id: '1',
      name: 'Test Hotel',
      city: 'Buenos Aires',
      priceRange: '$$',
      rating: 4.5
    };

    render(<AccommodationCard accommodation={accommodation} />);

    expect(screen.getByText('Test Hotel')).toBeInTheDocument();
    expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('$$')).toBeInTheDocument();
  });
});
```

### Testing User Interaction

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

it('should call onClick when clicked', () => {
  const onClick = vi.fn();

  render(<AccommodationCard accommodation={accommodation} onClick={onClick} />);

  const card = screen.getByRole('article');
  fireEvent.click(card);

  expect(onClick).toHaveBeenCalledWith(accommodation);
});
```

### Testing Forms

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

it('should submit form with valid data', async () => {
  const onSubmit = vi.fn();

  render(<AccommodationForm onSubmit={onSubmit} />);

  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'Test Hotel' }
  });

  fireEvent.change(screen.getByLabelText('City'), {
    target: { value: 'Buenos Aires' }
  });

  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Test Hotel',
      city: 'Buenos Aires'
    });
  });
});
```

### Testing Async Data Loading

```typescript
it('should show loading state then data', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    data: { name: 'Test Hotel' }
  });

  render(<AccommodationDetails id="1" fetchAccommodation={mockFetch} />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText('Test Hotel')).toBeInTheDocument();
  });
});
```

## Coverage Requirements

Hospeda enforces a **90% minimum coverage** requirement across all packages.

### Why 90%?

- **High confidence** in code quality
- **Industry standard** for production systems
- **Forces testing** of edge cases
- **Safety net** for refactoring

### Checking Coverage

```bash
# Run tests with coverage
pnpm test:coverage

# Output shows coverage per file
File                     | % Stmts | % Branch | % Funcs | % Lines
-------------------------|---------|----------|---------|--------
src/models/accommodation | 95.5    | 92.3     | 96.2    | 95.5
src/services/accommodation| 91.2   | 89.7     | 93.1    | 91.2
-------------------------|---------|----------|---------|--------
All files                | 93.4    | 91.0     | 94.7    | 93.4
```

### Viewing Coverage Report

```bash
# Generate HTML coverage report
pnpm test:coverage

# Open in browser
open coverage/index.html
```

**Coverage report shows:**

- 🟢 Green: Covered lines
- 🔴 Red: Not covered lines
- 🟡 Yellow: Partially covered (some branches)

### Improving Coverage

**Step 1:** Find uncovered code

```bash
pnpm test:coverage
open coverage/index.html
```

**Step 2:** Navigate to file with low coverage

**Step 3:** Write tests for red/yellow lines

```typescript
// Coverage shows line 42 not covered
if (accommodation.isDeleted) {  // Line 42
  return null;
}

// Add test:
it('should return null when accommodation is deleted', async () => {
  const accommodation = await createTestAccommodation({
    deletedAt: new Date()
  });

  const result = await service.findById({ actor, id: accommodation.id });

  expect(result.data).toBeNull();
});
```

### Coverage Thresholds

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
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

**What happens if coverage < 90%:**

- Tests fail locally
- Pre-commit hook blocks commit
- CI/CD pipeline fails
- PR cannot be merged

## Running Tests

### Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test accommodation.service

# Run specific test suite
pnpm test "AccommodationService"

# Run specific test case
pnpm test "should create accommodation"
```

### Watch Mode

Recommended for development:

```bash
pnpm test:watch
```

**Features:**

- Auto-runs on file changes
- Fast incremental testing
- Filter by filename or test name
- Focus on failing tests

**Keyboard shortcuts:**

- `a` - Run all tests
- `f` - Run only failed tests
- `p` - Filter by filename
- `t` - Filter by test name
- `q` - Quit watch mode

### Per-Package Testing

```bash
# Test specific package
cd packages/service-core
pnpm test

# From project root
cd packages/service-core && pnpm test
```

### CI/CD Testing

Tests run automatically on:

- Every commit (pre-commit hook)
- Every push (GitHub Actions)
- Every PR (GitHub Actions)

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: pnpm test

- name: Check coverage
  run: pnpm test:coverage
```

## Debugging Tests

### Using Console Logs

```typescript
it('should calculate total', () => {
  const items = [{ price: 10 }, { price: 20 }];

  console.log('Items:', items);

  const total = calculateTotal(items);

  console.log('Total:', total);

  expect(total).toBe(30);
});
```

### Using Debugger

```typescript
it('should calculate total', () => {
  debugger; // Execution pauses here

  const total = calculateTotal(items);

  expect(total).toBe(30);
});
```

Run with Node debugger:

```bash
node --inspect-brk ./node_modules/.bin/vitest run
```

### Isolating Tests

Focus on one test:

```typescript
it.only('should calculate total', () => {
  // Only this test runs
});
```

Skip tests:

```typescript
it.skip('should calculate total', () => {
  // This test is skipped
});
```

**Warning:** Don't commit `.only` or `.skip`!

### Verbose Output

```bash
pnpm test -- --reporter=verbose
```

Shows detailed test execution information.

## Best Practices

### Quick Checklist

✅ **DO:**

- Write tests first (TDD)
- Follow AAA pattern (Arrange-Act-Assert)
- Test behavior, not implementation
- Use descriptive test names
- Keep tests simple and focused
- Mock external dependencies
- Clean up after each test
- Maintain 90% coverage
- Run tests frequently

❌ **DON'T:**

- Skip tests (`.skip`)
- Use `.only` in commits
- Test implementation details
- Share state between tests
- Ignore failing tests
- Test third-party libraries
- Use real external services in tests
- Commit with test failures

### Test Naming Convention

Use: `should [expected behavior] when [condition]`

```typescript
// Good ✅
it('should create accommodation with valid data', () => {});
it('should reject empty name', () => {});
it('should return null when not found', () => {});

// Bad ❌
it('creates accommodation', () => {});
it('test update', () => {});
it('works', () => {});
```

### Test Organization

```typescript
describe('AccommodationService', () => {
  describe('create', () => {
    it('should create with valid data', () => {});
    it('should validate required fields', () => {});
    it('should check permissions', () => {});
  });

  describe('update', () => {
    it('should update existing accommodation', () => {});
    it('should reject non-existent accommodation', () => {});
  });
});
```

### AAA Pattern

```typescript
it('should calculate discount', () => {
  // ARRANGE: Set up test data
  const price = 100;
  const discountRate = 0.2;

  // ACT: Execute operation
  const result = calculateDiscount(price, discountRate);

  // ASSERT: Verify outcome
  expect(result).toBe(80);
});
```

## Common Mistakes

### Mistake 1: Not Running Tests First

```typescript
// ❌ Write implementation first
async create(data) {
  return this.model.create(data);
}

// Then write test
it('should create', async () => {
  // Test follows implementation
});
```

**Fix:** Write test first (TDD)

### Mistake 2: Testing Implementation

```typescript
// ❌ Testing internal method
it('should call validateEmail', () => {
  const spy = vi.spyOn(service, 'validateEmail' as any);
  service.create({ data });
  expect(spy).toHaveBeenCalled();
});
```

**Fix:** Test behavior

```typescript
// ✅ Testing actual behavior
it('should reject invalid email', async () => {
  const result = await service.create({
    actor,
    data: { email: 'invalid' }
  });

  expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
});
```

### Mistake 3: Shared State

```typescript
// ❌ Shared state between tests
let accommodation: Accommodation;

it('should create', async () => {
  accommodation = await service.create({ actor, data });
});

it('should update', async () => {
  // Depends on previous test!
  await service.update({ actor, id: accommodation.id, data });
});
```

**Fix:** Independent tests

```typescript
// ✅ Each test is independent
it('should update', async () => {
  const accommodation = await createTestAccommodation();
  await service.update({ actor, id: accommodation.id, data });
});
```

### Mistake 4: Too Many Assertions

```typescript
// ❌ Testing too much
it('should handle accommodation lifecycle', async () => {
  const created = await service.create({ actor, data });
  expect(created.data).toBeDefined();

  const updated = await service.update({ actor, id: created.id, data });
  expect(updated.data).toBeDefined();

  const deleted = await service.delete({ actor, id: created.id });
  expect(deleted.error).toBeUndefined();
  // Too much!
});
```

**Fix:** One test per behavior

```typescript
// ✅ Focused tests
it('should create accommodation', async () => {
  const result = await service.create({ actor, data });
  expect(result.data).toBeDefined();
});

it('should update accommodation', async () => {
  const accommodation = await createTestAccommodation();
  const result = await service.update({ actor, id: accommodation.id, data });
  expect(result.data).toBeDefined();
});
```

## Resources

### Documentation

- [Comprehensive Testing Strategy](../testing/strategy.md)
- [TDD Workflow Guide](./tdd-workflow.md)
- [Unit Testing Guide](../testing/unit-testing.md)
- [Integration Testing Guide](../testing/integration-testing.md)
- [Test Factories](../testing/test-factories.md)

### External Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com)
- [Test-Driven Development by Kent Beck](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)

### Tools

- **Vitest** - Test runner
- **Testing Library** - Component testing
- **Codecov** - Coverage tracking
- **GitHub Actions** - CI/CD

---

**Last Updated:** 2024-11-06

**Maintained By:** QA Team

**Related Documentation:**

- [Testing Strategy](../testing/strategy.md)
- [TDD Workflow](./tdd-workflow.md)
- [Code Standards](../development/code-standards.md)
