# Basic CRUD Example - Category Entity

This example demonstrates the complete CRUD (Create, Read, Update, Delete) pattern used throughout Hospeda.

## Overview

We'll create a simple "Category" entity that shows the full workflow:

1. **Schema** - Zod validation schema
2. **Model** - Drizzle ORM model extending `BaseModel`
3. **Service** - Business logic extending `BaseCrudService`
4. **Route** - Hono API routes (factory pattern)
5. **Tests** - Complete test suite following TDD

## File Structure

```text
/docs/examples/basic-crud/
├── README.md            # This file
├── schema.ts            # Zod validation schemas
├── model.ts             # Drizzle model
├── service.ts           # Service layer
├── route.ts             # API routes
└── test.ts              # Test suite
```

## Entity: Category

A category is a simple entity for organizing content (accommodations, posts, etc.).

### Fields

- `id` (UUID) - Unique identifier
- `name` (string) - Category name (2-50 characters)
- `slug` (string) - URL-friendly identifier (auto-generated from name)
- `description` (string, optional) - Description (max 500 characters)
- `color` (enum) - Display color (red, blue, green, etc.)
- `icon` (string, optional) - Icon name (2-50 characters)
- `createdAt` (date) - Creation timestamp
- `updatedAt` (date) - Last update timestamp
- `createdById` (UUID) - User who created
- `updatedById` (UUID) - User who last updated
- `deletedAt` (date, optional) - Soft deletion timestamp
- `deletedById` (UUID, optional) - User who deleted
- `lifecycleState` (enum) - ACTIVE, ARCHIVED, DRAFT

## Learning Path

### Step 1: Understand Schemas (`schema.ts`)

**Key Concepts:**

- Types are inferred from Zod schemas using `z.infer<typeof schema>`
- CRUD schemas are derived from base schema using `.omit()` and `.partial()`
- Error messages use i18n keys for internationalization
- Named exports only (no default exports)

**Patterns:**

```typescript
// Base schema - complete entity structure
export const CategorySchema = z.object({ /* fields */ });
export type Category = z.infer<typeof CategorySchema>;

// Create schema - omits auto-generated fields
export const CategoryCreateInputSchema = CategorySchema.omit({
  id: true,
  createdAt: true,
  // ... other audit fields
});

// Update schema - all fields optional
export const CategoryUpdateInputSchema = CategorySchema.omit({
  /* audit fields */
}).partial();
```

### Step 2: Build Model (`model.ts`)

**Key Concepts:**

- All models extend `BaseModel<T>`
- Model provides CRUD operations (findById, create, update, delete, etc.)
- Minimal boilerplate - just table definition and entity name
- Models are stateless - create new instances as needed

**Patterns:**

```typescript
export class CategoryModel extends BaseModel<Category> {
  // Define table reference
  protected table = categories;

  // Entity name for logging
  protected entityName = 'category';

  // Table name for relations
  protected getTableName(): string {
    return 'categories';
  }
}
```

### Step 3: Implement Service (`service.ts`)

**Key Concepts:**

- Services extend `BaseCrudService<TEntity, TModel, TCreate, TUpdate, TSearch>`
- Implements all permission checks via hooks (`_canCreate`, `_canUpdate`, etc.)
- Business logic goes here (not in models or routes)
- Returns `ServiceOutput<T>` for consistent error handling

**Patterns:**

```typescript
export class CategoryService extends BaseCrudService<...> {
  // Initialize with model
  constructor(ctx: ServiceContext, model?: CategoryModel) {
    super(ctx, 'category');
    this.model = model ?? new CategoryModel();
  }

  // Permission hooks
  protected _canCreate(actor: Actor, data: CategoryCreateInput): void {
    // Check permissions
  }

  // Custom business methods
  public async findBySlug(actor: Actor, slug: string) {
    return this.getByField(actor, 'slug', slug);
  }
}
```

### Step 4: Create Routes (`route.ts`)

**Key Concepts:**

- Routes delegate all logic to services
- Use route factories when possible
- Validate input with Zod schemas
- Return consistent JSON responses

**Patterns:**

```typescript
// Factory pattern (preferred)
app.route('/categories', createCRUDRoute(CategoryService));

// Manual routes (when factory doesn't fit)
app.get('/categories/:id', async (c) => {
  const result = await service.getById(actor, id);

  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }

  return c.json({ data: result.data });
});
```

### Step 5: Write Tests (`test.ts`)

**Key Concepts:**

- Follow TDD: Red → Green → Refactor
- Use AAA pattern: Arrange, Act, Assert
- Test all CRUD operations
- Test error cases and edge cases
- Aim for 90%+ coverage

**Patterns:**

```typescript
describe('CategoryService', () => {
  // Arrange - Setup
  beforeEach(() => {
    service = new CategoryService(testContext);
  });

  it('should create category', async () => {
    // Arrange - Prepare data
    const data = { name: 'Test Category', color: 'BLUE' };

    // Act - Execute
    const result = await service.create(actor, data);

    // Assert - Verify
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Test Category');
  });
});
```

## Running the Example

### 1. Study the Files

Read each file in order:

1. `schema.ts` - Understand data structure
2. `model.ts` - See database layer
3. `service.ts` - Review business logic
4. `route.ts` - Examine API layer
5. `test.ts` - Learn testing patterns

### 2. Try It Out

```bash
# Run tests
cd packages/service-core
pnpm test -- category

# Run with coverage
pnpm test:coverage -- category
```

### 3. Modify It

**Experiment:**

- Add a new field to the schema
- Create a custom service method
- Add a new validation rule
- Write a new test case

## Common Patterns Demonstrated

### 1. RO-RO Pattern

All functions receive/return single objects:

```typescript
// Input object
async create(actor: Actor, data: CategoryCreateInput) { }

// Output object
return { success: true, data: category };
```

### 2. Type Safety Chain

Types flow from schema to database:

```text
Zod Schema → TypeScript Type → Model → Service → Route → Frontend
```

### 3. Error Handling

Consistent error handling with `ServiceOutput`:

```typescript
if (!result.success) {
  return c.json({ error: result.error.message }, 400);
}
```

### 4. Permission Checks

Actor-based authorization:

```typescript
protected _canCreate(actor: Actor, data: CategoryCreateInput): void {
  if (!actor.permissions.includes('CATEGORY_CREATE')) {
    throw new ServiceError(
      ServiceErrorCode.FORBIDDEN,
      'Permission denied'
    );
  }
}
```

## Next Steps

After understanding this basic CRUD example:

1. **Advanced Service** - Learn complex business logic patterns
2. **Custom Validation** - Master Zod validators
3. **Testing Patterns** - Deep dive into TDD

## Key Takeaways

✅ **Schemas define structure** - All types inferred from Zod
✅ **Models handle data access** - Extend BaseModel for CRUD
✅ **Services contain business logic** - Validation, permissions, orchestration
✅ **Routes are thin** - Just parse input and return output
✅ **Tests drive development** - Write tests first (TDD)

## Common Mistakes

❌ **Don't define types separately** - Use `z.infer<typeof schema>`
❌ **Don't put business logic in routes** - Use services
❌ **Don't skip permission checks** - Always implement hooks
❌ **Don't skip tests** - Follow TDD methodology
❌ **Don't use `any`** - Use `unknown` with type guards

## Questions?

- See main [README.md](../README.md) for general guidance
- Check [CLAUDE.md](../../../CLAUDE.md) for project standards
- Review real examples in codebase (e.g., Tag, Feature entities)

---

**Difficulty**: 🟢 Beginner

**Estimated Time**: 30-45 minutes

**Prerequisites**: Basic TypeScript, async/await
