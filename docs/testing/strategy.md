# Testing Strategy

## Overview

Hospeda's testing strategy is built on **Test-Driven Development (TDD)** principles with a strict **90% code coverage** requirement. This document outlines our testing philosophy, workflows, and the test pyramid that guides our approach.

## Testing Philosophy

### Why Test-First?

Test-Driven Development is not just about testing—it's about **design**. By writing tests first, we:

1. **Force Better Design**: Tests reveal tight coupling and complex dependencies
2. **Create Living Documentation**: Tests show exactly how code should be used
3. **Enable Confident Refactoring**: Change code without fear of breaking functionality
4. **Prevent Regressions**: Catch bugs before they reach production
5. **Accelerate Development**: Less time debugging, more time building

### Core Principles

#### 1. TDD First (Red-Green-Refactor)

Every feature starts with a failing test:

```typescript
// ❌ RED: Write failing test first
it('should create accommodation with valid data', async () => {
  const service = new AccommodationService();
  const result = await service.create({ name: 'Hotel' });
  expect(result.success).toBe(true);
});

// ✅ GREEN: Write minimal code to pass
async create(data) {
  return { success: true, data: { ...data, id: '1' } };
}

// ♻️ REFACTOR: Improve without changing behavior
async create(data) {
  const validated = createSchema.parse(data);
  const accommodation = await this.model.create(validated);
  return { success: true, data: accommodation };
}
```

#### 2. 90% Coverage Minimum

**No exceptions**. Coverage is enforced:

- Locally via `pnpm test:coverage`
- Pre-commit via Husky hooks
- CI/CD via GitHub Actions
- Per-package with individual thresholds

#### 3. AAA Pattern (Arrange-Act-Assert)

Every test follows this structure for clarity:

```typescript
it('should calculate discount correctly', () => {
  // ARRANGE: Set up test data
  const price = 100;
  const discountRate = 0.2;

  // ACT: Execute code under test
  const result = calculateDiscount(price, discountRate);

  // ASSERT: Verify outcome
  expect(result).toBe(80);
});
```

#### 4. Fast Tests

Speed matters:

- **Unit**: < 100ms per test
- **Integration**: < 1s per test
- **E2E**: < 10s per test
- **Full Suite**: < 5 minutes

Slow tests discourage running them frequently, defeating their purpose.

#### 5. Test Isolation

Each test must be **completely independent**:

- No shared state between tests
- Setup in `beforeEach`, cleanup in `afterEach`
- Tests pass in any order
- Tests can run in parallel

## The Three Laws of TDD

Formulated by Robert C. Martin (Uncle Bob):

### Law 1: Don't Write Production Code Without a Failing Test

You are not allowed to write any production code unless it is to make a failing unit test pass.

```typescript
// ❌ WRONG: Writing code first
export class AccommodationService {
  async create(data: CreateAccommodationData) {
    // Don't write this first!
    const accommodation = await this.model.create(data);
    return { success: true, data: accommodation };
  }
}

// ✅ RIGHT: Write test first
describe('AccommodationService', () => {
  it('should create accommodation', async () => {
    // Write this first, let it fail
    const service = new AccommodationService();
    const result = await service.create({ name: 'Hotel' });
    expect(result.success).toBe(true);
  });
});
```

### Law 2: Don't Write More of a Test Than Sufficient to Fail

Write only enough of a unit test to fail. Compilation failures count as failures.

```typescript
// ❌ WRONG: Writing entire test suite upfront
describe('AccommodationService', () => {
  it('should create', async () => { /* full test */ });
  it('should update', async () => { /* full test */ });
  it('should delete', async () => { /* full test */ });
  // Don't write all these at once!
});

// ✅ RIGHT: One test at a time
describe('AccommodationService', () => {
  it('should create accommodation', async () => {
    // Just this one test, make it fail
    const result = await service.create({ name: 'Hotel' });
    expect(result).toBeDefined();
  });
  // Add more tests after this passes
});
```

### Law 3: Don't Write More Production Code Than Sufficient to Pass

Write only the minimum production code needed to pass the currently failing test.

```typescript
// ❌ WRONG: Overengineering
async create(data: CreateAccommodationData) {
  // Don't add features not tested yet!
  const validated = validate(data);
  const withSlug = addSlug(validated);
  const withTimestamps = addTimestamps(withSlug);
  const withAudit = addAuditLog(withTimestamps);
  return this.model.create(withAudit);
}

// ✅ RIGHT: Minimal implementation
async create(data: CreateAccommodationData) {
  // Only what's needed to pass current test
  return { success: true, data: { ...data, id: '1' } };
}
```

## TDD Workflow (Red-Green-Refactor)

### The Cycle

```text
       ┌─────────────┐
       │             │
       ▼             │
    ┌─────┐      ┌──────┐
    │ RED │─────▶│GREEN │
    └─────┘      └──────┘
       ▲             │
       │             ▼
       │        ┌─────────┐
       └────────│REFACTOR │
                └─────────┘
```

### Step 1: Red (Write Failing Test)

Start with the **smallest** test that fails:

```typescript
describe('AccommodationService', () => {
  describe('create', () => {
    it('should create accommodation with valid data', async () => {
      // Arrange
      const service = new AccommodationService();
      const data = {
        name: 'Hotel Paradise',
        city: 'Buenos Aires',
        address: '123 Main St'
      };

      // Act
      const result = await service.create(data);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('Hotel Paradise');
      expect(result.data.id).toBeDefined();
    });
  });
});
```

**Run test**: `pnpm test` → ❌ Fails (code doesn't exist)

**Expected Error**:

```text
Cannot find module './accommodation.service'
```

### Step 2: Green (Make Test Pass)

Write the **minimum** code to pass:

```typescript
// accommodation.service.ts
export class AccommodationService {
  async create(data: CreateAccommodationData) {
    // Simplest possible implementation
    return {
      success: true,
      data: {
        id: '1',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
  }
}
```

**Run test**: `pnpm test` → ✅ Passes

### Step 3: Refactor (Improve Code)

Now improve without changing behavior:

```typescript
// accommodation.service.ts
export class AccommodationService extends BaseCrudService {
  async create(data: CreateAccommodationData) {
    // Refactor: Add validation
    const validated = createAccommodationSchema.parse(data);

    // Refactor: Add slug generation
    const slug = generateSlug(validated.name);

    // Refactor: Use actual database
    const accommodation = await this.model.create({
      ...validated,
      slug
    });

    return {
      success: true,
      data: accommodation
    };
  }
}
```

**Run tests**: `pnpm test` → ✅ Still passes

**Key**: Tests validate refactor didn't break anything.

### Complete TDD Example

**Feature**: Create accommodation with duplicate name prevention

#### Iteration 1: Happy Path

```typescript
// RED
it('should create accommodation with valid data', async () => {
  const data = { name: 'Hotel Paradise', city: 'BA' };
  const result = await service.create(data);

  expect(result.success).toBe(true);
  expect(result.data.name).toBe('Hotel Paradise');
});

// GREEN
async create(data) {
  return { success: true, data: { ...data, id: '1' } };
}

// REFACTOR
async create(data) {
  const accommodation = await this.model.create(data);
  return { success: true, data: accommodation };
}
```

#### Iteration 2: Validation

```typescript
// RED
it('should reject empty name', async () => {
  const result = await service.create({ name: '', city: 'BA' });

  expect(result.success).toBe(false);
  expect(result.error.code).toBe('VALIDATION_ERROR');
});

// GREEN
async create(data) {
  if (!data.name) {
    return {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Name required' }
    };
  }
  const accommodation = await this.model.create(data);
  return { success: true, data: accommodation };
}

// REFACTOR
async create(data) {
  // Extract validation
  const validated = createAccommodationSchema.parse(data);
  const accommodation = await this.model.create(validated);
  return { success: true, data: accommodation };
}
```

#### Iteration 3: Duplicate Prevention

```typescript
// RED
it('should reject duplicate name', async () => {
  await service.create({ name: 'Hotel', city: 'BA' });
  const result = await service.create({ name: 'Hotel', city: 'BA' });

  expect(result.success).toBe(false);
  expect(result.error.code).toBe('DUPLICATE_NAME');
});

// GREEN
async create(data) {
  const validated = createAccommodationSchema.parse(data);

  const existing = await this.model.findOne({ name: data.name });
  if (existing) {
    return {
      success: false,
      error: { code: 'DUPLICATE_NAME', message: 'Name exists' }
    };
  }

  const accommodation = await this.model.create(validated);
  return { success: true, data: accommodation };
}

// REFACTOR
async create(data) {
  const validated = createAccommodationSchema.parse(data);

  // Extract to private method
  await this.checkDuplicateName(validated.name);

  const accommodation = await this.model.create(validated);
  return { success: true, data: accommodation };
}

private async checkDuplicateName(name: string): Promise<void> {
  const exists = await this.model.exists({ name });
  if (exists) {
    throw new ServiceError('DUPLICATE_NAME', 'Name already exists');
  }
}
```

## Test Pyramid

### Overview

The test pyramid guides how we distribute testing effort:

```text
       /\
      /  \  E2E (5%)
     /----\  Critical paths
    /      \  User flows
   /--------\
  / Integra \ (25%)
 /    tion   \ Real components
/____________\ Real database
      Unit      (70%)
   Functions   Fast & isolated
    Methods    Pure logic
```

### Layer 1: Unit Tests (70%)

**What**: Test individual functions/methods in complete isolation

**Characteristics**:

- **Speed**: < 100ms per test
- **Scope**: Single function/method
- **Mocking**: Mock ALL dependencies
- **Coverage**: 95%+ for business logic

**Example**:

```typescript
describe('generateSlug', () => {
  it('should convert to lowercase', () => {
    expect(generateSlug('Hotel Paradise')).toBe('hotel-paradise');
  });

  it('should replace spaces with hyphens', () => {
    expect(generateSlug('My Hotel')).toBe('my-hotel');
  });

  it('should remove special characters', () => {
    expect(generateSlug('Café "Le Bon"')).toBe('cafe-le-bon');
  });

  it('should trim hyphens', () => {
    expect(generateSlug('---Hotel---')).toBe('hotel');
  });

  it('should handle empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('should handle unicode', () => {
    expect(generateSlug('Ñoño')).toBe('nono');
  });
});
```

**When to Use**:

- Pure functions (no side effects)
- Utility functions
- Business logic calculations
- Validation logic
- Formatting functions
- Data transformations

**Benefits**:

- Extremely fast (run constantly)
- Pinpoint failures precisely
- Easy to write and maintain
- Great for TDD

### Layer 2: Integration Tests (25%)

**What**: Test multiple units working together with real dependencies

**Characteristics**:

- **Speed**: < 1s per test
- **Scope**: Multiple components
- **Mocking**: Mock external services only (API, email, payment)
- **Coverage**: 90%+ for services

**Example**:

```typescript
describe('AccommodationService Integration', () => {
  let service: AccommodationService;
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDatabase();
    service = new AccommodationService();
  });

  afterAll(async () => {
    await cleanupTestDatabase(db);
  });

  beforeEach(async () => {
    await db.clearAll();
  });

  it('should create accommodation with all dependencies', async () => {
    // Real service + real model + real database
    const result = await service.create({
      name: 'Hotel Paradise',
      city: 'Buenos Aires',
      address: '123 Main St',
      description: 'Beautiful hotel'
    });

    expect(result.success).toBe(true);
    expect(result.data.slug).toBe('hotel-paradise');

    // Verify saved to database
    const saved = await db
      .select()
      .from(accommodationTable)
      .where(eq(accommodationTable.id, result.data.id));

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('Hotel Paradise');
  });

  it('should prevent duplicate slugs', async () => {
    await service.create({ name: 'Hotel' });

    const result = await service.create({ name: 'Hotel' });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('DUPLICATE_SLUG');
  });
});
```

**When to Use**:

- Services with database operations
- Multiple models interacting
- Transaction handling
- Complex business workflows
- Authentication flows

**Benefits**:

- Test realistic scenarios
- Catch integration issues
- Verify database operations
- Test error handling

### Layer 3: E2E Tests (5%)

**What**: Test entire user flows through the system

**Characteristics**:

- **Speed**: 3-10s per test
- **Scope**: Full application stack
- **Mocking**: None (real everything)
- **Coverage**: Critical paths only

**Example**:

```typescript
describe('Accommodation Creation Flow', () => {
  it('should create accommodation via API', async () => {
    // Real HTTP request to real API
    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: 'Hotel Paradise',
        city: 'Buenos Aires',
        address: '123 Main St'
      })
    });

    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data.name).toBe('Hotel Paradise');
    expect(data.slug).toBe('hotel-paradise');

    // Verify in database
    const saved = await db.query.accommodations.findFirst({
      where: eq(accommodations.id, data.id)
    });

    expect(saved).toBeDefined();
  });
});
```

**When to Use**:

- Critical user flows
- API endpoint testing
- Authentication/Authorization
- Payment processing
- Email notifications (with mocked service)

**Benefits**:

- Highest confidence
- Test real integration
- Catch system-level issues
- Verify user experience

### Choosing the Right Test Type

| Scenario | Test Type | Why |
|----------|-----------|-----|
| Pure function | Unit | Fast, isolated, focused |
| Business logic | Unit | Easy to test, high coverage |
| Database operation | Integration | Need real DB behavior |
| Multiple services | Integration | Test interactions |
| API endpoint | Integration/E2E | Test HTTP layer |
| User workflow | E2E | Test complete flow |
| Payment processing | E2E | Critical path |

## AAA Pattern (Arrange-Act-Assert)

### Structure

Every test should follow this three-phase structure:

```typescript
it('should calculate total with tax', () => {
  // 1. ARRANGE: Set up test conditions
  const items = [
    { name: 'Item 1', price: 100 },
    { name: 'Item 2', price: 50 }
  ];
  const taxRate = 0.21; // 21% tax

  // 2. ACT: Execute the code under test
  const total = calculateTotal(items, taxRate);

  // 3. ASSERT: Verify the expected outcome
  expect(total).toBe(181.5); // (100 + 50) * 1.21
});
```

### Phase 1: Arrange

Set up everything needed for the test:

```typescript
it('should create booking', async () => {
  // ARRANGE: Prepare data
  const accommodation = await createAccommodation({
    name: 'Hotel',
    pricePerNight: 100
  });

  const user = await createUser({
    email: 'user@example.com'
  });

  const bookingData = {
    accommodationId: accommodation.id,
    userId: user.id,
    checkIn: '2024-01-01',
    checkOut: '2024-01-05',
    guests: 2
  };

  // ARRANGE: Setup mocks
  const mockPaymentService = {
    charge: vi.fn().mockResolvedValue({ success: true })
  };

  const service = new BookingService(mockPaymentService);

  // ... ACT and ASSERT follow
});
```

### Phase 2: Act

Execute the single operation being tested:

```typescript
it('should update accommodation', async () => {
  // ARRANGE
  const accommodation = await service.create({ name: 'Hotel' });
  const updateData = { name: 'New Name' };

  // ACT: Single operation
  const result = await service.update(accommodation.id, updateData);

  // ASSERT
  expect(result.success).toBe(true);
  expect(result.data.name).toBe('New Name');
});
```

**Important**: Only ONE operation in Act phase. If you need multiple operations, you're probably testing too much.

### Phase 3: Assert

Verify the expected outcome:

```typescript
it('should calculate discount', () => {
  // ARRANGE
  const price = 100;
  const discountRate = 0.2;

  // ACT
  const result = calculateDiscount(price, discountRate);

  // ASSERT: Multiple assertions are OK if testing same result
  expect(result).toBe(80);
  expect(result).toBeGreaterThan(0);
  expect(result).toBeLessThan(price);
  expect(typeof result).toBe('number');
});
```

### AAA Best Practices

#### DO ✅

```typescript
// Clear separation
it('should process payment', async () => {
  // ARRANGE
  const amount = 100;
  const currency = 'USD';

  // ACT
  const result = await paymentService.charge(amount, currency);

  // ASSERT
  expect(result.success).toBe(true);
});

// Comment sections for clarity
it('should create user', async () => {
  // Arrange: Set up test data
  const userData = { email: 'test@example.com' };

  // Act: Execute creation
  const user = await userService.create(userData);

  // Assert: Verify result
  expect(user.email).toBe('test@example.com');
});
```

#### DON'T ❌

```typescript
// Mixing phases
it('should process order', async () => {
  const order = await createOrder(); // Arrange
  const result = await processOrder(order); // Act
  expect(result.status).toBe('processed'); // Assert
  const notification = await sendNotification(order); // Act again? No!
  expect(notification.sent).toBe(true); // Assert again? No!
});

// Multiple Acts
it('should handle multiple operations', async () => {
  const user = await service.createUser(data); // Act 1
  const profile = await service.createProfile(user.id); // Act 2
  // Split into two tests!
});

// No clear separation
it('test something', async () => {
  const data = { name: 'test' };const result = await service.create(data);expect(result).toBeDefined();
  // Hard to read!
});
```

## Test Organization

### File Structure

```text
packages/db/
├── src/
│   └── models/
│       └── accommodation/
│           ├── accommodation.model.ts
│           └── index.ts
└── test/
    └── models/
        └── accommodation.model.test.ts
```

**Rules**:

- Test files in `test/` folder
- Mirror source structure
- One test file per source file
- Name: `[filename].test.ts`

### Test Suite Organization

```typescript
describe('AccommodationModel', () => {
  // Setup
  let model: AccommodationModel;

  beforeEach(() => {
    model = new AccommodationModel();
    vi.clearAllMocks();
  });

  // Group by method
  describe('create', () => {
    it('should create with valid data', async () => {});
    it('should validate required fields', async () => {});
    it('should generate timestamps', async () => {});
  });

  describe('findById', () => {
    it('should find existing accommodation', async () => {});
    it('should return null for non-existent', async () => {});
  });

  describe('update', () => {
    it('should update existing accommodation', async () => {});
    it('should reject non-existent accommodation', async () => {});
    it('should validate update data', async () => {});
  });

  describe('delete', () => {
    it('should soft delete accommodation', async () => {});
    it('should maintain audit trail', async () => {});
  });
});
```

### Nested Describes

Use nested describes for complex scenarios:

```typescript
describe('AccommodationService', () => {
  describe('create', () => {
    describe('with valid data', () => {
      it('should create accommodation', () => {});
      it('should generate slug', () => {});
      it('should set timestamps', () => {});
    });

    describe('with invalid data', () => {
      it('should reject empty name', () => {});
      it('should reject invalid email', () => {});
      it('should reject negative price', () => {});
    });

    describe('with duplicate name', () => {
      it('should reject duplicate', () => {});
      it('should return error code', () => {});
    });
  });
});
```

## Test Naming

### Convention

**Format**: `should [expected behavior] when [condition]`

```typescript
// Good ✅
it('should create accommodation with valid data', () => {});
it('should reject duplicate name', () => {});
it('should return null when not found', () => {});
it('should throw error when amount is negative', () => {});

// Bad ❌
it('creates accommodation', () => {}); // Missing "should"
it('test update', () => {}); // Unclear
it('works', () => {}); // Too vague
it('should do everything', () => {}); // Too broad
```

### Naming Patterns

**Happy Path**:

```typescript
it('should create accommodation with valid data', () => {});
it('should find accommodation by id', () => {});
it('should update accommodation successfully', () => {});
it('should delete accommodation', () => {});
```

**Error Cases**:

```typescript
it('should reject invalid email format', () => {});
it('should return error when not found', () => {});
it('should throw on database error', () => {});
it('should return null when id is invalid', () => {});
```

**Edge Cases**:

```typescript
it('should handle empty array', () => {});
it('should handle null value', () => {});
it('should handle concurrent updates', () => {});
it('should handle special characters in name', () => {});
```

**Specific Conditions**:

```typescript
it('should return null when accommodation is soft deleted', () => {});
it('should apply discount when booking is > 7 days', () => {});
it('should send email when payment is successful', () => {});
```

## Coverage Requirements

### 90% Minimum

**Why 90%?**

- **High Confidence**: Catches most bugs
- **Industry Standard**: Widely accepted threshold
- **Forces Testing**: Can't skip "hard to test" code
- **Safety Net**: Refactor with confidence

**Measured Metrics**:

| Metric | Threshold | Description |
|--------|-----------|-------------|
| **Statements** | 90% | % of code statements executed |
| **Branches** | 90% | % of if/else branches tested |
| **Functions** | 90% | % of functions called |
| **Lines** | 90% | % of code lines covered |

### Viewing Coverage

```bash
# Generate coverage report
pnpm test:coverage

# Output:
# File                     | % Stmts | % Branch | % Funcs | % Lines
# -------------------------|---------|----------|---------|--------
# src/models/accommodation | 95.5    | 92.3     | 96.2    | 95.5
# src/services/accommodation| 91.2   | 89.7     | 93.1    | 91.2
# -------------------------|---------|----------|---------|--------
# All files                | 93.4    | 91.0     | 94.7    | 93.4

# Open HTML report
open coverage/index.html
```

**HTML Report** shows:

- 🟢 Green lines: Covered
- 🔴 Red lines: Not covered
- 🟡 Yellow lines: Partially covered (some branches)

### Improving Coverage

**Step 1**: Identify uncovered code

```bash
pnpm test:coverage
open coverage/index.html
```

**Step 2**: Navigate to uncovered lines (red/yellow)

**Step 3**: Add tests for those lines

```typescript
// Coverage shows line 42 not covered
if (accommodation.isDeleted) {  // Line 42 not covered
  return null;
}

// Add test:
it('should return null when accommodation is deleted', async () => {
  const accommodation = await service.create({ name: 'Hotel' });
  await service.delete(accommodation.id);

  const result = await service.findById(accommodation.id);

  expect(result).toBeNull(); // Now line 42 is covered!
});
```

### Coverage Exceptions

**When Coverage < 90% is acceptable**:

- Never. There are no exceptions.

**Actually NO exceptions**:

- Business logic must be 95%+
- Error handling must be tested
- Edge cases must be covered
- All branches must be tested

## Test Independence

### Principles

Tests MUST be:

1. **Independent**: Don't rely on other tests
2. **Isolated**: No shared state
3. **Repeatable**: Same result every time
4. **Order-Agnostic**: Run in any order
5. **Parallel-Safe**: Can run simultaneously

### Anti-Patterns

#### Shared State ❌

```typescript
// BAD: Shared state between tests
let accommodation: Accommodation;

it('should create accommodation', async () => {
  accommodation = await service.create({ name: 'Hotel' });
  expect(accommodation).toBeDefined();
});

it('should update accommodation', async () => {
  // Depends on previous test!
  const result = await service.update(accommodation.id, { name: 'New' });
  expect(result.success).toBe(true);
});
```

#### Test Order Dependency ❌

```typescript
// BAD: Tests must run in specific order
describe('AccommodationService', () => {
  it('1. should create', async () => {
    await service.create({ name: 'Hotel' });
  });

  it('2. should list all', async () => {
    // Expects accommodation from test 1
    const results = await service.findAll();
    expect(results).toHaveLength(1);
  });
});
```

### Best Practices

#### Independent Setup ✅

```typescript
// GOOD: Each test sets up its own data
describe('AccommodationService', () => {
  beforeEach(async () => {
    await db.clearAll(); // Clean slate
  });

  it('should create accommodation', async () => {
    const accommodation = await service.create({ name: 'Hotel' });
    expect(accommodation).toBeDefined();
  });

  it('should update accommodation', async () => {
    // Create fresh accommodation for this test
    const accommodation = await service.create({ name: 'Hotel' });

    const result = await service.update(accommodation.id, { name: 'New' });

    expect(result.data.name).toBe('New');
  });
});
```

#### Test Factories ✅

```typescript
// GOOD: Use factories for test data
describe('BookingService', () => {
  it('should create booking', async () => {
    const accommodation = await createTestAccommodation();
    const user = await createTestUser();

    const booking = await service.create({
      accommodationId: accommodation.id,
      userId: user.id,
      checkIn: '2024-01-01',
      checkOut: '2024-01-05'
    });

    expect(booking).toBeDefined();
  });
});
```

## Test Speed

### Performance Targets

| Test Type | Target | Maximum | Action if Exceeded |
|-----------|--------|---------|-------------------|
| Unit | < 100ms | 500ms | Optimize or mock more |
| Integration | < 1s | 3s | Review DB queries |
| E2E | < 10s | 30s | Investigate bottlenecks |
| Full Suite | < 5min | 10min | Parallelize |

### Speed Optimization

#### Mock Expensive Operations

```typescript
// Slow ❌
it('should send email', async () => {
  await emailService.send({ to: 'user@example.com' });
  // Real API call = slow
});

// Fast ✅
it('should send email', async () => {
  const mockEmailService = {
    send: vi.fn().mockResolvedValue({ success: true })
  };

  await mockEmailService.send({ to: 'user@example.com' });
  expect(mockEmailService.send).toHaveBeenCalled();
});
```

#### Use In-Memory Database

```typescript
// Slow ❌
beforeAll(async () => {
  db = await connectToTestPostgres(); // Real DB connection
});

// Fast ✅
beforeAll(async () => {
  db = await setupInMemoryDatabase(); // In-memory SQLite
});
```

#### Parallel Execution

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false // Run tests in parallel
      }
    }
  }
});
```

## CI/CD Integration

### Pre-Commit Hook

```bash
# .husky/pre-commit
#!/bin/sh
pnpm test
pnpm test:coverage

# Fail commit if tests fail or coverage < 90%
```

### GitHub Actions

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test

      - name: Check coverage
        run: pnpm test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          fail_ci_if_error: true
```

### Coverage Enforcement

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

## Best Practices Summary

### DO ✅

- **Write tests first** (TDD)
- **Follow AAA pattern** (Arrange-Act-Assert)
- **One assertion per test** (ideally)
- **Descriptive test names** (should...)
- **Test edge cases** (null, empty, boundary)
- **Mock dependencies** (external services)
- **Clean up** (afterEach)
- **Keep tests fast** (< 100ms unit)
- **Maintain 90% coverage** (no exceptions)
- **Run tests frequently** (watch mode)

### DON'T ❌

- **Skip tests** (.skip, .only in commits)
- **Share state** (between tests)
- **Test implementation** (test behavior)
- **Write tests after** (TDD first)
- **Ignore failing tests** (fix immediately)
- **Test 3rd party** (trust libraries)
- **Use real DB in unit** (mock it)
- **Commit flaky tests** (fix or remove)
- **Lower standards** (always 90%)
- **Mix test types** (unit vs integration)

## Next Steps

- [Unit Testing Guide](./unit-testing.md) - Detailed unit testing patterns
- [Integration Testing Guide](./integration-testing.md) - Testing interactions
- [E2E Testing Guide](./e2e-testing.md) - End-to-end testing
- [Test Factories](./test-factories.md) - Generating test data
- [Mocking Strategies](./mocking.md) - Effective mocking with Vitest

---

**Last Updated**: 2024-11-05

**Maintained By**: QA Team

**Related Documentation**:

- [Code Standards](../development/code-standards.md)
- [Architecture Patterns](../architecture/patterns.md)
