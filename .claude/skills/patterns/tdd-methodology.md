---
name: tdd-methodology
category: patterns
description: Test-Driven Development workflow (RED-GREEN-REFACTOR) ensuring 90%+ coverage and design quality
usage: Use when implementing new features to ensure testability, design quality, and comprehensive test coverage
input: Feature requirements, acceptance criteria, technical specifications
output: Test files written before implementation, 90%+ coverage, well-designed code
---

# TDD Methodology

## Overview

**Purpose**: Test-Driven Development approach ensuring testable, well-designed code with comprehensive coverage

**Category**: Patterns
**Primary Users**: All engineers (hono-engineer, react-senior-dev, db-drizzle-engineer, qa-engineer)

## When to Use This Skill

- When implementing new features
- When fixing bugs (write failing test first)
- When refactoring code
- When designing complex logic
- Always (TDD should be default approach)

## The TDD Cycle

### RED → GREEN → REFACTOR

**RED**: Write a failing test
**GREEN**: Write minimum code to pass
**REFACTOR**: Improve code while keeping tests green

**Cycle time**: 2-10 minutes per iteration

## Workflow

### Step 1: RED - Write Failing Test

**Objective**: Define expected behavior through a failing test

**Actions:**

1. Identify single behavior to test
2. Write test that describes expected behavior
3. Run test - it MUST fail
4. Verify failure message is clear

**Example:**

```typescript
// Step 1: RED - Write failing test
describe('BookingService', () => {
  it('should create booking with valid dates', async () => {
    const service = new BookingService();

    const booking = await service.create({
      accommodationId: 'acc-1',
      checkIn: '2024-02-01',
      checkOut: '2024-02-05',
      guests: 2
    });

    expect(booking).toHaveProperty('id');
    expect(booking.status).toBe('pending');
  });
});

// Run: pnpm test
// Result: FAIL - BookingService is not defined
```

### Step 2: GREEN - Make Test Pass

**Objective**: Write minimum code to make test pass

**Actions:**

1. Write simplest code that passes test
2. Don't add extra features
3. Don't optimize yet
4. Run test - it MUST pass

**Example:**

```typescript
// Step 2: GREEN - Minimum implementation
export class BookingService {
  async create(data) {
    return {
      id: 'booking-1',
      status: 'pending',
      ...data
    };
  }
}

// Run: pnpm test
// Result: PASS ✓
```

### Step 3: REFACTOR - Improve Code

**Objective**: Improve design while keeping tests green

**Actions:**

1. Remove duplication
2. Improve names
3. Extract methods/classes
4. Apply design patterns
5. Run tests after each change
6. Tests MUST stay green

**Example:**

```typescript
// Step 3: REFACTOR - Add proper implementation
export class BookingService extends BaseCrudService<Booking> {
  constructor(
    private bookingModel: BookingModel,
    private validator: BookingValidator
  ) {
    super(bookingModel);
  }

  async create(data: CreateBookingInput): Promise<Booking> {
    // Validate dates
    await this.validator.validateDates(data);

    // Create booking
    const booking = await this.bookingModel.create({
      ...data,
      status: 'pending'
    });

    return booking;
  }
}

// Run: pnpm test
// Result: PASS ✓ (still passing)
```

### Step 4: Repeat

**Objective**: Continue cycle for next behavior

**Actions:**

1. Pick next behavior
2. Write failing test (RED)
3. Make it pass (GREEN)
4. Refactor (REFACTOR)
5. Commit when tests green

## TDD Rules

### Three Laws of TDD (Uncle Bob)

1. **Don't write production code** until you have a failing test
2. **Don't write more test** than needed to fail
3. **Don't write more production code** than needed to pass

### Additional Guidelines

- **One test at a time**: Focus on single behavior
- **Test names describe behavior**: Clear, descriptive names
- **AAA pattern**: Arrange, Act, Assert
- **Fast tests**: Tests should run in seconds
- **Independent tests**: No test dependencies
- **Repeatable**: Same results every time

## Benefits of TDD

1. **Design Quality**: Forces modular, testable design
2. **Coverage**: 90%+ coverage naturally achieved
3. **Documentation**: Tests document behavior
4. **Confidence**: Safe refactoring
5. **Bug Prevention**: Catches issues early
6. **Focus**: One thing at a time

## Common Mistakes

### ❌ Writing Tests After Code

**Why bad**: Code already designed, tests fit code instead of driving design

**Fix**: Always write test first

### ❌ Writing Too Much Test

**Why bad**: Wastes time, test becomes complex

**Fix**: Write minimal test that fails

### ❌ Writing Too Much Code

**Why bad**: Adds unnecessary complexity

**Fix**: Write just enough to pass

### ❌ Skipping Refactor

**Why bad**: Code becomes messy over time

**Fix**: Refactor after each GREEN

### ❌ Not Running Tests Frequently

**Why bad**: Miss immediate feedback

**Fix**: Run tests after each step

## TDD with Different Layers

### Database Layer (Drizzle + Model)

```typescript
// RED: Write failing test
it('should find booking by ID', async () => {
  const model = new BookingModel(db);
  const booking = await model.findById('booking-1');
  expect(booking).toBeDefined();
});

// GREEN: Implement
class BookingModel extends BaseModel<Booking> {
  async findById(id: string) {
    return await db.bookings.findFirst({
      where: eq(bookings.id, id)
    });
  }
}

// REFACTOR: Add error handling
async findById(id: string) {
  const booking = await db.bookings.findFirst({
    where: eq(bookings.id, id)
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  return booking;
}
```

### Service Layer

```typescript
// RED: Business logic test
it('should not allow booking with past dates', async () => {
  await expect(
    service.create({
      checkIn: '2020-01-01',
      checkOut: '2020-01-05'
    })
  ).rejects.toThrow('Past dates not allowed');
});

// GREEN: Implement validation
async create(data) {
  if (new Date(data.checkIn) < new Date()) {
    throw new Error('Past dates not allowed');
  }
  return await this.model.create(data);
}

// REFACTOR: Extract validator
class DateValidator {
  validateNotPast(date: string) {
    if (new Date(date) < new Date()) {
      throw new ValidationError('Past dates not allowed');
    }
  }
}
```

### API Layer

```typescript
// RED: API test
it('POST /bookings should return 201', async () => {
  const response = await app.request('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(validBooking)
  });

  expect(response.status).toBe(201);
});

// GREEN: Implement route
app.post('/api/bookings', async (c) => {
  const data = await c.req.json();
  const booking = await service.create(data);
  return c.json(booking, 201);
});

// REFACTOR: Add validation
app.post('/api/bookings', 
  zValidator('json', createBookingSchema),
  async (c) => {
    const data = c.req.valid('json');
    const booking = await service.create(data);
    return c.json(booking, 201);
  }
);
```

## Coverage Goals

- **Unit Tests**: >= 90%
- **Integration Tests**: All critical paths
- **E2E Tests**: Happy paths

## Best Practices

1. **Start Simple**: Test simplest case first
2. **One Assert**: One logical assertion per test
3. **Clear Names**: Test name explains what's tested
4. **Fast Feedback**: Keep tests fast (< 5s total)
5. **Isolated**: Tests don't depend on each other
6. **Deterministic**: Always same result
7. **Readable**: Tests as documentation
8. **Maintainable**: Refactor tests too

## Related Skills

- `api-app-testing` - API-specific testing patterns
- `performance-testing` - Performance validation
- `security-testing` - Security testing approach

## Notes

- TDD is a design discipline, not just testing
- Slower at first, faster long-term
- Reduces debugging time significantly
- Makes refactoring safe and confident
- Tests become living documentation
- 90% coverage minimum for all code
