---
name: tdd-methodology
description: Test-Driven Development with RED-GREEN-REFACTOR cycle. Use when writing tests before implementation or practicing TDD methodology.
---

# TDD Methodology

## Purpose

Guide Test-Driven Development using the RED-GREEN-REFACTOR cycle. This skill ensures testable, well-designed code with comprehensive coverage by writing tests before implementation, producing clean architectures and 90%+ code coverage as a natural outcome.

## When to Use

- When implementing new features
- When fixing bugs (write a failing test first)
- When refactoring existing code
- When designing complex business logic
- As the default development approach for all production code

## The TDD Cycle

### RED -> GREEN -> REFACTOR

**RED**: Write a failing test that describes expected behavior.
**GREEN**: Write the minimum code necessary to make the test pass.
**REFACTOR**: Improve code quality while keeping all tests green.

Target cycle time: 2-10 minutes per iteration.

## Process

### Step 1: RED - Write a Failing Test

**Objective**: Define expected behavior through a test that does not pass.

**Actions:**

1. Identify a single behavior to test
2. Write a test describing the expected outcome
3. Run the test -- it MUST fail
4. Verify the failure message is clear and meaningful

**Example:**

```typescript
describe('OrderService', () => {
  it('should create an order with valid items', async () => {
    const service = new OrderService();

    const order = await service.create({
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
    });

    expect(order).toHaveProperty('id');
    expect(order.status).toBe('pending');
  });
});

// Run tests -> FAIL: OrderService is not defined
```

### Step 2: GREEN - Make the Test Pass

**Objective**: Write the simplest code that satisfies the test.

**Actions:**

1. Write the minimal implementation to pass the test
2. Do not add extra features or optimizations
3. Run the test -- it MUST pass

**Example:**

```typescript
export class OrderService {
  async create(data: CreateOrderInput): Promise<Order> {
    return {
      id: 'order-1',
      status: 'pending',
      ...data,
    };
  }
}

// Run tests -> PASS
```

### Step 3: REFACTOR - Improve the Code

**Objective**: Clean up and improve the design while all tests remain green.

**Actions:**

1. Remove duplication
2. Improve naming
3. Extract methods or classes
4. Apply appropriate design patterns
5. Run tests after every change -- they MUST stay green

**Example:**

```typescript
export class OrderService {
  constructor(
    private orderRepository: OrderRepository,
    private validator: OrderValidator
  ) {}

  async create(data: CreateOrderInput): Promise<Order> {
    await this.validator.validate(data);

    const order = await this.orderRepository.create({
      ...data,
      status: 'pending',
    });

    return order;
  }
}

// Run tests -> PASS (still passing after refactor)
```

### Step 4: Repeat

Pick the next behavior. Write a failing test (RED). Make it pass (GREEN). Refactor (REFACTOR). Commit when tests are green.

## Three Laws of TDD

1. **Do not write production code** until you have a failing test
2. **Do not write more test code** than is needed to fail
3. **Do not write more production code** than is needed to pass

## TDD Across Application Layers

### Data Access Layer

```typescript
// RED
it('should find an order by ID', async () => {
  const repo = new OrderRepository(db);
  const order = await repo.findById('order-1');
  expect(order).toBeDefined();
});

// GREEN
class OrderRepository {
  async findById(id: string) {
    return await this.db.orders.findFirst({ where: { id } });
  }
}

// REFACTOR: add error handling
async findById(id: string) {
  const order = await this.db.orders.findFirst({ where: { id } });
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  return order;
}
```

### Service Layer

```typescript
// RED
it('should reject orders with no items', async () => {
  await expect(
    service.create({ customerId: 'cust-1', items: [] })
  ).rejects.toThrow('Order must contain at least one item');
});

// GREEN
async create(data: CreateOrderInput) {
  if (data.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }
  return await this.repository.create(data);
}

// REFACTOR: extract validator
class OrderValidator {
  validateItems(items: OrderItem[]) {
    if (items.length === 0) {
      throw new ValidationError('Order must contain at least one item');
    }
  }
}
```

### API Layer

```typescript
// RED
it('POST /orders should return 201', async () => {
  const response = await app.request('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validOrder),
  });
  expect(response.status).toBe(201);
});

// GREEN
app.post('/api/orders', async (c) => {
  const data = await c.req.json();
  const order = await orderService.create(data);
  return c.json(order, 201);
});

// REFACTOR: add schema validation middleware
app.post('/api/orders', validate('json', createOrderSchema), async (c) => {
  const data = c.req.valid('json');
  const order = await orderService.create(data);
  return c.json(order, 201);
});
```

## Coverage Goals

- **Unit Tests**: >= 90% line coverage
- **Integration Tests**: All critical paths covered
- **E2E Tests**: Happy-path user journeys

## Common Mistakes to Avoid

1. **Writing tests after code**: Code is already designed; tests merely confirm rather than drive design
2. **Writing too many tests at once**: Focus on one behavior per test cycle
3. **Writing too much production code**: Only add what is needed to pass the current test
4. **Skipping the refactor step**: Technical debt accumulates if you never clean up
5. **Not running tests frequently**: You lose the rapid feedback loop that makes TDD effective

## Best Practices

1. **Start simple** -- test the simplest case first
2. **One assertion per test** -- each test checks one logical behavior
3. **Clear names** -- test names describe expected behavior
4. **Fast feedback** -- keep the full test suite running in seconds
5. **Isolated tests** -- no test depends on another
6. **Deterministic** -- same result every run
7. **Readable** -- tests serve as living documentation
8. **Maintain tests** -- refactor tests alongside production code
9. **AAA pattern** -- Arrange, Act, Assert in every test
10. **Commit on green** -- commit working code frequently

## Notes

- TDD is a design discipline, not just a testing technique
- Initial velocity may feel slower, but long-term velocity increases
- Debugging time drops significantly with a comprehensive test suite
- Tests become living documentation of system behavior
- 90% coverage minimum is a natural result, not an afterthought
