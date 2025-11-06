# Hospeda Code Examples Repository

Comprehensive, working code examples demonstrating Hospeda's architectural patterns, best practices, and development workflows.

## Purpose

This examples repository serves as:

- **Learning Resource**: Understand Hospeda patterns through practical examples
- **Reference Guide**: Copy-paste working code for common scenarios
- **Quality Standard**: See how to write tests, documentation, and maintainable code
- **Onboarding Tool**: Accelerate new developer productivity

## Prerequisites

Before using these examples, ensure you have:

- **Node.js**: v20.10.0 or higher
- **PNPM**: v8.15.6 or higher
- **PostgreSQL**: v15 or higher (or Docker for local development)
- **Basic TypeScript**: Understanding of TypeScript and async/await

### Development Environment

```bash
# Clone repository
git clone https://github.com/hospeda/hospeda.git
cd hospeda

# Install dependencies
pnpm install

# Set up database
pnpm db:fresh

# Run tests
pnpm test
```

## Examples Catalog

### 1. Basic CRUD Operations

**Path**: `/docs/examples/basic-crud/`

Learn the fundamental CRUD pattern used throughout Hospeda:

- ✅ Zod validation schemas
- ✅ Drizzle ORM model extending `BaseModel`
- ✅ Service extending `BaseCrudService`
- ✅ Hono API routes using factory patterns
- ✅ Complete test suite with TDD approach

**Use When**:

- Creating a new entity
- Understanding the core architecture
- Learning the Schema → Model → Service → Route flow

**Difficulty**: 🟢 Beginner

---

### 2. Advanced Service Patterns

**Path**: `/docs/examples/advanced-service/`

Explore complex service implementations with business logic:

- ✅ Transaction handling
- ✅ Multiple database operations in one method
- ✅ Actor-based authorization
- ✅ ServiceOutput error handling
- ✅ Custom business validations
- ✅ Permission checking

**Use When**:

- Implementing complex business logic
- Coordinating multiple database operations
- Handling multi-step workflows
- Enforcing business rules

**Difficulty**: 🟡 Intermediate

---

### 3. Custom Zod Validators

**Path**: `/docs/examples/custom-validation/`

Master Zod validation patterns for robust input validation:

- ✅ Custom validator functions
- ✅ Schema refinements and transforms
- ✅ Reusable validation patterns
- ✅ Error message customization
- ✅ Composition and chaining

**Use When**:

- Creating domain-specific validators
- Validating complex business rules
- Customizing error messages
- Building reusable validation logic

**Difficulty**: 🟡 Intermediate

---

### 4. Testing Patterns

**Path**: `/docs/examples/testing-patterns/`

Comprehensive testing strategies and examples:

- ✅ Red-Green-Refactor TDD workflow
- ✅ AAA (Arrange, Act, Assert) pattern
- ✅ Unit testing with mocks
- ✅ Integration testing with database
- ✅ Test fixtures and factories
- ✅ Coverage optimization

**Use When**:

- Writing tests for new features
- Learning TDD methodology
- Mocking dependencies
- Creating test data

**Difficulty**: 🟡 Intermediate

---

## Quick Start Guide

### Example 1: Creating a Simple Entity

Let's create a "Category" entity step by step:

#### 1. Define Zod Schema (`packages/schemas/`)

```typescript
import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(50),
  slug: z.string().min(1),
  description: z.string().max(500).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Category = z.infer<typeof CategorySchema>;
```

#### 2. Create Drizzle Model (`packages/db/`)

```typescript
import { BaseModel } from '@repo/db/base';
import { categories } from '../schemas/category.dbschema';
import type { Category } from '@repo/schemas';

export class CategoryModel extends BaseModel<Category> {
  protected table = categories;
  protected entityName = 'category';

  protected getTableName(): string {
    return 'categories';
  }
}
```

#### 3. Implement Service (`packages/service-core/`)

```typescript
import { BaseCrudService } from '@repo/service-core/base';
import { CategoryModel } from '@repo/db';
import type { Category } from '@repo/schemas';

export class CategoryService extends BaseCrudService<
  Category,
  CategoryModel,
  typeof CategoryCreateInputSchema,
  typeof CategoryUpdateInputSchema,
  typeof CategorySearchInputSchema
> {
  constructor(ctx: ServiceContext, model?: CategoryModel) {
    super(ctx, model ?? new CategoryModel());
  }

  // Permission checks
  protected _canCreate(actor: Actor, data: CategoryCreateInput): void {
    checkCanCreateCategory(actor);
  }

  protected _canUpdate(actor: Actor, entity: Category): void {
    checkCanUpdateCategory(actor, entity);
  }

  // ... other permission methods
}
```

#### 4. Create API Routes (`apps/api/`)

```typescript
import { Hono } from 'hono';
import { CategoryService } from '@repo/service-core';
import { createCRUDRoute } from '../factories';

const app = new Hono();

// Automatically creates GET, POST, PUT, DELETE routes
app.route('/categories', createCRUDRoute(CategoryService));

export default app;
```

#### 5. Write Tests

See `/docs/examples/basic-crud/test.ts` for complete testing examples.

---

## Architecture Overview

Hospeda follows a layered architecture:

```text
┌─────────────────────────────────────┐
│   Frontend (Astro/React/TanStack)   │
│   - Web App                         │
│   - Admin Dashboard                 │
└─────────────────────────────────────┘
                ↓ HTTP/JSON
┌─────────────────────────────────────┐
│        API Layer (Hono)             │
│   - Routes                          │
│   - Middleware (Auth, Validation)   │
│   - Error Handling                  │
└─────────────────────────────────────┘
                ↓ RO-RO Pattern
┌─────────────────────────────────────┐
│      Service Layer                  │
│   - Business Logic                  │
│   - Validation (Zod)                │
│   - Orchestration                   │
└─────────────────────────────────────┘
                ↓ Type-safe calls
┌─────────────────────────────────────┐
│    Data Access Layer (Models)       │
│   - CRUD operations                 │
│   - Queries (Drizzle ORM)           │
└─────────────────────────────────────┘
                ↓ SQL
┌─────────────────────────────────────┐
│   Database (PostgreSQL/Neon)        │
└─────────────────────────────────────┘
```

## Key Patterns

### RO-RO (Receive Object, Return Object)

All functions receive a single object parameter and return a single object:

```typescript
// ✅ GOOD - RO-RO pattern
async function createAccommodation(input: {
  actor: Actor;
  data: CreateAccommodationInput;
}): Promise<ServiceOutput<Accommodation>> {
  // ...
}

// ❌ BAD - Multiple parameters
async function createAccommodation(
  actor: Actor,
  data: CreateAccommodationInput
): Promise<Accommodation | null> {
  // ...
}
```

### Type Inference from Zod

Types are inferred from Zod schemas, not defined separately:

```typescript
// ✅ GOOD - Types from schemas
export const AccommodationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

export type Accommodation = z.infer<typeof AccommodationSchema>;

// ❌ BAD - Separate type definition
export interface Accommodation {
  id: string;
  name: string;
}
```

### Service Result Pattern

Services return `ServiceOutput<T>` for consistent error handling:

```typescript
type ServiceOutput<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: ServiceError; data?: never };

// Usage
const result = await service.create(actor, data);

if (!result.success) {
  return c.json({ error: result.error.message }, 400);
}

return c.json({ data: result.data });
```

### Factory Pattern for Routes

Use route factories instead of manual route creation:

```typescript
// ✅ GOOD - Factory pattern
app.route('/accommodations', createCRUDRoute(AccommodationService));

// ❌ BAD - Manual routes
app.get('/accommodations', async (c) => { /* ... */ });
app.post('/accommodations', async (c) => { /* ... */ });
app.put('/accommodations/:id', async (c) => { /* ... */ });
app.delete('/accommodations/:id', async (c) => { /* ... */ });
```

## Development Workflow

### TDD Red-Green-Refactor

All examples follow Test-Driven Development:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make it pass
3. **Refactor**: Improve code while keeping tests green

```typescript
// 1. RED - Write failing test
describe('CategoryService', () => {
  it('should create category', async () => {
    const result = await service.create(actor, validData);
    expect(result.success).toBe(true);
  });
});

// 2. GREEN - Implement minimal functionality
async create(actor, data) {
  return { success: true, data: await this.model.create(data) };
}

// 3. REFACTOR - Add validation, error handling, etc.
async create(actor, data) {
  const validated = this.createSchema.parse(data);
  this._canCreate(actor, validated);
  const entity = await this.model.create(validated);
  return { success: true, data: entity };
}
```

### Code Standards

- **No `any` type**: Use `unknown` with type guards
- **Named exports only**: No default exports
- **RO-RO pattern**: Single object in, single object out
- **Max 500 lines per file**: Split larger files
- **Comprehensive JSDoc**: Document all exports
- **90% test coverage**: No exceptions

See [Code Standards](../.claude/docs/standards/code-standards.md) for complete guidelines.

## Common Use Cases

### Create a New Entity

1. Start with **Basic CRUD** example
2. Define schemas in `@repo/schemas`
3. Create model in `@repo/db`
4. Implement service in `@repo/service-core`
5. Add routes in `apps/api`
6. Write tests

### Add Complex Business Logic

1. Review **Advanced Service** example
2. Override lifecycle hooks in service
3. Use transactions for multi-step operations
4. Add permission checks
5. Test all edge cases

### Custom Validation Rules

1. See **Custom Validation** example
2. Create reusable validators in `@repo/schemas/utils`
3. Use `.refine()` for complex rules
4. Customize error messages
5. Test validation edge cases

### Write Effective Tests

1. Follow **Testing Patterns** example
2. Use AAA pattern (Arrange, Act, Assert)
3. Mock external dependencies
4. Create test fixtures
5. Aim for 90%+ coverage

## File Naming Conventions

```text
schemas/
  entity-name.schema.ts         # Main entity schema
  entity-name.crud.schema.ts    # CRUD schemas
  entity-name.relations.schema.ts # Relation schemas

db/
  models/
    entity-name.model.ts        # Model implementation
  schemas/
    entity-name.dbschema.ts     # Drizzle table schema

service-core/
  services/
    entity-name/
      entity-name.service.ts    # Service implementation
      entity-name.permissions.ts # Permission checks
      entity-name.normalizers.ts # Data normalization
      entity-name.helpers.ts    # Helper functions

api/
  routes/
    entity-name/
      index.ts                  # Route aggregator
      create.ts                 # Create endpoint
      update.ts                 # Update endpoint
      getById.ts                # Get by ID endpoint
```

## Additional Resources

### Documentation

- **[Quick Start Guide](../.claude/docs/quick-start.md)**: 15-minute onboarding
- **[Workflow Decision Tree](../.claude/docs/workflows/decision-tree.md)**: Choose the right workflow
- **[Architecture Patterns](../.claude/docs/standards/architecture-patterns.md)**: Design patterns
- **[Testing Standards](../.claude/docs/standards/testing-standards.md)**: Testing guidelines

### Tools

- **Drizzle Studio**: Visual database tool (`pnpm db:studio`)
- **Context7**: Library documentation (via MCP)
- **Vitest**: Test runner with UI (`pnpm test --ui`)

### Key Packages

- `@repo/schemas` - Zod validation schemas
- `@repo/db` - Drizzle ORM models
- `@repo/service-core` - Business logic services
- `@repo/utils` - Shared utilities

## Getting Help

### When Examples Don't Cover Your Case

1. **Check existing code**: Search for similar patterns in the codebase
2. **Review documentation**: See [.claude/docs/](./.claude/docs/) for detailed guides
3. **Ask for guidance**: Consult with tech lead or team
4. **Document new patterns**: Add examples when you solve novel problems

### Common Mistakes to Avoid

- ❌ Using `any` type instead of `unknown`
- ❌ Creating default exports instead of named exports
- ❌ Skipping tests or writing them after code
- ❌ Not running quality checks before committing
- ❌ Making autonomous architectural decisions
- ❌ Creating separate type files (use `z.infer<typeof schema>`)

See [Common Mistakes](../.claude/docs/learnings/common-mistakes-to-avoid.md) for more.

## Contributing Examples

If you create a useful pattern or solve a common problem:

1. Document it thoroughly
2. Add tests demonstrating the pattern
3. Include inline comments explaining WHY, not WHAT
4. Submit a PR with the example
5. Update this README with the new example

## License

These examples are part of the Hospeda project and follow the same license.

---

**Last Updated**: 2025-11-06

**Maintained By**: Tech Lead & Development Team

**Questions?** See [CLAUDE.md](../../CLAUDE.md) for project guidance
