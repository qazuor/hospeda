# Architecture Patterns

This document defines the architecture patterns and principles for building maintainable, scalable applications.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Layer Architecture](#layer-architecture)
3. [SOLID Principles](#solid-principles)
4. [Clean Architecture](#clean-architecture)
5. [Common Patterns](#common-patterns)
6. [Separation of Concerns](#separation-of-concerns)
7. [Dependency Management](#dependency-management)
8. [Error Boundaries](#error-boundaries)

---

## Core Principles

### DRY (Don't Repeat Yourself)

- Extract shared logic into utility functions
- Use base classes for common operations
- Centralize validation schemas
- Share types across layers

### KISS (Keep It Simple, Stupid)

- Favor simple solutions over clever ones
- Avoid premature optimization
- Use well-known patterns before inventing new ones
- Readable code is more important than concise code

### YAGNI (You Aren't Gonna Need It)

- Build only what is needed now
- Do not add abstractions for future hypothetical use
- Remove unused code promptly
- Extend when needed, not before

---

## Layer Architecture

### Standard Layer Structure

```
Presentation Layer (UI / API Routes)
        |
   Application Layer (Use Cases / Controllers)
        |
   Domain Layer (Business Logic / Services)
        |
   Infrastructure Layer (Database / External APIs)
```

### Layer Responsibilities

| Layer | Responsibility | Examples |
|-------|---------------|----------|
| **Presentation** | Handle user input/output, HTTP, rendering | API routes, UI components, CLI |
| **Application** | Orchestrate use cases, coordinate services | Controllers, handlers, middleware |
| **Domain** | Business rules, validation, core logic | Services, entities, value objects |
| **Infrastructure** | Data persistence, external integrations | Repositories, API clients, ORM |

### Layer Rules

1. **Dependencies flow inward** - outer layers depend on inner layers, never reverse
2. **No layer skipping** - presentation must not call infrastructure directly
3. **Interfaces at boundaries** - use abstractions between layers
4. **Each layer testable independently** - mock the layer below

### Example: API Request Flow

```typescript
// 1. Presentation: Route handler receives HTTP request
app.post('/api/users', authMiddleware, async (c) => {
  const input = c.req.valid('json');
  // 2. Application: Controller coordinates
  const result = await userController.create({ input, user: c.get('user') });
  // 3. Returns HTTP response
  return c.json({ success: true, data: result }, 201);
});

// 4. Domain: Service contains business logic
class UserService {
  async create({ input, user }: CreateUserInput): Promise<CreateUserOutput> {
    this.validatePermissions(user);
    this.validateBusinessRules(input);
    // 5. Infrastructure: Repository handles data persistence
    const newUser = await this.repository.create(input);
    return { user: newUser };
  }
}
```

---

## SOLID Principles

### S - Single Responsibility Principle

Each module, class, or function should have one reason to change.

```typescript
// BAD: Multiple responsibilities
class UserService {
  async createUser() { /* ... */ }
  async sendEmail() { /* ... */ }
  async generateReport() { /* ... */ }
}

// GOOD: Single responsibility each
class UserService { async createUser() { /* ... */ } }
class EmailService { async sendEmail() { /* ... */ } }
class ReportService { async generateReport() { /* ... */ } }
```

### O - Open/Closed Principle

Open for extension, closed for modification.

```typescript
// GOOD: Extensible via strategy pattern
type PricingStrategy = {
  calculate: (input: PriceInput) => number;
};

const standardPricing: PricingStrategy = {
  calculate: ({ base, quantity }) => base * quantity,
};

const discountPricing: PricingStrategy = {
  calculate: ({ base, quantity }) => base * quantity * 0.9,
};

const calculateTotal = (strategy: PricingStrategy, input: PriceInput): number => {
  return strategy.calculate(input);
};
```

### L - Liskov Substitution Principle

Subtypes must be substitutable for their base types.

### I - Interface Segregation Principle

Prefer many small interfaces over one large interface.

```typescript
// BAD: Fat interface
type CrudService = {
  create: () => void;
  read: () => void;
  update: () => void;
  delete: () => void;
  export: () => void;
  import: () => void;
  audit: () => void;
};

// GOOD: Segregated interfaces
type Readable = { read: () => void };
type Writable = { create: () => void; update: () => void; delete: () => void };
type Exportable = { export: () => void; import: () => void };
```

### D - Dependency Inversion Principle

Depend on abstractions, not concrete implementations.

```typescript
// GOOD: Depend on abstraction
type UserRepository = {
  findById: (id: string) => Promise<User | null>;
  create: (data: CreateUserInput) => Promise<User>;
};

class UserService {
  constructor(private repository: UserRepository) {}
  // Works with any implementation of UserRepository
}
```

---

## Clean Architecture

### Domain-Centric Design

The domain layer is the core of the application. It contains:

- **Entities**: Core business objects with identity
- **Value Objects**: Immutable objects without identity
- **Domain Services**: Business operations spanning multiple entities
- **Domain Events**: Things that happened in the domain

### Dependency Rule

Source code dependencies must point inward. Nothing in an inner circle can know about something in an outer circle.

```
[External] -> [Infrastructure] -> [Application] -> [Domain]
```

### Ports and Adapters

- **Ports**: Interfaces defined by the domain (what it needs)
- **Adapters**: Implementations that satisfy ports (how it's done)

```typescript
// Port (defined by domain)
type NotificationPort = {
  send: (message: string, recipient: string) => Promise<void>;
};

// Adapter (implementation)
class EmailAdapter implements NotificationPort {
  async send(message: string, recipient: string) {
    await emailClient.send({ to: recipient, body: message });
  }
}

// Another adapter (swap without changing domain)
class SlackAdapter implements NotificationPort {
  async send(message: string, recipient: string) {
    await slackClient.postMessage({ channel: recipient, text: message });
  }
}
```

---

## Common Patterns

### Repository Pattern

Abstracts data access behind a consistent interface.

```typescript
type Repository<T> = {
  findById: (id: string) => Promise<T | null>;
  findAll: (filters?: Partial<T>) => Promise<T[]>;
  create: (data: Omit<T, 'id'>) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  delete: (id: string) => Promise<void>;
};
```

### Factory Pattern

Creates objects with consistent configuration.

```typescript
const createApiRoute = <T>(config: RouteConfig<T>) => {
  return {
    list: createListHandler(config),
    getById: createGetHandler(config),
    create: createCreateHandler(config),
    update: createUpdateHandler(config),
    delete: createDeleteHandler(config),
  };
};
```

### Service Pattern

Encapsulates business logic in reusable services.

```typescript
class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private paymentService: PaymentService,
    private notificationService: NotificationService,
  ) {}

  async placeOrder({ input, user }: PlaceOrderInput): Promise<PlaceOrderOutput> {
    const order = await this.orderRepo.create(input);
    await this.paymentService.charge({ orderId: order.id, amount: order.total });
    await this.notificationService.send({ userId: user.id, type: 'order_placed' });
    return { order };
  }
}
```

---

## Separation of Concerns

### By Feature (Recommended)

```
features/
  users/
    user.service.ts
    user.repository.ts
    user.controller.ts
    user.types.ts
    user.test.ts
  orders/
    order.service.ts
    order.repository.ts
    order.controller.ts
    order.types.ts
    order.test.ts
```

### By Layer (Alternative)

```
services/
  user.service.ts
  order.service.ts
repositories/
  user.repository.ts
  order.repository.ts
controllers/
  user.controller.ts
  order.controller.ts
```

---

## Dependency Management

### Dependency Injection

```typescript
// GOOD: Dependencies injected via constructor
class UserService {
  constructor(
    private db: Database,
    private cache: CacheService,
    private logger: Logger,
  ) {}
}

// Usage
const service = new UserService(database, redisCache, winstonLogger);
```

### Avoid Circular Dependencies

- Use interfaces at module boundaries
- Extract shared types into a separate module
- Use dependency inversion to break cycles

---

## Error Boundaries

### Layer-Specific Error Handling

```typescript
// Infrastructure: Database errors
class RepositoryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
  }
}

// Domain: Business rule violations
class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

// Application: Maps domain errors to HTTP responses
const errorHandler = (error: Error) => {
  if (error instanceof DomainError) {
    return { status: 400, body: { code: error.code, message: error.message } };
  }
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };
};
```

---

## Summary

- Follow layered architecture with inward dependencies
- Apply SOLID principles consistently
- Keep domain logic free from infrastructure concerns
- Use dependency injection for testability
- Organize code by feature when possible
- Handle errors at appropriate boundaries
- Prefer composition over inheritance

---

**Architecture decisions should be documented in ADRs. Deviations require team discussion and approval.**
