# Frequently Asked Questions (FAQ)

Quick answers to common questions for developers working on the Hospeda project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Database](#database)
- [Debugging](#debugging)
- [Deployment](#deployment)
- [Common Errors](#common-errors)

---

## Getting Started

### How do I set up the project locally?

Clone the repository, install dependencies with `pnpm install`, set up your `.env.local` file with required environment variables (DATABASE_URL, CLERK keys), run `pnpm db:migrate` to set up the database, and finally `pnpm dev` to start development servers.

See [Setup Guide](../getting-started/setup.md) for detailed instructions.

### What are the prerequisites?

You need Node.js 20.10.0 or higher, PNPM 8.15.6 or higher, and PostgreSQL 15 or higher (or Docker for local database). Optional: VS Code with recommended extensions for best developer experience.

### How do I run the database migrations?

Use `pnpm db:migrate` from the project root. This applies all pending migrations to your database. Migrations are located in `packages/db/migrations/`.

### How do I seed the database with sample data?

Run `pnpm db:seed` from the project root. This populates the database with test data for development. To reset everything: `pnpm db:fresh` (drops, recreates, migrates, and seeds).

### Which development server runs on which port?

Web app (Astro) runs on `http://localhost:4321`, admin dashboard (TanStack Start) on `http://localhost:4322`, and API (Hono) on `http://localhost:3000`. All start together with `pnpm dev`.

### How do I access the database UI?

Run `pnpm db:studio` to open Drizzle Studio at `http://localhost:4983`. This provides a visual interface to browse and edit database records.

### Where do I put environment variables?

Create a `.env.local` file in the project root. Copy `.env.example` as a template. Never commit `.env.local` to git - it's in `.gitignore` for security.

### How do I get Clerk authentication keys?

Sign up at [clerk.com](https://clerk.com), create an application, and copy the publishable and secret keys to your `.env.local` as `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

---

## Development

### How do I create a new entity?

Follow the entity creation order: 1) Create Zod schemas in `@repo/schemas`, 2) Infer types from schemas using `z.infer<typeof schema>`, 3) Create Drizzle schema in `@repo/db/schema`, 4) Create model extending `BaseModel` in `@repo/db/models`, 5) Create service extending `BaseCrudService` in `@repo/service-core`, 6) Create API routes using factories in `apps/api/routes`.

See the `/add-new-entity` command for guided creation.

### How do I add a new API endpoint?

Create a route file in `apps/api/src/routes/`, use route factories (`createCRUDRoute`, `createListRoute`) to generate standard endpoints, or write custom routes with Hono. All routes must validate input with Zod schemas and use services for business logic.

**Example**:

```typescript
import { createCRUDRoute } from '@repo/api/factories';
import { AccommodationService } from '@repo/service-core';
import { createSchema, updateSchema } from '@repo/schemas';

export const accommodationRoute = createCRUDRoute({
  path: '/accommodations',
  service: AccommodationService,
  schemas: { create: createSchema, update: updateSchema },
});
```

### How do I create a new page in the web app?

Create a `.astro` file in `apps/web/src/pages/`. Astro uses file-based routing: `pages/about.astro` becomes `/about`. Use components from `apps/web/src/components/` and fetch data with API calls or directly from the database.

**Example**:

```astro
---
// src/pages/accommodations/[id].astro
import Layout from '@layouts/Layout.astro';
import { AccommodationCard } from '@components/AccommodationCard';

const { id } = Astro.params;
const accommodation = await fetch(`/api/accommodations/${id}`).then(r => r.json());
---

<Layout title={accommodation.title}>
  <AccommodationCard data={accommodation} />
</Layout>
```

### How do I create a new page in the admin dashboard?

Create a route file in `apps/admin/src/routes/` using TanStack Router. File-based routing: `routes/accommodations.tsx` becomes `/accommodations`. Use the `loader` function to fetch data server-side.

**Example**:

```tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/accommodations')({
  loader: async () => {
    return getAccommodations();
  },
  component: AccommodationList,
});
```

### Where do I put validation schemas?

All validation schemas go in `packages/schemas/src/` organized by entity. Use Zod for schema definition. Types are automatically inferred - don't create separate `.types.ts` files.

**Example**:

```typescript
// packages/schemas/src/accommodation.schema.ts
import { z } from 'zod';

export const createAccommodationSchema = z.object({
  title: z.string().min(5).max(255),
  city: z.string().min(2).max(100),
  pricePerNight: z.number().positive(),
  maxGuests: z.number().int().positive().max(20),
});

// Type is inferred from schema
export type CreateAccommodationInput = z.infer<typeof createAccommodationSchema>;
```

### How do types work in this project?

Types are inferred from Zod schemas using `z.infer<typeof schema>`. Never create separate type files - the schema is the single source of truth. This ensures validation and types always match.

### How do I add a new React component?

For web app: create in `apps/web/src/components/` with `.tsx` extension. For admin: create in `apps/admin/src/components/`. Use TypeScript, follow RO-RO pattern for props, and use Tailwind CSS for styling.

**Example**:

```tsx
type AccommodationCardProps = {
  data: Accommodation;
  variant?: 'default' | 'compact';
};

export function AccommodationCard({ data, variant = 'default' }: AccommodationCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3>{data.title}</h3>
      <p>{data.city}</p>
    </div>
  );
}
```

### How do I use Shadcn UI components?

Run `pnpm dlx shadcn-ui@latest add <component>` to add components. They're installed in `apps/*/src/components/ui/`. Customize in `components.json`. All components use Tailwind CSS and are fully customizable.

### Where do shared utilities go?

Create in `packages/utils/src/` and export from `index.ts`. Utilities should be pure functions, fully typed, and have unit tests. Examples: date formatting, string manipulation, validation helpers.

### How do I add a new database field?

Update the Drizzle schema in `packages/db/src/schema/`, run `pnpm db:generate` to create a migration, review the migration file, update the Zod schema in `@repo/schemas`, and run `pnpm db:migrate` to apply.

---

## Testing

### How do I run tests?

Run `pnpm test` from the project root to test all packages, or `cd packages/db && pnpm run test` to test a specific package. Use `pnpm test:watch` for watch mode and `pnpm test:coverage` to see coverage reports.

### What's the minimum coverage required?

90% coverage minimum for all code. This is enforced in CI/CD. No exceptions. Tests should cover statements, branches, functions, and lines.

### How do I test services?

Create test files in `test/services/` mirroring the structure of `src/services/`. Use Vitest, follow AAA pattern (Arrange-Act-Assert), mock dependencies, create test context with `createTestContext()`, and test both success and error cases.

**Example**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { AccommodationService } from '../src/services/accommodation';
import { createTestContext } from './helpers';

describe('AccommodationService', () => {
  let service: AccommodationService;
  let ctx: ServiceContext;

  beforeEach(() => {
    ctx = createTestContext();
    service = new AccommodationService(ctx);
  });

  it('should create accommodation successfully', async () => {
    // Arrange
    const data = { title: 'Beach House', city: 'Concepción' };

    // Act
    const result = await service.create(ctx, data);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data.title).toBe('Beach House');
  });
});
```

### How do I test API routes?

Use Hono's testing utilities to create request objects and test route handlers. Test validation, authentication, authorization, success cases, and error cases.

**Example**:

```typescript
import { describe, it, expect } from 'vitest';
import { app } from '../src/app';

describe('GET /accommodations', () => {
  it('should return accommodations list', async () => {
    const res = await app.request('/accommodations');

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });
});
```

### How do I test React components?

Use Vitest with React Testing Library. Test user interactions, component rendering, props handling, and edge cases. Avoid testing implementation details.

**Example**:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  it('should display accommodation title', () => {
    const data = { id: '1', title: 'Beach House', city: 'Concepción' };

    render(<AccommodationCard data={data} />);

    expect(screen.getByText('Beach House')).toBeInTheDocument();
  });
});
```

### How do I write tests following TDD?

Write the test first (it should fail - RED), implement the minimum code to make it pass (GREEN), refactor while keeping tests passing (REFACTOR), and repeat. Never write production code without a failing test first.

### Where do test files go?

Tests go in `test/` folder at the package/app root, mirroring the `src/` structure. Example: `src/models/user.model.ts` → `test/models/user.model.test.ts`.

### How do I mock dependencies in tests?

Use Vitest's `vi.mock()` for module mocks or create mock implementations manually. For database, use an in-memory database or mock the model layer.

**Example**:

```typescript
import { vi } from 'vitest';

vi.mock('@repo/db/models', () => ({
  AccommodationModel: vi.fn(() => ({
    findById: vi.fn().mockResolvedValue({ id: '1', title: 'Test' }),
  })),
}));
```

---

## Database

### How do I create a migration?

After updating a Drizzle schema, run `pnpm db:generate` to create a migration file. Review the generated SQL in `packages/db/migrations/`, ensure it's correct, then run `pnpm db:migrate` to apply it.

### How do I rollback a migration?

Drizzle doesn't have automatic rollback. To undo, create a new migration that reverses the changes, or manually edit the database and remove the migration entry from `drizzle.__migrations` table. For development, use `pnpm db:fresh` to reset completely.

### Can I use raw SQL queries?

Yes, use `db.execute(sql`...`)` for raw SQL. However, prefer Drizzle's query builder for type safety. Raw SQL should be used only for complex queries that Drizzle can't express easily.

**Example**:

```typescript
import { db } from '@repo/db';
import { sql } from 'drizzle-orm';

const results = await db.execute(
  sql`SELECT * FROM accommodations WHERE city = ${city} AND price < ${maxPrice}`
);
```

### How do I query with relations?

Use Drizzle's relational queries with the `with` option to include related data in a single query.

**Example**:

```typescript
import { db } from '@repo/db';
import { accommodations } from '@repo/db/schema';

const result = await db.query.accommodations.findMany({
  with: {
    owner: true,          // Include owner relation
    reviews: {            // Include reviews with filtering
      where: (reviews, { eq }) => eq(reviews.rating, 5),
    },
  },
});
```

### What's the difference between soft and hard delete?

Soft delete sets `deletedAt` timestamp but keeps the record in the database (can be recovered, maintains references). Hard delete permanently removes the record from the database (cannot be recovered). Use soft delete by default for user data.

### How do I handle transactions?

Use `db.transaction()` to wrap multiple operations that must succeed or fail together.

**Example**:

```typescript
import { db } from '@repo/db';

await db.transaction(async (trx) => {
  // All operations use trx instead of db
  const booking = await trx.insert(bookings).values(bookingData);
  const payment = await trx.insert(payments).values(paymentData);

  // If payment fails, booking is automatically rolled back
});
```

### How do I add indexes to tables?

Add indexes in the Drizzle schema using `.index()` method, then generate and run a migration.

**Example**:

```typescript
export const accommodations = pgTable('accommodations', {
  id: uuid('id').primaryKey(),
  city: varchar('city', { length: 100 }),
  pricePerNight: decimal('price_per_night'),
}, (table) => ({
  cityIdx: index('city_idx').on(table.city),
  priceIdx: index('price_idx').on(table.pricePerNight),
}));
```

### How do I query with pagination?

Use `.limit()` and `.offset()` with Drizzle queries.

**Example**:

```typescript
const page = 1;
const pageSize = 20;

const results = await db
  .select()
  .from(accommodations)
  .limit(pageSize)
  .offset((page - 1) * pageSize);
```

---

## Debugging

### My API endpoint returns 404, what do I check?

Verify the route is registered in `apps/api/src/app.ts`, check the path matches exactly (including leading `/`), ensure the HTTP method is correct (GET, POST, etc.), restart the API server (`pnpm dev`), and check for typos in the URL.

### TypeScript is complaining about types, how do I fix it?

Run `pnpm typecheck` to see all errors, ensure schemas are exported and imported correctly, verify types are inferred from Zod schemas with `z.infer<typeof schema>`, check that all dependencies are built (`pnpm build`), and restart TypeScript server in VS Code (Cmd/Ctrl + Shift + P → "Restart TS Server").

### Tests are failing, where do I start?

Read the error message carefully, run the failing test in isolation (`pnpm test -- <filename>`), check if test data matches expected schema, verify mocks are set up correctly, ensure database is migrated (`pnpm db:migrate`), and use `console.log()` or debugger to inspect values.

### How do I debug database queries?

Enable Drizzle query logging by setting `DEBUG=drizzle:*` environment variable, use Drizzle Studio (`pnpm db:studio`) to inspect data, check the generated SQL with `.toSQL()` method, and verify foreign key constraints are satisfied.

**Example**:

```typescript
const query = db.select().from(accommodations);
console.log(query.toSQL()); // See generated SQL
```

### How do I debug React components?

Use React DevTools browser extension, add `console.log()` in component or hooks, use `debugger` statement and browser DevTools, check browser console for errors, and verify props are passed correctly with TypeScript.

### How do I debug API requests?

Use browser DevTools Network tab to inspect requests/responses, check request headers and body format, verify authentication token is sent, use `console.log()` in API route handlers, and use Postman or curl for isolated testing.

**Example curl**:

```bash
curl -X POST http://localhost:3000/accommodations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Test","city":"Concepción"}'
```

### Why is hot reload not working?

Restart the development server, check for syntax errors in the file, ensure the file is in a watched directory, clear `.next` or `.astro` cache directories, and check for issues in console output.

### Why am I getting CORS errors?

Ensure the API includes CORS middleware for the web app origin, check that credentials are included in fetch requests (`credentials: 'include'`), verify the request origin matches configured allowed origins, and use same domain for development if possible.

---

## Deployment

### How do deployments work?

Pushing to `main` branch triggers automatic deployment to Vercel. Tests run first in GitHub Actions. If tests pass, Vercel deploys all apps (web, admin, API). Preview deployments are created for pull requests.

### How do I deploy to production?

Merge your PR to `main` branch. CI/CD pipeline automatically runs tests and deploys to production on Vercel. Monitor deployment in Vercel dashboard or GitHub Actions.

### What happens when I push to main?

GitHub Actions runs: lint, typecheck, tests. If all pass, Vercel deploys: web app, admin dashboard, API. Environment variables are loaded from Vercel project settings. Database migrations are NOT automatic - run manually in production.

### How do I run migrations in production?

Connect to production database and run `pnpm db:migrate` locally, or set up a migration job in Vercel deployment settings, or use Neon's branching to test migrations before applying to production.

### How do I set environment variables in Vercel?

Go to Vercel dashboard → Project → Settings → Environment Variables. Add variables for Production, Preview, and Development environments. Redeploy to apply changes.

### How do I rollback a deployment?

In Vercel dashboard, go to Deployments, find the previous working deployment, click "Promote to Production". This makes that deployment the active one.

### How do I view production logs?

Vercel dashboard → Project → Logs for function logs. Use Sentry for error tracking (if configured). Check Vercel Analytics for performance metrics.

---

## Common Errors

### "Module not found" - what to do?

Run `pnpm install` to ensure dependencies are installed, run `pnpm build` to build local packages, check the import path is correct (use `@repo/*` for internal packages), verify the module is listed in `package.json` dependencies, and restart TypeScript server.

### "Type error" - how to fix?

Run `pnpm typecheck` to see full error details, ensure types are imported correctly, verify Zod schemas are defined and exported, check that all dependencies are built, make sure you're using `z.infer<typeof schema>` for types, and restart TypeScript server in VS Code.

### "Database connection failed" - troubleshooting steps?

Check `DATABASE_URL` in `.env.local` is correct, verify database server is running (or Docker container), ensure network connectivity to remote database, check firewall settings, verify database credentials, and test connection with `pnpm db:studio`.

### "Authentication error" - what to check?

Verify Clerk keys in `.env.local` are correct, check that user is logged in, ensure JWT token is being sent in requests, verify token hasn't expired, check Clerk dashboard for service status, and ensure middleware is configured correctly.

### "Validation error" - how to debug?

Read the Zod error message for which field failed, check the input data matches schema requirements, verify all required fields are provided, ensure data types are correct (string, number, etc.), check for min/max length or value constraints, and test schema separately with sample data.

**Example**:

```typescript
try {
  const validated = schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.log(error.errors); // Detailed validation errors
  }
}
```

### "Rate limit exceeded" - what to do?

Wait for the rate limit to reset (check response headers), use authenticated requests (higher limits), implement client-side caching to reduce requests, add debouncing to search inputs, and consider upgrading API tier if consistently hitting limits.

### "Build failed in CI/CD" - how to fix?

Check GitHub Actions logs for specific error, run the same commands locally (`pnpm typecheck`, `pnpm lint`, `pnpm test`), ensure all dependencies are in `package.json`, verify environment variables are set in GitHub/Vercel, check for failing tests, and fix any TypeScript errors.

### "404 Not Found on deployed app" - troubleshooting?

Verify the route exists in production build, check Vercel deployment logs for errors, ensure static files are generated correctly, verify API endpoints are deployed, check for case sensitivity in URLs, and ensure environment variables are set in Vercel.

### "EACCES permission denied" - how to fix?

Check file permissions with `ls -la`, fix with `chmod 644 file` or `chmod 755 directory`, ensure you have write access to the directory, avoid running commands with `sudo` when possible, and check that the file isn't locked by another process.

### "Port already in use" - solution?

Find the process using the port: `lsof -i :3000` or `netstat -ano | grep :3000`, kill the process: `kill -9 <PID>`, or change the port in configuration, restart your development server.

---

## Need More Help?

If your question isn't answered here:

1. Check the [Troubleshooting Guide](./troubleshooting.md) for detailed problem-solving steps
2. Search the [Glossary](./glossary.md) for term definitions
3. See [External Links](./external-links.md) for official documentation
4. Ask in team chat or create a GitHub issue
5. Contribute your solution back to this FAQ!

---

*Last updated: 2025-11-06*
