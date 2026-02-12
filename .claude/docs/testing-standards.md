# Testing Standards

This document defines the testing standards and practices for TypeScript projects. All code must be tested according to these rules.

**The Iron Rule: No tests = Not done.** A task, feature, fix, or change is NEVER considered complete without tests. This is non-negotiable.

---

## Table of Contents

1. [The Iron Rule](#the-iron-rule)
2. [Testing Philosophy](#testing-philosophy)
3. [SDD + TDD Integration](#sdd--tdd-integration)
4. [TDD Workflow](#tdd-workflow)
5. [Test Types](#test-types)
6. [Coverage Requirements](#coverage-requirements)
7. [Test Structure](#test-structure)
8. [Naming Conventions](#naming-conventions)
9. [Test Patterns](#test-patterns)
10. [Mocking and Fixtures](#mocking-and-fixtures)
11. [Database Testing](#database-testing)
12. [API Testing](#api-testing)
13. [Common Pitfalls](#common-pitfalls)

---

## The Iron Rule

**No tests = Not done.** This rule has zero exceptions.

| Change Type | Required Tests |
|---|---|
| **Any code change** | Unit tests for all new/modified public functions |
| **Service/business logic** | Unit tests + integration tests with dependencies |
| **API endpoints** | Integration tests for all endpoints (success, error, auth, validation) |
| **Database changes** | Unit tests for model methods + integration tests for queries |
| **Frontend components** | Unit tests for logic + interaction tests |
| **User-facing flows** | E2E tests for critical paths |
| **Bug fixes** | Regression test that reproduces the bug and verifies the fix |

**Without tests, the quality gate WILL reject task completion.** Implementation and tests are committed together as a single atomic unit.

---

## Testing Philosophy

### Core Principles

**Spec Driven Development + Test Driven Development (SDD + TDD):**

- The specification defines WHAT to test (acceptance criteria, edge cases, error scenarios)
- TDD defines HOW to implement (write tests first, then code)
- Together they ensure every piece of code is both specified and tested

**Test-Driven Development (TDD):**

- Write tests FIRST, before implementation
- Follow Red -> Green -> Refactor cycle
- Tests define the interface and behavior
- If a test is hard to write, the design needs improvement

**90% Minimum Coverage:**

- Unit tests: All public functions
- Integration tests: All API endpoints
- E2E tests: Critical user flows

**Test Quality Over Quantity:**

- Tests should be maintainable and readable
- Tests should test behavior, not implementation

---

## SDD + TDD Integration

The development workflow combines Spec Driven Development with Test Driven Development:

```
Spec defines acceptance criteria (SDD)
  ↓
Acceptance criteria become test cases
  ↓
Tests are written BEFORE implementation (TDD - RED)
  ↓
Implementation makes tests pass (TDD - GREEN)
  ↓
Code is improved with tests as safety net (TDD - REFACTOR)
  ↓
Quality gate verifies all tests pass + new tests exist
```

### How Spec Criteria Map to Tests

| Spec Element | Test Type |
|---|---|
| User story acceptance criteria (Given/When/Then) | Unit tests and integration tests |
| API endpoint definitions | Integration tests (success, error, auth, validation) |
| Data model validation rules | Unit tests for validation functions |
| Error handling scenarios | Unit tests for each error path |
| Edge cases | Dedicated edge case tests |
| User flows | E2E tests |
| Performance requirements | Performance/load tests |

### Example: From Spec to Tests

**Spec acceptance criterion:**
> Given a user with valid credentials, When they submit the login form, Then they receive a JWT token and are redirected to the dashboard.

**Tests derived:**

```typescript
describe('AuthService.login', () => {
  it('should return JWT token for valid credentials', async () => { /* ... */ });
  it('should reject invalid password', async () => { /* ... */ });
  it('should reject non-existent email', async () => { /* ... */ });
  it('should reject locked accounts', async () => { /* ... */ });
});

describe('POST /api/auth/login', () => {
  it('should return 200 with token for valid login', async () => { /* ... */ });
  it('should return 401 for invalid credentials', async () => { /* ... */ });
  it('should return 400 for missing fields', async () => { /* ... */ });
});
```

---

## TDD Workflow

### Red -> Green -> Refactor

```
1. RED: Write a failing test
   - Define what you want to build
   - Test should fail (no implementation yet)

2. GREEN: Write minimum code to pass
   - Implement just enough to make test pass
   - Do not worry about perfection yet

3. REFACTOR: Improve the code
   - Clean up implementation
   - Tests stay green
   - Improve design
```

### Example TDD Cycle

```typescript
// 1. RED: Write failing test
describe('UserService', () => {
  it('should create user with valid data', async () => {
    const input = { name: 'John Doe', email: 'john@example.com' };
    const result = await userService.create({ input });
    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('john@example.com');
  });
});

// 2. GREEN: Implement minimum code
// 3. REFACTOR: Add validation, error handling, etc.
```

---

## Test Types

### Unit Tests

- **Purpose:** Test individual functions/methods in isolation
- **Speed:** Fast (< 1ms per test)
- **Dependencies:** Mock all external dependencies
- **Coverage:** All public functions

### Integration Tests

- **Purpose:** Test interaction between components
- **Speed:** Moderate (< 100ms per test)
- **Dependencies:** Real database (test instance), mock only external APIs
- **Coverage:** All API endpoints, service interactions

### E2E Tests

- **Purpose:** Test complete user flows
- **Speed:** Slow (1-5 seconds per test)
- **Dependencies:** Real browser, real API calls
- **Coverage:** Critical user journeys

---

## Coverage Requirements

### Minimum Coverage: 90%

**What to test:**

- All public functions/methods
- All API endpoints
- All business logic paths
- All error cases and edge cases

**What NOT to test:**

- Private functions (test through public API)
- Type definitions
- Third-party libraries
- Constants

### Coverage by Layer

| Layer | Unit | Integration | E2E |
|-------|------|-------------|-----|
| Models | All methods | Database operations | - |
| Services | All methods | With database | - |
| API Routes | Logic | Endpoints | Critical flows |
| Components | Logic | User interactions | Main flows |

---

## Test Structure

### AAA Pattern (Arrange, Act, Assert)

**Always use AAA structure:**

```typescript
it('should create user with valid data', async () => {
  // ARRANGE: Setup test data and dependencies
  const input = { name: 'John Doe', email: 'john@example.com' };
  const mockUser = createTestUser({ role: 'admin' });

  // ACT: Execute the function being tested
  const result = await userService.create({ input, user: mockUser });

  // ASSERT: Verify the result
  expect(result.user).toBeDefined();
  expect(result.user.name).toBe('John Doe');
});
```

### Test File Organization

Tests should mirror the source directory structure:

```
src/
  services/
    user-service.ts
  utils/
    validators.ts
test/
  services/
    user-service.test.ts
  utils/
    validators.test.ts
```

### Vitest / Jest Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.config.ts'],
    },
  },
});
```

---

## Naming Conventions

### Test File Names

```
{module-name}.test.ts
{module-name}.integration.test.ts
{module-name}.e2e.test.ts
```

### Test Descriptions

```typescript
// GOOD: Descriptive, behavior-focused
describe('UserService', () => {
  describe('create', () => {
    it('should create user with valid data', async () => {});
    it('should throw error when email already exists', async () => {});
    it('should throw error when user lacks permissions', async () => {});
  });
});

// BAD: Implementation-focused
describe('UserService', () => {
  it('test create', async () => {});
  it('test validation', async () => {});
});
```

---

## Test Patterns

### Setup and Teardown

```typescript
describe('UserService', () => {
  let service: UserService;
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  beforeEach(async () => {
    service = new UserService({ db });
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await db.destroy();
  });
});
```

### Parameterized Tests

```typescript
describe('validateEmail', () => {
  const testCases = [
    { email: 'valid@example.com', expected: true },
    { email: 'invalid', expected: false },
    { email: '@example.com', expected: false },
  ];

  testCases.forEach(({ email, expected }) => {
    it(`should return ${expected} for "${email}"`, () => {
      expect(validateEmail(email)).toBe(expected);
    });
  });
});
```

### Testing Errors

```typescript
it('should throw NOT_FOUND when user does not exist', async () => {
  await expect(
    service.findById({ id: 'non-existent-id' })
  ).rejects.toThrow('not found');
});
```

---

## Mocking and Fixtures

### Mock External Dependencies

```typescript
import { vi } from 'vitest';

beforeEach(() => {
  emailService = {
    sendConfirmation: vi.fn(),
  } as unknown as EmailService;
});

it('should send confirmation email', async () => {
  await service.create({ input, user });
  expect(emailService.sendConfirmation).toHaveBeenCalledWith(
    expect.objectContaining({ to: user.email })
  );
});
```

### Test Fixtures

```typescript
// test/fixtures/user.fixture.ts
export const createTestUser = (overrides?: Partial<User>): User => ({
  id: randomUUID(),
  name: 'Test User',
  email: 'test@example.com',
  role: 'editor',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
```

---

## Database Testing

### Use Test Database

```typescript
export const setupTestDatabase = async () => {
  const testDb = await createConnection({
    host: 'localhost',
    port: 5433,
    database: 'app_test',
  });
  await migrate(testDb);
  return testDb;
};
```

### Transaction Rollback Pattern

```typescript
describe('UserService', () => {
  let trx: Transaction;

  beforeEach(async () => { trx = await db.transaction(); });
  afterEach(async () => { await trx.rollback(); });

  it('should create user', async () => {
    const service = new UserService({ db: trx });
    // Changes are rolled back after test
  });
});
```

---

## API Testing

```typescript
describe('POST /api/users', () => {
  it('should create user with valid data', async () => {
    const response = await app.request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('should return 401 when not authenticated', async () => {
    const response = await app.request('/api/users', { method: 'POST', body: '{}' });
    expect(response.status).toBe(401);
  });

  it('should return 400 when validation fails', async () => {
    const response = await app.request('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(response.status).toBe(400);
  });
});
```

---

## Common Pitfalls

### Testing Implementation Details

```typescript
// BAD: Testing private methods
expect(spy).toHaveBeenCalled();

// GOOD: Testing behavior
await expect(service.create({ input: { email: 'invalid' } })).rejects.toThrow('Invalid email');
```

### Brittle Tests

```typescript
// BAD: Too specific
expect(result).toEqual({ id: '123', name: 'John', createdAt: new Date('2024-01-01') });

// GOOD: Focus on important parts
expect(result).toMatchObject({ name: 'John' });
expect(result.id).toBeDefined();
```

### Shared State

```typescript
// BAD: Tests affect each other
beforeAll(() => { user = createTestUser(); });

// GOOD: Fresh state per test
beforeEach(() => { user = createTestUser(); });
```

---

## Summary Checklist

Before considering testing complete:

- [ ] 90%+ code coverage
- [ ] All public functions tested
- [ ] All API endpoints tested
- [ ] All error cases tested
- [ ] All edge cases tested
- [ ] Tests follow AAA pattern
- [ ] Tests are independent (no shared mutable state)
- [ ] Tests are fast (< 100ms unit, < 1s integration)
- [ ] No flaky tests
- [ ] Tests document behavior

---

**No tests = Not done. TDD is mandatory. Tests must be written BEFORE implementation.**

The development workflow uses SDD+TDD: the spec defines what to test, TDD ensures tests are written before implementation, and the quality gate enforces that no code ships without tests. See [development-workflow.md](development-workflow.md) for the full workflow.
