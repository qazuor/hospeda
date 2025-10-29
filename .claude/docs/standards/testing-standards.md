# Testing Standards

This document defines the testing standards and practices for the Hospeda project.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [TDD Workflow](#tdd-workflow)
3. [Test Types](#test-types)
4. [Coverage Requirements](#coverage-requirements)
5. [Test Structure](#test-structure)
6. [Naming Conventions](#naming-conventions)
7. [Test Patterns](#test-patterns)
8. [Mocking & Fixtures](#mocking--fixtures)
9. [Database Testing](#database-testing)
10. [API Testing](#api-testing)
11. [Frontend Testing](#frontend-testing)
12. [Common Pitfalls](#common-pitfalls)

---

## Testing Philosophy

### Core Principles

**Test-Driven Development (TDD):**

- Write tests FIRST, before implementation
- Follow Red → Green → Refactor cycle
- Tests define the interface and behavior

**90% Minimum Coverage:**

- Unit tests: All public functions
- Integration tests: All API endpoints
- E2E tests: Critical user flows

**Test Quality Over Quantity:**

- Tests should be maintainable
- Tests should be readable
- Tests should test behavior, not implementation

---

## TDD Workflow

### Red → Green → Refactor

```text

1. RED: Write a failing test
   - Define what you want to build
   - Test should fail (no implementation yet)

2. GREEN: Write minimum code to pass
   - Implement just enough to make test pass
   - Don't worry about perfection yet

3. REFACTOR: Improve the code
   - Clean up implementation
   - Tests stay green
   - Improve design

```text

### Example TDD Cycle

```typescript
// 1. RED: Write failing test
describe('UserService', () => {
  it('should create user with valid data', async () => {
    const input = {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'host' as const,
    };

    const result = await userService.create({ input, user: adminUser });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe('john@example.com');
  });
});

// 2. GREEN: Implement minimum code
async create({ input, user }) {
  const newUser = await this.model.create(input);
  return { user: newUser };
}

// 3. REFACTOR: Add validation, error handling, etc.
async create({ input, user }) {
  // Validate input
  if (!input.email.includes('@')) {
    throw new ServiceError('Invalid email', ServiceErrorCode.VALIDATION_ERROR);
  }

  // Check permissions
  if (user.role !== 'admin') {
    throw new ServiceError('Forbidden', ServiceErrorCode.FORBIDDEN);
  }

  // Create user
  const newUser = await this.model.create(input);

  return { user: newUser };
}
```text

---

## Test Types

### Unit Tests

**Purpose:** Test individual functions/methods in isolation

**Characteristics:**

- Fast (< 1ms per test)
- No external dependencies
- Mock all dependencies
- Test single responsibility

**Example:**

```typescript
describe('calculateBookingPrice', () => {
  it('should calculate price for 3 nights', () => {
    const input = {
      pricePerNight: 100,
      nights: 3,
    };

    const result = calculateBookingPrice(input);

    expect(result.totalPrice).toBe(300);
  });

  it('should apply discount for 7+ nights', () => {
    const input = {
      pricePerNight: 100,
      nights: 7,
    };

    const result = calculateBookingPrice(input);

    expect(result.totalPrice).toBe(630); // 10% discount
    expect(result.discount).toBe(70);
  });
});
```text

### Integration Tests

**Purpose:** Test interaction between components

**Characteristics:**

- Moderate speed (< 100ms per test)
- Real database (test database)
- Real services
- Mock only external APIs

**Example:**

```typescript
describe('AccommodationService Integration', () => {
  let service: AccommodationService;
  let testDb: Database;

  beforeEach(async () => {
    testDb = await createTestDatabase();
    service = new AccommodationService({ db: testDb });
  });

  afterEach(async () => {
    await testDb.destroy();
  });

  it('should create accommodation and retrieve it', async () => {
    // Arrange
    const input = {
      name: 'Beach House',
      type: 'house' as const,
      capacity: 6,
      pricePerNight: 150,
    };

    // Act - Create
    const created = await service.create({ input, user: hostUser });

    // Act - Retrieve
    const retrieved = await service.findById({ id: created.accommodation.id });

    // Assert
    expect(retrieved.accommodation.name).toBe('Beach House');
    expect(retrieved.accommodation.capacity).toBe(6);
  });
});
```text

### E2E Tests

**Purpose:** Test complete user flows

**Characteristics:**

- Slow (1-5 seconds per test)
- Real browser (Playwright/Cypress)
- Real API calls
- Test from user perspective

**Example:**

```typescript
describe('Booking Flow', () => {
  it('should allow user to search, view, and book accommodation', async () => {
    // 1. Navigate to search
    await page.goto('/accommodations');

    // 2. Search for accommodation
    await page.fill('[name="search"]', 'Beach House');
    await page.click('button[type="submit"]');

    // 3. View details
    await page.click('text=Beach House');
    expect(page.url()).toContain('/accommodations/');

    // 4. Select dates
    await page.fill('[name="checkIn"]', '2024-07-01');
    await page.fill('[name="checkOut"]', '2024-07-05');

    // 5. Book
    await page.click('text=Book Now');

    // 6. Verify confirmation
    await expect(page.locator('text=Booking Confirmed')).toBeVisible();
  });
});
```text

---

## Coverage Requirements

### Minimum Coverage: 90%

**What to test:**

- All public functions/methods
- All API endpoints
- All business logic paths
- All error cases
- All edge cases

**What NOT to test:**

- Private functions (test through public API)
- Type definitions
- Third-party libraries
- Constants

### Coverage by Layer

| Layer | Unit | Integration | E2E |
|-------|------|-------------|-----|
| Models | ✅ All methods | ✅ Database operations | ❌ |
| Services | ✅ All methods | ✅ With database | ❌ |
| API Routes | ✅ Logic | ✅ Endpoints | ✅ Critical flows |
| Components | ✅ Logic | ✅ User interactions | ✅ Main flows |

---

## Test Structure

### AAA Pattern (Arrange, Act, Assert)

**Always use AAA structure:**

```typescript
it('should create user with valid data', async () => {
  // ARRANGE: Setup test data and dependencies
  const input = {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'host' as const,
  };
  const mockUser = createTestUser({ role: 'admin' });

  // ACT: Execute the function being tested
  const result = await userService.create({ input, user: mockUser });

  // ASSERT: Verify the result
  expect(result.user).toBeDefined();
  expect(result.user.name).toBe('John Doe');
  expect(result.user.email).toBe('john@example.com');
});
```text

### Given-When-Then (for Acceptance Tests)

```typescript
it('Given user is admin, When creating user, Then user is created', async () => {
  // GIVEN: Setup preconditions
  const adminUser = createTestUser({ role: 'admin' });
  const inputData = createTestUserInput();

  // WHEN: Perform action
  const result = await userService.create({ input: inputData, user: adminUser });

  // THEN: Verify outcome
  expect(result.user.id).toBeDefined();
  expect(result.user.role).toBe('host');
});
```text

---

## Test File Organization

### Test Folder Structure

**Rule:** All tests MUST be placed in a `test/` folder at the root of each package/app, mirroring the source folder structure.

**Structure:**

```text
packages/my-package/
├── src/
│   ├── services/
│   │   └── user-service.ts
│   ├── utils/
│   │   └── validators.ts
│   └── index.ts
└── test/
    ├── services/
    │   └── user-service.test.ts
    ├── utils/
    │   └── validators.test.ts
    └── index.test.ts
```

**Examples:**

```text
✅ CORRECT:
Source:  packages/db/src/models/user.model.ts
Test:    packages/db/test/models/user.model.test.ts

Source:  packages/service-core/src/services/booking/booking-service.ts
Test:    packages/service-core/test/services/booking/booking-service.test.ts

Source:  apps/api/src/routes/accommodations.ts
Test:    apps/api/test/routes/accommodations.test.ts

❌ INCORRECT:
Source:  packages/db/src/models/user.model.ts
Test:    packages/db/src/models/user.model.test.ts  (tests should NOT be in src/)

Source:  packages/db/src/models/user.model.ts
Test:    packages/db/test/user.model.test.ts  (missing models/ folder)
```

### Import Paths in Tests

When importing from source files, use relative paths from test/ to src/:

```typescript
// ✅ CORRECT: test/services/user-service.test.ts
import { UserService } from '../src/services/user-service.js';

// ✅ CORRECT: test/models/user.model.test.ts
import { UserModel } from '../src/models/user.model.js';

// ❌ INCORRECT: Don't use same-folder imports
import { UserService } from './user-service.js';
```

### Vitest Configuration

Vitest automatically discovers tests in `test/` folders. No special configuration needed:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',      // Excludes tests wherever they are
        '**/*.config.ts',
      ],
    },
  },
});
```

---

## Naming Conventions

### Test File Names

```text
{module-name}.test.ts
{module-name}.integration.test.ts
{module-name}.e2e.test.ts
```

**Examples:**

```text
user-service.test.ts
user-service.integration.test.ts
booking-flow.e2e.test.ts
```

### Test Description

```typescript
// ✅ GOOD: Descriptive, behavior-focused
describe('UserService', () => {
  describe('create', () => {
    it('should create user with valid data', async () => {});
    it('should throw error when email already exists', async () => {});
    it('should throw error when user lacks permissions', async () => {});
  });
});

// ❌ BAD: Implementation-focused
describe('UserService', () => {
  it('test create', async () => {});
  it('test validation', async () => {});
});
```text

### Variable Names

```typescript
// ✅ GOOD: Clear, descriptive names
const inputValid = { name: 'John', email: 'john@example.com' };
const inputInvalid = { name: '', email: 'invalid' };
const mockUser = createTestUser();
const expectedResult = { id: '123', name: 'John' };
const actualResult = await service.create({ input: inputValid, user: mockUser });

// ❌ BAD: Unclear names
const data = { name: 'John' };
const result = await service.create({ input: data });
```text

---

## Test Patterns

### Setup and Teardown

```typescript
describe('UserService', () => {
  let service: UserService;
  let db: Database;
  let testUser: User;

  // Run before all tests in this suite
  beforeAll(async () => {
    db = await createTestDatabase();
  });

  // Run before each test
  beforeEach(async () => {
    service = new UserService({ db });
    testUser = await createTestUser();
  });

  // Run after each test
  afterEach(async () => {
    await cleanupTestData();
  });

  // Run after all tests
  afterAll(async () => {
    await db.destroy();
  });

  it('should work', async () => {
    // Test has access to service, db, testUser
  });
});
```text

### Parameterized Tests

```typescript
describe('validateEmail', () => {
  const testCases = [
    { email: 'valid@example.com', expected: true },
    { email: 'invalid', expected: false },
    { email: 'missing@domain', expected: false },
    { email: '@example.com', expected: false },
  ];

  testCases.forEach(({ email, expected }) => {
    it(`should return ${expected} for "${email}"`, () => {
      const result = validateEmail(email);
      expect(result).toBe(expected);
    });
  });
});
```text

### Testing Errors

```typescript
describe('UserService', () => {
  it('should throw NOT_FOUND when user does not exist', async () => {
    await expect(
      service.findById({ id: 'non-existent-id' })
    ).rejects.toThrow(ServiceError);

    await expect(
      service.findById({ id: 'non-existent-id' })
    ).rejects.toMatchObject({
      code: ServiceErrorCode.NOT_FOUND,
      message: expect.stringContaining('not found'),
    });
  });

  it('should throw FORBIDDEN when user lacks permissions', async () => {
    const guestUser = createTestUser({ role: 'guest' });

    await expect(
      service.create({ input: validInput, user: guestUser })
    ).rejects.toThrow('Forbidden');
  });
});
```text

### Testing Async Code

```typescript
// ✅ GOOD: Using async/await
it('should fetch user data', async () => {
  const result = await fetchUser('123');
  expect(result.name).toBe('John');
});

// ✅ GOOD: Using resolves/rejects
it('should fetch user data', () => {
  return expect(fetchUser('123')).resolves.toMatchObject({
    name: 'John',
  });
});

// ❌ BAD: Not handling async
it('should fetch user data', () => {
  fetchUser('123'); // Test will pass before promise resolves!
  expect(result.name).toBe('John'); // result is undefined
});
```text

---

## Mocking & Fixtures

### Mock External Dependencies

```typescript
import { vi } from 'vitest';

describe('BookingService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    // Mock email service
    emailService = {
      sendConfirmation: vi.fn(),
    } as unknown as EmailService;
  });

  it('should send confirmation email after booking', async () => {
    const service = new BookingService({ db, emailService });

    await service.create({ input: bookingData, user });

    expect(emailService.sendConfirmation).toHaveBeenCalledWith({
      to: user.email,
      booking: expect.objectContaining({ id: expect.any(String) }),
    });
  });
});
```text

### Test Fixtures

```typescript
// test/fixtures/user.fixture.ts

export const createTestUser = (overrides?: Partial<User>): User => ({
  id: randomUUID(),
  name: 'Test User',
  email: 'test@example.com',
  role: 'host',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

export const createTestAdmin = (): User =>
  createTestUser({ role: 'admin', email: 'admin@example.com' });

export const createTestGuest = (): User =>
  createTestUser({ role: 'guest', email: 'guest@example.com' });
```text

### Factory Pattern

```typescript
// test/factories/accommodation.factory.ts

let counter = 0;

export const buildAccommodation = (
  overrides?: Partial<Accommodation>
): Accommodation => {
  counter++;
  return {
    id: randomUUID(),
    name: `Test Accommodation ${counter}`,
    type: 'house',
    capacity: 4,
    pricePerNight: 100,
    hostId: randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
};
```text

---

## Database Testing

### Use Test Database

```typescript
// test/setup.ts

let testDb: Database;

export const setupTestDatabase = async () => {
  testDb = await createConnection({
    host: 'localhost',
    port: 5433, // Different port for test DB
    database: 'hospeda_test',
  });

  // Run migrations
  await migrate(testDb);

  return testDb;
};

export const teardownTestDatabase = async () => {
  await testDb.destroy();
};
```text

### Clean Between Tests

```typescript
beforeEach(async () => {
  // Clean all tables
  await db.delete(bookings);
  await db.delete(accommodations);
  await db.delete(users);
});
```text

### Transaction Rollback Pattern

```typescript
describe('UserService', () => {
  let trx: Transaction;

  beforeEach(async () => {
    trx = await db.transaction();
  });

  afterEach(async () => {
    await trx.rollback(); // Rollback all changes
  });

  it('should create user', async () => {
    const service = new UserService({ db: trx });
    // Test...
    // Changes are rolled back after test
  });
});
```text

---

## API Testing

### Test API Endpoints

```typescript
import { app } from '../src/app';

describe('POST /api/accommodations', () => {
  it('should create accommodation with valid data', async () => {
    const input = {
      name: 'Beach House',
      type: 'house',
      capacity: 6,
      pricePerNight: 150,
    };

    const response = await app.request('/api/accommodations', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hostToken}`,
      },
    });

    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.accommodation.name).toBe('Beach House');
  });

  it('should return 401 when not authenticated', async () => {
    const response = await app.request('/api/accommodations', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(401);
  });

  it('should return 400 when validation fails', async () => {
    const invalidInput = {
      name: '', // Empty name
      type: 'invalid-type',
    };

    const response = await app.request('/api/accommodations', {
      method: 'POST',
      body: JSON.stringify(invalidInput),
      headers: {
        'Authorization': `Bearer ${hostToken}`,
      },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
```text

---

## Frontend Testing

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  const mockAccommodation = {
    id: '123',
    name: 'Beach House',
    type: 'house',
    capacity: 6,
    pricePerNight: 150,
  };

  it('should render accommodation details', () => {
    render(<AccommodationCard accommodation={mockAccommodation} />);

    expect(screen.getByText('Beach House')).toBeInTheDocument();
    expect(screen.getByText('$150 / night')).toBeInTheDocument();
    expect(screen.getByText('6 guests')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    const mockOnSelect = vi.fn();

    render(
      <AccommodationCard
        accommodation={mockAccommodation}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    expect(mockOnSelect).toHaveBeenCalledWith('123');
  });
});
```text

### Testing with TanStack Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccommodations } from './useAccommodations';

describe('useAccommodations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('should fetch accommodations', async () => {
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAccommodations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
  });
});
```text

---

## Common Pitfalls

### ❌ Testing Implementation Details

```typescript
// ❌ BAD: Testing private methods
it('should call _validateEmail internally', () => {
  const spy = vi.spyOn(service, '_validateEmail');
  service.create({ input });
  expect(spy).toHaveBeenCalled();
});

// ✅ GOOD: Testing behavior
it('should reject invalid email', async () => {
  await expect(
    service.create({ input: { email: 'invalid' } })
  ).rejects.toThrow('Invalid email');
});
```text

### ❌ Brittle Tests

```typescript
// ❌ BAD: Too specific, will break on small changes
expect(result).toEqual({
  id: '123',
  name: 'John',
  email: 'john@example.com',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
});

// ✅ GOOD: Focus on important parts
expect(result).toMatchObject({
  name: 'John',
  email: 'john@example.com',
});
expect(result.id).toBeDefined();
expect(result.createdAt).toBeInstanceOf(Date);
```text

### ❌ Shared State

```typescript
// ❌ BAD: Tests affect each other
let user;

beforeAll(() => {
  user = createTestUser();
});

it('test 1', () => {
  user.name = 'Changed'; // Affects other tests!
});

// ✅ GOOD: Fresh state per test
beforeEach(() => {
  user = createTestUser();
});
```text

### ❌ Not Testing Edge Cases

```typescript
// ❌ BAD: Only happy path
it('should calculate price', () => {
  expect(calculatePrice(100, 3)).toBe(300);
});

// ✅ GOOD: Test edge cases
describe('calculatePrice', () => {
  it('should calculate price for positive values', () => {
    expect(calculatePrice(100, 3)).toBe(300);
  });

  it('should throw for zero nights', () => {
    expect(() => calculatePrice(100, 0)).toThrow();
  });

  it('should throw for negative nights', () => {
    expect(() => calculatePrice(100, -1)).toThrow();
  });

  it('should handle large numbers', () => {
    expect(calculatePrice(1000000, 365)).toBe(365000000);
  });
});
```text

---

## Summary Checklist

Before considering testing complete:

- [ ] 90%+ code coverage
- [ ] All public functions tested
- [ ] All API endpoints tested
- [ ] All error cases tested
- [ ] All edge cases tested
- [ ] Tests follow AAA pattern
- [ ] Tests are independent
- [ ] Tests are fast (< 100ms unit, < 1s integration)
- [ ] No flaky tests
- [ ] Tests document behavior

---

**TDD is mandatory. Tests must be written BEFORE implementation.**

