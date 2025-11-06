# Glossary

Comprehensive terminology reference for the Hospeda project. This glossary defines technical terms, architecture patterns, and business concepts specific to the Hospeda tourism platform.

**Note**: For Claude Code workflow terminology (agents, commands, PDR, etc.), see [.claude/docs/glossary.md](../../.claude/docs/glossary.md).

## Table of Contents

- [Core Concepts](#core-concepts)
- [Architecture Terms](#architecture-terms)
- [Database Terms](#database-terms)
- [Frontend Terms](#frontend-terms)
- [Testing Terms](#testing-terms)
- [DevOps Terms](#devops-terms)
- [Business Terms](#business-terms)

---

## Core Concepts

### Accommodation

A lodging property that can be booked by users. Includes hotels, apartments, cabins, and other short-term rental properties.

**Example**:

```typescript
const accommodation = await accommodationService.create({
  title: 'Beach House in Concepción',
  city: 'Concepción del Uruguay',
  pricePerNight: 150,
  maxGuests: 6,
});
```

**Related**: AccommodationListing, FeaturedAccommodation

### Actor

The authenticated user performing an action in the system. Used for permission checks and audit logging throughout the application.

**Example**:

```typescript
const ctx: ServiceContext = {
  actor: { id: 'user-123', role: 'admin' },
  logger,
};

const result = await accommodationService.create(ctx, data);
```

**Related**: ServiceContext, Permission, Role

### Amenity

A feature or facility offered by an accommodation (e.g., WiFi, pool, parking).

**Example**:

```typescript
const amenities = ['wifi', 'pool', 'parking', 'kitchen'];
```

**Related**: Accommodation, Feature

### CRUD Operations

Create, Read, Update, Delete - the four basic database operations that all entities support.

**Example**:

```typescript
// All services extend BaseCrudService with these methods
await service.create(ctx, data);    // Create
await service.getById(ctx, id);     // Read
await service.update(ctx, id, data); // Update
await service.delete(ctx, id);      // Delete
```

**Related**: BaseCrudService, BaseModel

### Destination

A tourist destination or city featured in the platform. Contains information about attractions, events, and local services.

**Example**:

```typescript
const destination = await destinationService.create({
  name: 'Concepción del Uruguay',
  province: 'Entre Ríos',
  description: 'Historic city on the Uruguay River...',
});
```

**Related**: Attraction, Event, TouristService

### Event

A scheduled activity or happening at a destination (concerts, festivals, exhibitions, etc.).

**Example**:

```typescript
const event = await eventService.create({
  title: 'Jazz Festival',
  startDate: '2024-12-01',
  endDate: '2024-12-03',
  location: 'Main Plaza',
});
```

**Related**: EventLocation, EventOrganizer, Destination

### Post

An article or blog post about tourism, destinations, or accommodations. Can be sponsored.

**Example**:

```typescript
const post = await postService.create({
  title: 'Top 10 Beaches in Entre Ríos',
  content: '...',
  tags: ['beaches', 'tourism'],
  status: 'published',
});
```

**Related**: PostSponsor, PostSponsorship, Tag

### Service Pattern

An architectural pattern where business logic is encapsulated in service classes that coordinate between models, validation, and external services.

**Example**:

```typescript
// Service handles validation, business logic, and model coordination
class AccommodationService extends BaseCrudService {
  async create(ctx: ServiceContext, data: CreateInput) {
    // Validate
    const validated = schema.parse(data);
    // Business logic
    const processed = await this.processData(validated);
    // Delegate to model
    return this.model.create(processed);
  }
}
```

**Related**: BaseCrudService, BaseModel, ServiceContext

---

## Architecture Terms

### Barrel File

An `index.ts` file that re-exports all exports from a directory, creating a single import point.

**Example**:

```typescript
// packages/db/src/models/index.ts
export * from './accommodation.model';
export * from './destination.model';
export * from './event.model';

// Usage elsewhere
import { AccommodationModel, DestinationModel } from '@repo/db/models';
```

**Pattern**: All directories in Hospeda should have barrel files for cleaner imports.

### BaseModel

A foundational class that all data models extend, providing standard database CRUD operations.

**Location**: `@repo/db/models/base.model.ts`

**Key Methods**:

- `findById(id)` - Retrieve single record
- `findAll(filters)` - List records with filtering
- `create(data)` - Insert new record
- `update(id, data)` - Update existing record
- `delete(id)` - Soft or hard delete record

**Example**:

```typescript
import { BaseModel } from '@repo/db/models/base.model';

class AccommodationModel extends BaseModel<Accommodation> {
  constructor() {
    super('accommodations'); // Table name
  }

  // Custom methods beyond base CRUD
  async findByCity(city: string) {
    return this.query().where('city', city);
  }
}
```

**Related**: BaseCrudService, CRUD Operations

### BaseCrudService

A foundational service class that all business logic services extend, providing standard CRUD operations with validation.

**Location**: `@repo/service-core/base-crud.service.ts`

**Features**:

- Zod schema validation
- Model integration
- Actor-based permissions
- Transaction support
- Standardized error handling

**Example**:

```typescript
import { BaseCrudService } from '@repo/service-core';

class AccommodationService extends BaseCrudService<
  Accommodation,        // Entity type
  AccommodationModel,   // Model type
  CreateSchema,         // Create validation schema
  UpdateSchema,         // Update validation schema
  SearchSchema          // Search validation schema
> {
  constructor(ctx: ServiceContext) {
    super(ctx, new AccommodationModel());
  }

  // Add custom business logic methods
  async getFeatured(limit: number) {
    // Custom logic here
  }
}
```

**Related**: BaseModel, ServiceOutput, ServiceContext

### Factory Pattern

A pattern for creating instances with shared configuration. Used extensively for API routes and services.

**Examples**:

```typescript
// Route factories
const accommodationRoute = createCRUDRoute({
  path: '/accommodations',
  service: AccommodationService,
  schemas: { create, update, search },
});

const listRoute = createListRoute({
  path: '/accommodations/list',
  service: AccommodationService,
});

// Service factories
const createService = (ctx: ServiceContext) => new AccommodationService(ctx);
```

**Related**: BaseCrudService, API Routes

### RO-RO Pattern

"Receive Object, Return Object" - A function design pattern where functions accept a single object parameter and return a single object result.

**Benefits**:

- Named parameters (self-documenting)
- Easy to extend without breaking existing code
- Type-safe with TypeScript
- Avoids parameter order mistakes

**Example**:

```typescript
// Good: RO-RO pattern
async function createUser(input: {
  name: string;
  email: string;
  role?: string;
}): Promise<{ user: User; token: string }> {
  const user = await userModel.create(input);
  const token = generateToken(user);
  return { user, token };
}

// Usage - clear what each value means
const { user, token } = await createUser({
  name: 'John',
  email: 'john@example.com',
  role: 'admin',
});

// Bad: Multiple params and tuple return
async function createUser(
  name: string,
  email: string,
  role?: string
): Promise<[User, string]> {
  // Implementation
  return [user, token]; // Which is user, which is token?
}
```

**Required**: All Hospeda functions must use RO-RO pattern.

### ServiceContext

The execution context passed to all service methods, containing the actor and logger.

**Structure**:

```typescript
type ServiceContext = {
  actor: { id: string; role: string };
  logger: Logger;
};
```

**Example**:

```typescript
const ctx: ServiceContext = {
  actor: { id: user.id, role: user.role },
  logger: createLogger('accommodation-service'),
};

const accommodation = await accommodationService.create(ctx, data);
```

**Related**: Actor, BaseCrudService

### ServiceOutput

A standardized result wrapper for all service operations, providing consistent success/error handling.

**Structure**:

```typescript
type ServiceOutput<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

**Example**:

```typescript
const result = await accommodationService.create(ctx, data);

if (result.success) {
  console.log('Created:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

**Related**: BaseCrudService, Error Handling

---

## Database Terms

### Drizzle ORM

TypeScript ORM used for database access. Provides type-safe queries, schema definitions, and migrations.

**Example**:

```typescript
import { db } from '@repo/db';
import { accommodations } from '@repo/db/schema';
import { eq } from 'drizzle-orm';

// Type-safe query
const results = await db
  .select()
  .from(accommodations)
  .where(eq(accommodations.city, 'Concepción'));
```

**Related**: Migration, Schema, Relations

**Documentation**: [Drizzle ORM Docs](https://orm.drizzle.team/)

### Hard Delete

Permanently removing a record from the database. Cannot be recovered.

**Example**:

```typescript
// Permanently deletes the record
await accommodationModel.hardDelete({ id: 'acc-123' });
```

**Related**: Soft Delete

**Use when**: Removing test data, complying with GDPR deletion requests

### Migration

A versioned database schema change. Migrations are applied sequentially to evolve the database structure.

**Example**:

```bash
# Create a new migration
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Rollback last migration
pnpm db:rollback
```

**Location**: `packages/db/migrations/`

**Related**: Schema, Drizzle ORM

### Relations

Connections between database tables (one-to-many, many-to-one, many-to-many).

**Example**:

```typescript
// Drizzle schema with relations
export const accommodations = pgTable('accommodations', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').references(() => users.id),
});

export const accommodationRelations = relations(accommodations, ({ one, many }) => ({
  owner: one(users, {
    fields: [accommodations.ownerId],
    references: [users.id],
  }),
  reviews: many(reviews),
}));
```

**Types**:

- **one()**: One-to-one or many-to-one
- **many()**: One-to-many

**Related**: Schema, Drizzle ORM

### Schema

Database table definitions using Drizzle ORM.

**Location**: `packages/db/src/schema/`

**Example**:

```typescript
import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const accommodations = pgTable('accommodations', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  maxGuests: integer('max_guests').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Related**: Migration, Relations, Drizzle ORM

### Soft Delete

Marking a record as deleted without removing it from the database. Uses a `deletedAt` timestamp.

**Example**:

```typescript
// Marks record as deleted
await accommodationModel.softDelete({ id: 'acc-123' });

// Record still exists but has deletedAt set
// Queries automatically exclude soft-deleted records
```

**Benefits**:

- Data recovery possible
- Maintains referential integrity
- Audit trail preserved

**Related**: Hard Delete

### Transactions

A sequence of database operations that execute atomically (all succeed or all fail).

**Example**:

```typescript
import { db } from '@repo/db';

await db.transaction(async (trx) => {
  // All operations use transaction
  const booking = await trx.insert(bookings).values(data);
  const payment = await trx.insert(payments).values(paymentData);

  // If payment fails, booking is rolled back automatically
});
```

**Related**: Drizzle ORM, ACID

---

## Frontend Terms

### Astro

Modern web framework used for the public-facing Hospeda website. Supports islands architecture and partial hydration.

**Features**:

- Server-side rendering (SSR)
- Static site generation (SSG)
- Islands architecture
- React integration

**Location**: `apps/web/`

**Example**:

```astro
---
// Astro component
import { AccommodationCard } from '@components/AccommodationCard';

const accommodations = await fetch('/api/accommodations').then(r => r.json());
---

<div class="grid">
  {accommodations.map(acc => (
    <AccommodationCard accommodation={acc} client:load />
  ))}
</div>
```

**Related**: Islands Architecture, SSR, React

### Clerk

Authentication provider used for user management, login, and session handling.

**Features**:

- User authentication
- Session management
- Social login (Google, GitHub, etc.)
- JWT tokens

**Example**:

```typescript
import { auth } from '@clerk/astro/server';

const { userId } = auth();

if (!userId) {
  return Response.redirect('/login');
}
```

**Related**: Authentication, JWT, Actor

### Islands Architecture

Astro pattern where pages are static HTML with small interactive "islands" of JavaScript/React components.

**Benefits**:

- Minimal JavaScript shipped
- Fast page loads
- Progressive enhancement
- SEO-friendly

**Example**:

```astro
---
import { SearchFilter } from '@components/SearchFilter';
import { AccommodationCard } from '@components/AccommodationCard';
---

<!-- Static HTML -->
<h1>Find Accommodations</h1>

<!-- Interactive island -->
<SearchFilter client:load />

<!-- Static cards with optional interactivity -->
{results.map(acc => (
  <AccommodationCard accommodation={acc} client:visible />
))}
```

**Related**: Astro, SSR, Hydration

### React Server Components

React components that render on the server, reducing client-side JavaScript.

**Used in**: TanStack Start (admin dashboard)

**Example**:

```tsx
// Server component (no 'use client')
async function AccommodationList() {
  const accommodations = await db.select().from(accommodationsTable);

  return (
    <div>
      {accommodations.map(acc => (
        <AccommodationCard key={acc.id} data={acc} />
      ))}
    </div>
  );
}
```

**Related**: TanStack Start, SSR

### SSG (Static Site Generation)

Pre-rendering pages at build time to static HTML files.

**Benefits**:

- Fastest possible page loads
- No server needed
- Perfect for SEO
- Ideal for content that doesn't change often

**Example**:

```astro
---
// This page is pre-rendered at build time
export const prerender = true;

const destinations = await getDestinations();
---

<h1>Destinations</h1>
{destinations.map(dest => (
  <DestinationCard destination={dest} />
))}
```

**Related**: SSR, Astro

### SSR (Server-Side Rendering)

Rendering pages on the server for each request, sending complete HTML to the browser.

**Benefits**:

- Dynamic content
- SEO-friendly
- Fast initial page load
- Works without JavaScript

**Example**:

```astro
---
// This page renders on each request
export const prerender = false;

const user = await getCurrentUser();
const bookings = await getBookings(user.id);
---

<h1>Your Bookings</h1>
{bookings.map(booking => (
  <BookingCard booking={booking} />
))}
```

**Related**: SSG, Islands Architecture

### TanStack Form

Type-safe form library used for complex forms with validation.

**Features**:

- Type-safe field access
- Zod integration
- Complex validation
- Field-level updates

**Example**:

```tsx
import { useForm } from '@tanstack/react-form';
import { zodValidator } from '@tanstack/zod-form-adapter';

function AccommodationForm() {
  const form = useForm({
    defaultValues: { title: '', city: '' },
    validatorAdapter: zodValidator,
    validators: {
      onChange: createAccommodationSchema,
    },
    onSubmit: async ({ value }) => {
      await createAccommodation(value);
    },
  });

  return <form>...</form>;
}
```

**Related**: TanStack Query, Zod

### TanStack Query

Data fetching and caching library used for API calls in React.

**Features**:

- Automatic caching
- Background refetching
- Optimistic updates
- Loading/error states

**Example**:

```tsx
import { useQuery } from '@tanstack/react-query';

function AccommodationList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['accommodations'],
    queryFn: () => fetch('/api/accommodations').then(r => r.json()),
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return <div>{data.map(acc => <Card key={acc.id} data={acc} />)}</div>;
}
```

**Related**: TanStack Form, React

### TanStack Start

Full-stack React framework used for the Hospeda admin dashboard.

**Features**:

- File-based routing
- Server functions
- Type-safe API routes
- React Server Components

**Location**: `apps/admin/`

**Example**:

```tsx
// app/routes/accommodations.tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/accommodations')({
  loader: async () => {
    return getAccommodations();
  },
  component: AccommodationList,
});
```

**Related**: React Server Components, TanStack Query

---

## Testing Terms

### AAA Pattern

"Arrange, Act, Assert" - A structured approach to writing tests.

**Example**:

```typescript
it('should create accommodation successfully', async () => {
  // Arrange - Set up test data
  const ctx = createTestContext();
  const data = { title: 'Beach House', city: 'Concepción' };

  // Act - Perform the action
  const result = await service.create(ctx, data);

  // Assert - Verify the outcome
  expect(result.success).toBe(true);
  expect(result.data.title).toBe('Beach House');
});
```

**Related**: TDD, Vitest

### Coverage

Percentage of code executed by tests. Hospeda requires minimum 90% coverage.

**Check coverage**:

```bash
pnpm test:coverage
```

**Example output**:

```
File                  | Stmts | Branch | Funcs | Lines
----------------------|-------|--------|-------|-------
accommodation.service |  95%  |  88%   |  100% |  94%
accommodation.model   |  92%  |  90%   |  100% |  91%
```

**Related**: TDD, Vitest

### E2E Testing

End-to-end testing that simulates real user workflows through the entire application.

**Tool**: Playwright

**Example**:

```typescript
import { test, expect } from '@playwright/test';

test('user can create accommodation', async ({ page }) => {
  await page.goto('/admin/accommodations/new');
  await page.fill('[name="title"]', 'Beach House');
  await page.fill('[name="city"]', 'Concepción');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/admin/accommodations');
  await expect(page.locator('text=Beach House')).toBeVisible();
});
```

**Related**: Integration Testing, Unit Testing

### Integration Testing

Testing how multiple components work together.

**Example**:

```typescript
describe('AccommodationService integration', () => {
  it('should create accommodation with relations', async () => {
    // Tests service + model + database together
    const service = new AccommodationService(ctx);

    const result = await service.create(ctx, {
      title: 'Beach House',
      amenities: ['wifi', 'pool'],
      ownerId: 'user-123',
    });

    // Verify related data was created
    const withAmenities = await service.getById(ctx, result.data.id);
    expect(withAmenities.data.amenities).toHaveLength(2);
  });
});
```

**Related**: Unit Testing, E2E Testing

### Red-Green-Refactor

The TDD cycle: write failing test (red), make it pass (green), improve code (refactor).

**Example workflow**:

```typescript
// RED: Write failing test
it('should calculate total price', () => {
  const total = calculateTotal(100, 3); // Function doesn't exist yet
  expect(total).toBe(300);
});

// GREEN: Make it pass
function calculateTotal(price: number, nights: number): number {
  return price * nights; // Simplest implementation
}

// REFACTOR: Improve while keeping tests green
function calculateTotal(input: {
  pricePerNight: number;
  nights: number;
}): number {
  return input.pricePerNight * input.nights; // Now uses RO-RO
}
```

**Related**: TDD, AAA Pattern

### TDD (Test-Driven Development)

Development methodology where tests are written before implementation code.

**Process**:

1. Write test
2. Run test (should fail)
3. Write minimal code to pass
4. Run test (should pass)
5. Refactor
6. Repeat

**Required**: All Hospeda code must use TDD.

**Related**: Red-Green-Refactor, Coverage

### Test Pyramid

Testing strategy with many unit tests, fewer integration tests, and few E2E tests.

**Structure**:

```
    /\
   /E2E\      Few - Slow, expensive, brittle
  /------\
 /  Int.  \   Some - Medium speed, moderate cost
/-----------\
/   Unit     \ Many - Fast, cheap, stable
```

**Example distribution**:

- Unit tests: ~70%
- Integration tests: ~20%
- E2E tests: ~10%

**Related**: Unit Testing, Integration Testing, E2E Testing

### Unit Testing

Testing individual functions or methods in isolation.

**Example**:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateBookingPrice } from './pricing';

describe('calculateBookingPrice', () => {
  it('should calculate base price correctly', () => {
    const result = calculateBookingPrice({
      pricePerNight: 100,
      nights: 3,
    });

    expect(result.basePrice).toBe(300);
  });

  it('should apply weekend surcharge', () => {
    const result = calculateBookingPrice({
      pricePerNight: 100,
      nights: 3,
      includesWeekend: true,
    });

    expect(result.basePrice).toBe(300);
    expect(result.weekendSurcharge).toBe(50);
    expect(result.total).toBe(350);
  });
});
```

**Related**: Integration Testing, TDD, Vitest

### Vitest

Fast unit testing framework for Vite/TypeScript projects.

**Features**:

- Fast execution
- TypeScript support
- Jest-compatible API
- Coverage reporting

**Example**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('AccommodationService', () => {
  let service: AccommodationService;

  beforeEach(() => {
    service = new AccommodationService(createTestContext());
  });

  it('should create accommodation', async () => {
    const result = await service.create(ctx, testData);
    expect(result.success).toBe(true);
  });
});
```

**Commands**:

```bash
pnpm test              # Run tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # With coverage
```

**Related**: TDD, Coverage

---

## DevOps Terms

### CI/CD

Continuous Integration / Continuous Deployment - automated testing and deployment pipeline.

**Hospeda CI/CD**:

- Push to main → Tests run → Deploy to Vercel
- Pull request → Tests run → Preview deployment

**Example** (GitHub Actions):

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
      - run: pnpm typecheck
      - run: pnpm lint
```

**Related**: GitHub Actions, Vercel

### Monorepo

A single repository containing multiple packages and applications.

**Hospeda structure**:

```
hospeda/
├── apps/           # Applications
│   ├── api/        # Hono backend
│   ├── web/        # Astro frontend
│   └── admin/      # TanStack admin
└── packages/       # Shared packages
    ├── db/         # Database
    ├── schemas/    # Validation
    └── service-core/ # Business logic
```

**Benefits**:

- Shared code reuse
- Atomic changes across packages
- Single version control
- Easier refactoring

**Related**: TurboRepo, PNPM Workspaces

### Neon

Serverless PostgreSQL database provider used for Hospeda.

**Features**:

- Auto-scaling
- Branch databases
- Connection pooling
- Generous free tier

**Usage**:

```bash
# Connect to Neon database
DATABASE_URL=postgresql://user:pass@host.neon.tech/db
```

**Related**: PostgreSQL, Drizzle ORM

**Documentation**: [Neon Docs](https://neon.tech/docs)

### PNPM

Fast, disk-efficient package manager used by Hospeda.

**Features**:

- Efficient disk usage (shared dependencies)
- Strict node_modules
- Monorepo support via workspaces

**Common commands**:

```bash
pnpm install              # Install dependencies
pnpm add <package>        # Add package
pnpm dev                  # Start dev server
pnpm build                # Build for production
pnpm test                 # Run tests
```

**Related**: Monorepo, TurboRepo, PNPM Workspaces

### PNPM Workspaces

PNPM feature for managing multiple packages in a monorepo.

**Configuration** (`pnpm-workspace.yaml`):

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Benefits**:

- Shared dependencies
- Cross-package references
- Single lock file
- Efficient hoisting

**Example**:

```json
{
  "name": "@repo/api",
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/schemas": "workspace:*"
  }
}
```

**Related**: Monorepo, PNPM, TurboRepo

### TurboRepo

Build system for managing monorepo tasks with caching and parallelization.

**Configuration** (`turbo.json`):

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

**Commands**:

```bash
pnpm dev              # Run all apps in dev mode
pnpm build            # Build all apps
pnpm test             # Test all packages
```

**Benefits**:

- Intelligent caching
- Parallel execution
- Task dependencies
- Remote caching

**Related**: Monorepo, PNPM Workspaces

### Vercel

Hosting platform used for deploying Hospeda applications.

**Features**:

- Automatic deployments from Git
- Preview deployments for PRs
- Edge functions
- Analytics

**Deployed apps**:

- Web app (Astro)
- Admin dashboard (TanStack Start)
- API (Hono)

**Configuration** (`vercel.json`):

```json
{
  "builds": [
    {
      "src": "apps/web/package.json",
      "use": "@vercel/astro"
    }
  ]
}
```

**Related**: CI/CD, Deployment

---

## Business Terms

### Booking

A reservation made by a user for an accommodation.

**States**: pending, confirmed, cancelled, completed

**Example**:

```typescript
const booking = await bookingService.create({
  accommodationId: 'acc-123',
  userId: 'user-456',
  checkIn: '2024-12-01',
  checkOut: '2024-12-05',
  guests: 4,
  totalPrice: 600,
});
```

### Discount Code

A promotional code that provides a discount on bookings or subscriptions.

**Types**: percentage, fixed amount

**Example**:

```typescript
const discountCode = await discountCodeService.create({
  code: 'SUMMER2024',
  type: 'percentage',
  value: 20, // 20% off
  validFrom: '2024-06-01',
  validUntil: '2024-08-31',
});
```

### Featured Accommodation

An accommodation that is promoted on the homepage or in search results, typically through a paid promotion.

**Example**:

```typescript
const featured = await featuredAccommodationService.create({
  accommodationId: 'acc-123',
  position: 1,
  startDate: '2024-12-01',
  endDate: '2024-12-31',
});
```

### Listing Plan

A subscription plan that determines the features and visibility of an accommodation listing.

**Tiers**: basic, premium, professional

**Example**:

```typescript
const plan = await listingPlanService.create({
  name: 'Premium',
  price: 29.99,
  features: ['featured', 'unlimited_photos', 'analytics'],
  maxListings: 5,
});
```

### Pricing Tier

A pricing level within a subscription plan, often based on usage or features.

**Example**:

```typescript
const tier = await pricingTierService.create({
  planId: 'plan-123',
  name: 'Starter',
  monthlyPrice: 9.99,
  yearlyPrice: 99,
  features: ['basic_listing', '10_photos'],
});
```

### Professional Service

A service offered by professionals (photographers, cleaners, designers) to accommodation owners.

**Types**: photography, cleaning, interior_design

**Example**:

```typescript
const service = await professionalServiceService.create({
  type: 'photography',
  providerId: 'user-123',
  title: 'Professional Property Photography',
  price: 150,
  duration: 120, // minutes
});
```

### Review

User feedback and rating for an accommodation or destination.

**Rating**: 1-5 stars

**Example**:

```typescript
const review = await reviewService.create({
  accommodationId: 'acc-123',
  userId: 'user-456',
  rating: 5,
  comment: 'Amazing place, highly recommend!',
  photos: ['photo1.jpg', 'photo2.jpg'],
});
```

### Subscription

A recurring payment plan for a service (accommodation listing, premium features, etc.).

**States**: active, cancelled, expired, past_due

**Example**:

```typescript
const subscription = await subscriptionService.create({
  userId: 'user-123',
  planId: 'plan-premium',
  billingPeriod: 'monthly',
  startDate: '2024-12-01',
  status: 'active',
});
```

### Tourist Service

A service offered to tourists (tours, transportation, guides) at a destination.

**Example**:

```typescript
const service = await touristServiceService.create({
  destinationId: 'dest-123',
  title: 'City Walking Tour',
  description: 'Explore historic downtown...',
  price: 25,
  duration: 180, // minutes
});
```

---

## Related Resources

- [FAQ](./faq.md) - Common questions about these terms
- [Troubleshooting](./troubleshooting.md) - Fixing issues with these concepts
- [External Links](./external-links.md) - Official documentation
- [Claude Code Glossary](../../.claude/docs/glossary.md) - Workflow terminology

---

*Last updated: 2025-11-06*
