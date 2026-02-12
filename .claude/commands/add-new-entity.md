---
name: add-new-entity
description: Interactive wizard for creating a new domain entity or feature, scaffolding model, service, routes, and tests following project conventions
---

# Add New Entity Command

## Purpose

Interactive wizard for creating a new domain entity or feature. Scaffolds all
required layers (model, service, routes, tests) following the project's
established conventions and patterns. Ensures consistency across the codebase
when adding new functionality.

## Usage

```bash
/add-new-entity {entity_name}
```

### Examples

```bash
/add-new-entity user
/add-new-entity product
/add-new-entity booking
/add-new-entity comment
```

## Description

Guides you through the creation of a complete domain entity by:

1. Gathering entity requirements interactively
2. Analyzing existing project patterns and conventions
3. Scaffolding all required files across all layers
4. Creating tests for each layer
5. Updating relevant index/barrel files and registrations

---

## Execution Flow

### Step 1: Pattern Analysis

**Process:**

Before generating any files, analyze the existing project to understand
conventions:

- Scan existing entities/models for naming patterns
- Identify project structure (monorepo, single app, etc.)
- Detect ORM or database layer (Drizzle, Prisma, TypeORM, Mongoose, etc.)
- Detect API framework (Express, Hono, Fastify, NestJS, etc.)
- Detect frontend framework (React, Vue, Svelte, etc.)
- Identify test framework (Vitest, Jest, etc.)
- Detect validation library (Zod, Joi, Yup, etc.)
- Map the layered architecture (schema -> model -> service -> route -> component)

**Output:**

```text
Project Pattern Analysis

Structure: Monorepo with packages
Database: PostgreSQL with Drizzle ORM
API Framework: Hono
Frontend: React with Astro
Test Runner: Vitest
Validation: Zod
Architecture: Schema -> Model -> Service -> Route -> Component

Existing entities detected:
  - User (full stack)
  - Product (full stack)
  - Category (backend only)
```

---

### Step 2: Entity Requirements Gathering (Interactive)

**Process:**

Ask the user a series of questions to define the entity:

1. **Entity Name**: Confirm the entity name and derive singular/plural forms
2. **Fields/Properties**: What fields does the entity have?
3. **Relationships**: Does it relate to other entities? (belongs-to, has-many, etc.)
4. **Validation Rules**: What validation rules apply to each field?
5. **API Endpoints**: Which CRUD operations are needed?
6. **Authentication**: Which endpoints require authentication?
7. **Frontend**: Does it need frontend components? (list, detail, form views)
8. **Special Behavior**: Any custom business logic?

**Example Interaction:**

```text
Creating new entity: "Booking"

1. Entity Name
   Singular: Booking
   Plural: Bookings
   Table name: bookings
   Route prefix: /api/bookings

2. Fields (define each field):
   - id: string (auto-generated UUID)
   - userId: string (foreign key -> users)
   - productId: string (foreign key -> products)
   - startDate: date (required)
   - endDate: date (required)
   - status: enum [pending, confirmed, cancelled] (default: pending)
   - totalPrice: number (required)
   - notes: string (optional)
   - createdAt: date (auto)
   - updatedAt: date (auto)

3. Relationships:
   - belongs-to: User (via userId)
   - belongs-to: Product (via productId)

4. API Endpoints:
   - POST /api/bookings (create) - authenticated
   - GET /api/bookings (list own) - authenticated
   - GET /api/bookings/:id (detail) - authenticated
   - PATCH /api/bookings/:id (update) - authenticated, owner only
   - DELETE /api/bookings/:id (cancel) - authenticated, owner only
   - GET /api/admin/bookings (list all) - admin only

5. Frontend Views:
   - BookingList component
   - BookingDetail component
   - BookingForm component (create/edit)
   - BookingCard component (summary)

Proceed with generation? (yes/no)
```

---

### Step 3: File Generation

**Process:**

Generate all files following the patterns detected in Step 1. The exact files
depend on the project structure, but typically include:

#### Database Layer

- **Schema/Migration**: Database table definition
- **Model**: Data access layer with CRUD operations
- **Seed Data**: Optional sample data for development

#### Validation Layer

- **Schemas**: Input validation schemas (create, update, search/filter)
- **Types**: TypeScript type definitions

#### Service Layer

- **Service**: Business logic with CRUD operations
- **Service Tests**: Unit tests for the service

#### API Layer

- **Routes/Controller**: API endpoint definitions
- **Route Tests**: Integration tests for endpoints
- **Middleware**: Any entity-specific middleware

#### Frontend Layer (if applicable)

- **List Component**: Display collection of entities
- **Detail Component**: Display single entity
- **Form Component**: Create/edit entity
- **Card Component**: Summary display
- **Hooks**: Custom data fetching hooks

#### Infrastructure

- **Index/Barrel Files**: Update exports
- **Router Registration**: Register new routes
- **Type Exports**: Export new types

---

### Step 4: File Structure Preview

**Output Example:**

```text
Files to be created:

Database Layer:
  src/db/schemas/booking.schema.ts
  src/db/models/booking.model.ts
  src/db/seed/booking.seed.ts

Validation Layer:
  src/schemas/booking/create-booking.schema.ts
  src/schemas/booking/update-booking.schema.ts
  src/schemas/booking/search-booking.schema.ts
  src/schemas/booking/index.ts

Service Layer:
  src/services/booking/booking.service.ts
  src/services/booking/booking.service.test.ts
  src/services/booking/index.ts

API Layer:
  src/routes/bookings/index.ts
  src/routes/bookings/bookings.test.ts

Frontend Layer:
  src/components/booking/BookingList.tsx
  src/components/booking/BookingDetail.tsx
  src/components/booking/BookingForm.tsx
  src/components/booking/BookingCard.tsx
  src/hooks/useBookings.ts

Files to be updated:
  src/db/schemas/index.ts (add export)
  src/db/models/index.ts (add export)
  src/services/index.ts (add export)
  src/routes/index.ts (register routes)

Total: 16 new files, 4 updated files

Proceed with file creation? (yes/no)
```

---

### Step 5: Generation and Validation

**Process:**

1. Generate each file following detected patterns
2. Ensure all imports are correct
3. Update barrel/index files
4. Register routes in the router
5. Run `/code-check` to verify no type errors
6. Run tests to verify generated tests pass

**Output:**

```text
Entity Generation Complete: Booking

Files Created: 16
Files Updated: 4

Validation:
  Type Check: PASSED
  Lint: PASSED
  Tests: 12/12 passed

The Booking entity is ready for customization.

Next Steps:
1. Review generated files for correctness
2. Customize business logic in booking.service.ts
3. Add additional validation rules if needed
4. Run /quality-check for full validation
```

---

## Generated Code Patterns

### The command follows these principles when generating code

1. **Convention Over Configuration**: Follow existing project patterns exactly
2. **Type Safety**: Full TypeScript types for all layers
3. **Validation**: Input validation on all mutations
4. **Testing**: Tests generated for every layer
5. **Error Handling**: Consistent error handling patterns
6. **Authentication**: Auth middleware where specified
7. **Documentation**: JSDoc comments on public APIs

### Example Generated Service

```typescript
// Following project conventions detected during analysis
export class BookingService {
  constructor(private readonly model: BookingModel) {}

  async create(data: CreateBookingInput): Promise<Booking> {
    // Validate business rules
    await this.validateAvailability(data);

    // Create entity
    return this.model.create(data);
  }

  async findById(id: string): Promise<Booking | null> {
    return this.model.findById(id);
  }

  async findAll(filters: SearchBookingInput): Promise<PaginatedResult<Booking>> {
    return this.model.findAll(filters);
  }

  async update(id: string, data: UpdateBookingInput): Promise<Booking> {
    return this.model.update(id, data);
  }

  async delete(id: string): Promise<void> {
    return this.model.delete(id);
  }
}
```

### Example Generated Test

```typescript
describe('BookingService', () => {
  let service: BookingService;
  let model: MockBookingModel;

  beforeEach(() => {
    model = createMockBookingModel();
    service = new BookingService(model);
  });

  describe('create', () => {
    it('should create a booking with valid data', async () => {
      const input = createValidBookingInput();
      const result = await service.create(input);

      expect(result).toBeDefined();
      expect(result.status).toBe('pending');
      expect(model.create).toHaveBeenCalledWith(input);
    });

    it('should throw on invalid data', async () => {
      const input = createInvalidBookingInput();

      await expect(service.create(input)).rejects.toThrow();
    });
  });

  // Additional test cases...
});
```

---

## Customization

### Skipping Layers

If you only need certain layers, specify during the interactive wizard:

```text
Which layers do you need?
  [x] Database (schema, model)
  [x] Validation (schemas)
  [x] Service (business logic)
  [x] API (routes/controller)
  [ ] Frontend (components, hooks)   <-- Skip
  [x] Tests
```

### Custom Templates

If the project has custom templates or generators, the command will detect and
use those instead of generating from scratch.

---

## Related Commands

- `/quality-check` - Run after entity creation to validate
- `/code-check` - Quick validation of generated code
- `/run-tests` - Verify generated tests pass
- `/update-docs` - Update documentation for new entity
- `/commit` - Commit the new entity files

---

## When to Use

- **New Feature**: When adding a new domain concept to the application
- **New Resource**: When adding a new API resource
- **New Module**: When creating a new module in the system
- **Consistency**: When you want to ensure new code follows project patterns

---

## Prerequisites

- Project structure analyzed (first run)
- Dependencies installed
- Database accessible (for schema generation)
- Understanding of entity requirements

---

## Post-Command Actions

1. **Review Generated Files**: Verify all generated code is correct
2. **Customize Business Logic**: Add entity-specific business rules
3. **Add Custom Validation**: Enhance validation as needed
4. **Run Quality Check**: Execute `/quality-check` for full validation
5. **Update Documentation**: Run `/update-docs` if needed
6. **Commit Changes**: Run `/commit` to create proper commits

---

## Best Practices

1. **Follow Existing Patterns**: The wizard analyzes existing code; do not
   deviate from established patterns
2. **Start Simple**: Begin with basic CRUD, add complexity incrementally
3. **Test First**: Review and enhance generated tests before moving forward
4. **One Entity at a Time**: Create one entity per command invocation
5. **Review Before Committing**: Always review generated code before committing
