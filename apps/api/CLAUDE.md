# CLAUDE.md - API Application

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Hospeda API application (`apps/api`).

## Overview

Hono-based REST API server providing comprehensive endpoints for the Hospeda platform. Features include authentication (Better Auth), rate limiting, metrics collection, OpenAPI documentation, and standardized error handling.

## Key Commands

```bash
# Development
pnpm dev                # Start dev server with hot reload (port 3001)

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
pnpm test:file <path>  # Run specific test file

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code

# Build & Deploy
pnpm build             # Build for production
pnpm start             # Start production server
```

## Project Structure

```
src/
├── index.ts           # Server entry point with graceful shutdown
├── app.ts             # App initialization with middleware
├── middlewares/       # Custom middleware (auth, cors, metrics, etc.)
├── routes/            # Route handlers organized by entity
│   ├── accommodation/
│   ├── destination/
│   ├── event/
│   ├── post/
│   ├── user/
│   ├── auth/
│   ├── health/        # Health check endpoints
│   ├── metrics/       # Metrics endpoints
│   └── docs/          # API documentation endpoints
├── utils/             # Utilities and factories
│   ├── route-factory.ts      # Route creation factories
│   ├── response-factory.ts   # Response standardization
│   ├── response-helpers.ts   # Response utilities
│   └── create-app.ts         # App factory
└── schemas/           # API-specific schemas
```

## Route Factory System

Use factory functions to create consistent, type-safe routes with automatic validation and documentation.

### Simple Routes (Health Checks, Info)

```ts
import { createSimpleRoute } from '../../utils/route-factory';

export const healthRoute = createSimpleRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  description: 'Returns server health status',
  tags: ['Health'],
  responseSchema: z.object({
    status: z.string(),
    timestamp: z.string()
  }),
  handler: async (c) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  },
  options: { skipAuth: true } // Public endpoint
});
```

### OpenAPI Routes (CRUD Operations)

```ts
import { createOpenApiRoute } from '../../utils/route-factory';
import { createAccommodationSchema, accommodationSchema } from '@repo/schemas';

export const createAccommodationRoute = createOpenApiRoute({
  method: 'post',
  path: '/accommodations',
  summary: 'Create accommodation',
  description: 'Creates a new accommodation',
  tags: ['Accommodations'],
  requestBody: createAccommodationSchema,
  responseSchema: accommodationSchema,
  handler: async (c, params, body) => {
    const service = new AccommodationService(c);
    const result = await service.create(body);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data;
  }
  // Auth is required by default
});
```

### List Routes (Paginated)

```ts
import { createListRoute } from '../../utils/route-factory';
import { searchAccommodationSchema } from '@repo/schemas';

export const listAccommodationsRoute = createListRoute({
  method: 'get',
  path: '/accommodations',
  summary: 'List accommodations',
  description: 'Returns paginated list of accommodations',
  tags: ['Accommodations'],
  querySchema: searchAccommodationSchema.optional(),
  responseSchema: z.array(accommodationSchema),
  handler: async (c, params, body, query) => {
    const service = new AccommodationService(c);
    const result = await service.findAll(query);

    return {
      data: result.data,
      pagination: result.pagination
    };
  },
  options: { skipAuth: true } // Public listing
});
```

## Route Options

Configure route behavior with `options`:

```ts
options: {
  skipAuth: true,                              // Make route public
  skipValidation: true,                        // Skip validation middleware
  customRateLimit: {                           // Custom rate limiting
    requests: 5,
    windowMs: 60000
  },
  cacheTTL: 300,                              // Cache for 5 minutes
  middlewares: [customMiddleware]             // Additional middleware
}
```

## Middleware Stack

Middleware is applied in this order:

1. **Security Headers** (`secureHeaders`)
2. **CORS** (`corsMiddleware`)
3. **Logger** (`loggerMiddleware`)
4. **Metrics** (`metricsMiddleware`)
5. **Rate Limit** (`rateLimitMiddleware`)
6. **Authentication** (`authMiddleware` (Better Auth) - unless `skipAuth: true`)
7. **Actor Resolution** (`actorMiddleware`)
8. **Validation** (`validationMiddleware` - unless `skipValidation: true`)

Key middlewares:

- `actor.ts` - Extract user/actor from Better Auth session
- `auth.ts` - Better Auth authentication
- `cache.ts` - Response caching
- `metrics.ts` - Request metrics collection
- `rate-limit.ts` - Rate limiting
- `security.ts` - Security headers

## Authentication & Authorization

### Getting Current Actor

```ts
import { getActorFromContext } from '../middlewares/actor';
import { PermissionEnum } from '@repo/schemas';

export const handler = async (c: Context) => {
  const actor = getActorFromContext(c);

  // Check authentication
  if (!actor.isAuthenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check permissions — NEVER check roles directly, even for admin-only
  // routes. `actor.roles` (HOS-296) holds every role the actor wears at
  // once (a user can be HOST and COMMERCE_OWNER simultaneously); routing
  // logic must always ask "does the actor hold permission X".
  if (!actor.permissions.includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY)) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  // Access user data
  console.log(`User ${actor.id} from ${actor.email}`);
};
```

### Actor Properties

- `isAuthenticated: boolean`
- `id: string`
- `email: string`
- `roles: readonly RoleEnum[]` — every role the actor holds (HOS-296); there is no single "primary role"
- `permissions: readonly PermissionEnum[]`

## Response Standardization

Use `ResponseFactory` for consistent responses:

```ts
import { ResponseFactory } from '../utils/response-factory';

// Success response
return ResponseFactory.success(c, data, 200);

// Error response
return ResponseFactory.error(c, 'Not found', 404, ServiceErrorCode.NOT_FOUND);

// Paginated response
return ResponseFactory.paginated(c, {
  data: items,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 100,
    totalPages: 10
  }
});

// Validation error
return ResponseFactory.validationError(c, errors);
```

## Error Handling

```ts
import { handleRouteError } from '../utils/response-helpers';
import { ServiceError, ServiceErrorCode } from '@repo/schemas';

try {
  const result = await service.doSomething();

  if (!result.success) {
    throw new ServiceError(
      result.error.message,
      ServiceErrorCode.VALIDATION_ERROR
    );
  }

  return ResponseFactory.success(c, result.data);
} catch (error) {
  return handleRouteError(c, error);
}
```

## Route Architecture (Three-Tier)

All entity routes are organized into three tiers:

| Tier | URL Pattern | Auth | Purpose |
|------|-------------|------|---------|
| **Public** | `/api/v1/public/<entity>` | None (`skipAuth: true`) | Read-only, published content |
| **Protected** | `/api/v1/protected/<entity>` | User auth required | Own resource CRUD |
| **Admin** | `/api/v1/admin/<entity>` | Admin role + `PermissionEnum` | Full CRUD, all resources |

### Entity Directory Structure

```
routes/<entity>/
  index.ts           # Re-exports from subdirectories only
  public/index.ts    # Public GET routes (list, getById, getBySlug)
  protected/index.ts # Auth-required routes (create, update, delete own)
  admin/index.ts     # Admin CRUD (list, getById, create, update, patch, delete, hardDelete, restore, batch)
```

### Entity Index Pattern

Each entity's `index.ts` only re-exports:

```ts
export { adminAccommodationRoutes } from './admin/index.js';
export { protectedAccommodationRoutes } from './protected/index.js';
export { publicAccommodationRoutes } from './public/index.js';
```

### Route Registration (routes/index.ts)

```ts
// Public tier
app.route('/api/v1/public/accommodations', publicAccommodationRoutes);

// Protected tier
app.route('/api/v1/protected/accommodations', protectedAccommodationRoutes);

// Admin tier
app.route('/api/v1/admin/accommodations', adminAccommodationRoutes);
```

### Admin Route Factory

```ts
import { createAdminRoute } from '../../../utils/route-factory';
import { PermissionEnum } from '@repo/schemas';

export const adminGetByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID (admin)',
    requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
    requestParams: { id: AccommodationIdSchema },
    responseSchema: AccommodationAdminSchema,
    handler: async (ctx, params) => { /* ... */ }
});
```

### Admin List Query Params (AdminSearchBaseSchema)

All admin list routes accept: `page`, `pageSize`, `search`, `sort`, `status`, `includeDeleted`, `createdAfter`, `createdBefore`, plus entity-specific filters.

The base schema is defined in `@repo/schemas` at `common/admin-search.schema.ts`. Each entity extends it with entity-specific filters in `entities/<entity>/<entity>.admin-search.schema.ts`.

### Anti-patterns

- Never PUT/POST/DELETE in public tier
- Never skip auth on admin routes
- Never check roles directly (use `PermissionEnum`)
- Never mix tiers in one router

## Service Integration

```ts
import { AccommodationService } from '@repo/service-core';
import type { Context } from 'hono';

const handler = async (c: Context) => {
  // Create service instance with context
  const service = new AccommodationService(c);

  // Call service methods
  const result = await service.findAll({ isActive: true });

  if (!result.success) {
    return ResponseFactory.error(c, result.error.message);
  }

  return ResponseFactory.success(c, result.data);
};
```

## OpenAPI Documentation

Access documentation at:

- `/docs` - Documentation index
- `/reference` - Scalar API reference
- `/ui` - Swagger UI

Define OpenAPI schemas:

```ts
import { createOpenAPISchema } from '../utils/openapi-schema';

const schema = createOpenAPISchema({
  title: 'Accommodation',
  description: 'Accommodation entity',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    // ...
  }
});
```

## Deployment (Coolify)

This app runs as two Coolify resources on the self-hosted VPS:

- `hospeda-api-prod` — production, served at `https://api.hospeda.com.ar`
- `hospeda-api-staging` — staging, served at `https://staging-api.hospeda.com.ar`

Each resource has its own database, env vars, and (eventually, see SPEC-103 T-056) its own OAuth credentials. The operational toolkit (`scripts/server-tools/`, command `hops`) is target-aware via `--target=prod|staging` (defaults to prod). See [docs/migration/staging-prod-db-separation.md](../../docs/migration/staging-prod-db-separation.md) for the full split rationale + the beta-to-prod migration plan.

## Environment Variables

See `apps/api/.env.example` for a full list. All variables are validated at startup by the `env` object exported from `src/utils/env.ts` (Zod-validated, typed). Access env values exclusively through that object.

```env
# Server (no HOSPEDA_ prefix - framework-level)
NODE_ENV=development
API_PORT=3001
API_HOST=localhost

# Database
HOSPEDA_DATABASE_URL=postgresql://user:pass@localhost:5432/hospeda

# Authentication (Better Auth)
HOSPEDA_BETTER_AUTH_SECRET=your-secret-key-min-32-chars
HOSPEDA_BETTER_AUTH_URL=http://localhost:3001/api/auth

# Trusted origins
HOSPEDA_API_URL=http://localhost:3001
HOSPEDA_SITE_URL=http://localhost:4321
HOSPEDA_ADMIN_URL=http://localhost:3000

# CORS (comma-separated)
API_CORS_ORIGINS=http://localhost:4321,http://localhost:3000

# Rate limiting
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100
```

Always use `HOSPEDA_*` names for all environment variables.

### AI moderation fail-loud (SPEC-198)

`HOSPEDA_AI_MODERATION_REQUIRED` (boolean, default `false`) gates a startup
healthcheck: when `true`, the API refuses to start (`process.exit(1)`) if no
resolvable OpenAI credential exists in the AI vault. It requires both
`HOSPEDA_AI_VAULT_MASTER_KEY` and a stored OpenAI credential (admin credentials
API). At runtime, a missing moderation credential now fails CLOSED (the request
is blocked via `AiProviderUnconfiguredError` → HTTP 503 `PROVIDER_UNCONFIGURED`)
while transient provider failures (timeout/rate-limit/5xx) still fail OPEN. Set
`HOSPEDA_AI_MODERATION_REQUIRED=true` in production once the vault credential is
provisioned.

## Testing

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createMockUserActor } from '../utils/test-helpers';

describe('Accommodation Routes', () => {
  it('should create accommodation', async () => {
    const mockActor = createMockUserActor({
      role: 'admin',
      permissions: ['accommodation:write']
    });

    const response = await app.request('/api/v1/accommodations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify(mockData)
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

## Common Patterns

### Route with Path Parameters

```ts
requestParams: {
  id: z.string().uuid()
},
handler: async (c, params, body) => {
  const { id } = params;
  // Use id
}
```

### Route with Query Parameters

```ts
requestQuery: {
  status: z.enum(['active', 'inactive']).optional(),
  limit: z.coerce.number().max(100).default(10)
},
handler: async (c, params, body, query) => {
  const { status, limit } = query;
  // Use query params
}
```

### Batch Operations

```ts
requestBody: z.object({
  ids: z.array(z.string().uuid())
}),
handler: async (c, params, body) => {
  const { ids } = body;
  const service = new AccommodationService(c);

  const results = await Promise.all(
    ids.map(id => service.delete({ id }))
  );

  return { processed: results.length };
}
```

## Destination Hierarchy Routes

Public API routes for destination hierarchy traversal. All routes are unauthenticated, cached, and rate-limited.

| Route | Method | Description | Cache TTL | Rate Limit |
|-------|--------|-------------|-----------|------------|
| `/destinations/{id}/children` | GET | Direct children | 300s | 200 req/min |
| `/destinations/{id}/descendants` | GET | All descendants (maxDepth, destinationType params) | 300s | 100 req/min |
| `/destinations/{id}/ancestors` | GET | Ancestor chain | 600s | 200 req/min |
| `/destinations/{id}/breadcrumb` | GET | Navigation breadcrumb | 600s | 200 req/min |
| `/destinations/by-path` | GET | Resolve by path (`?path=/argentina/litoral`) | 300s | 200 req/min |

Route files are in `routes/destination/public/`. The `by-path` route is registered before `:id` routes to avoid conflicts.

## Performance Considerations

- Use `cacheTTL` for static/slow-changing data
- Implement pagination for list endpoints (always)
- Use database connection pooling (automatic with Drizzle)
- Monitor metrics at `/metrics` endpoint
- Rate limiting prevents abuse

## Key Dependencies

- `hono` - Web framework
- `@hono/zod-openapi` - OpenAPI + Zod validation
- `better-auth` - Better Auth authentication
- `@repo/service-core` - Business logic services
- `@repo/schemas` - Zod validation schemas
- `@repo/db` - Database models

## Best Practices

1. **Always use factory functions** for routes
2. **Import schemas from `@repo/schemas`** - never inline
3. **Use ResponseFactory** for consistent responses
4. **Extract business logic to services** - keep routes thin
5. **Set appropriate route options** (auth, cache, rate limit)
6. **Document with OpenAPI** metadata
7. **Test all endpoints** with different actor roles
8. **Handle errors gracefully** with try-catch
9. **Validate all inputs** with Zod schemas
10. **Use TypeScript strict mode** - no `any` types

## Entitlement & Limit Enforcement (SPEC-145)

### Middleware chain order

Every protected route runs middleware in this order:

```
auth → actor → billing → billingCustomer → entitlement → trial → [options.middlewares]
```

`options.middlewares` is where entitlement and limit gates live. Gate the
route there — never inside the handler body.

The `entitlement` step is `entitlementMiddleware()`
(`src/utils/create-app.ts:176`), the LOADER that populates `userEntitlements` /
`userLimits` on the context. It is NOT the gate, and it runs before `trial`.
This diagram used to omit it entirely.

### Ordering invariants

- `trialMiddleware` fires **before** `requireEntitlement`. An expired-trial
  user gets HTTP 402 before the 403 entitlement gate (T-019 learning).
- Entitlement gate always precedes limit check. Gate the feature first so
  the usage counter is never queried for users who lack the feature.

### Unified ServiceError contract

Gates MUST throw `ServiceError`, never `HTTPException(403)` directly:

- Missing entitlement: `ServiceError(ServiceErrorCode.ENTITLEMENT_REQUIRED)` →
  HTTP 403 `{ error: { code: 'ENTITLEMENT_REQUIRED', ... } }`
- Limit reached: `ServiceError(ServiceErrorCode.LIMIT_REACHED)` →
  HTTP 403 `{ error: { code: 'LIMIT_REACHED', ... } }`

The global `createErrorHandler()` performs the mapping. Direct
`HTTPException(403)` bypasses that mapping and breaks API consumers.

### Staff bypass (INV-6)

`SUPER_ADMIN`, `ADMIN`, `EDITOR`, and `CLIENT_MANAGER` bypass entitlement
checks. `entitlementMiddleware` grants them the full unlimited set (all
`EntitlementKey` values, all `LimitKey` values at `-1`) before
`options.middlewares` runs. By the time `requireEntitlement` executes, the
key is already in their set — no 403 is ever thrown. The bypass is policy
of the loader, not the checker.

### `clearEntitlementCache` invariant (INV-1)

Every money-mutating lifecycle event (subscription activated / upgraded /
downgraded / cancelled / paused / resumed; addon purchased / expired) MUST
call `clearEntitlementCache(customerId)`. Failure to do so leaves stale
plan entitlements in the 5-minute in-memory FIFO cache, causing the user
to see the old plan's gates until TTL expires.

The transversal guard test (`apps/api/test/services/inv1-cache-invalidation.guard.test.ts`,
SPEC-145 T-021) statically scans ~24 handler files and fails CI if any one
drops the call.

### Phantom gates / reserved limit stubs

`// PHANTOM-GATE (SPEC-145)`: a gate function exists in
`middlewares/tourist-entitlements.ts` or `middlewares/accommodation-entitlements.ts`
but the route it protects has not been built yet. Do not delete these;
do not build the route without a spec. The snapshot guard excepts them.

**An unmounted gate helper does NOT prove the feature is unprotected.** A route
may call the generic `requireEntitlement` directly instead of the named helper,
leaving the helper stale while the gate stays real and enforced. Measured
2026-08-31: of the four helpers marked `PHANTOM-GATE`, two were false positives —
`CAN_USE_CALENDAR` is required by **4** routes and `CAN_SYNC_EXTERNAL_CALENDAR` by
**3**, both through the generic call. The real phantoms were `RESPOND_REVIEWS`,
`CAN_ATTACH_REVIEW_PHOTOS` and `CUSTOM_BRANDING`, with **0** routes each. So count
the routes that require the entitlement KEY, never the call sites of the helper.

`// RESERVED-LIMIT`: a `LimitKey` is wired via `requireLimit` but the
`currentCount` implementation is a hardcoded `0` stub (the counter service
does not exist yet). See the "Reserved — Limit Stubs" section in
`docs/billing/endpoint-gate-matrix.md`.

### Gate matrix + snapshot guard

`docs/billing/endpoint-gate-matrix.md` is the single source of truth for
gate decisions on every protected and admin route. The snapshot guard
(`apps/api/test/middlewares/endpoint-gate-matrix.guard.test.ts`, T-145-22)
parses the table on every CI run:

- A new handler file without a matrix row → CI fails.
- A matrix row pointing at a deleted file → CI fails.

When adding a new protected/admin route:

1. Add a matrix row with the correct Decision and Status.
2. If Decision = `none`, write a clear Reason.
3. If gating an existing previously-ungated route, document the behavior
   change in `docs/billing/spec-145-behavior-changes.md`.

See `docs/billing/adding-an-entitlement.md` for the full end-to-end workflow.

### DELETE-body factory gotcha

Hono's DELETE handlers do **not** receive a request body. Route factories
that need to pass resource identifiers on a deletion-like action (e.g.,
cancel a subscription addon) must use an action-POST pattern:

```
POST /api/v1/protected/billing/addons/{id}/cancel
```

Never `DELETE` with a body expecting it to be parsed — the body is silently
discarded.

## SUPER_ADMIN bypasses `role_permission` entirely

`src/middlewares/actor.ts:273` gives any actor wearing the SUPER_ADMIN hat
`permissions: Object.values(PermissionEnum)` — **every value in the enum, without
reading the database**. `role_permission` does not participate in that decision.

Two things state the opposite and both are wrong:

- **A stale comment.** `packages/service-core/src/services/user/user.permissions.ts:12`
  says *"SUPER_ADMIN always passes because they have all permissions assigned"*. It
  is out of date. The comment that actually documents the bypass lives in the seed
  (`packages/seed/src/required/rolePermissions.seed.ts`, ~line 322).
- **Counting the table manufactures a finding.** Production holds 328
  `role_permission` rows for SUPER_ADMIN against 693 enum values. That reads as
  "365 permissions are missing, the super admin cannot do everything" and is false —
  the column never applies. The table has no `deleted_at`, so the 328 is real; the
  mistake is assuming that number governs anything.

Corollaries verified in the same code:

- Roles are **additive** since HOS-296 (`user_role`, PK `(userId, role)`). Adding
  SUPER_ADMIN to an account that already has `HOST, USER` removes nothing.
- **No `user_permission` deny stops a super admin**: the short-circuit returns
  before the branch that applies `(⋃ perms ∪ grants) \ denies`.
- **There is no role cache.** `actor.ts:218` documents that a 60s cache was tried
  and removed, so a grant takes effect on the next request with no re-login.
- The audit row (`user_role_audit`) is written by `grantRole` in the same
  transaction — **there is no trigger**. A hand-written `INSERT` into `user_role`
  works just as well and leaves a super admin in production with no record of who
  granted it.

## Testing gotchas — three ways a green test here proves nothing

This app has three distinct traps that make a passing test vacuous. All three were
measured, not inferred.

### 1. `test/setup.ts` mocks `@repo/db` wholesale

`test/setup.ts` carries a **global** `vi.mock('@repo/db')` that replaces the module
with `createDbMock()`. Its tables are plain string maps — `accommodations` is
`{ id: 'id', ownerId: 'owner_id', deletedAt: 'deleted_at', ... }` and does not even
have `slug`, `visibility` or `lifecycleState`.

So **any test that inspects a Drizzle condition is describing the stub, not the
code**. It goes green and asserts nothing. Measured in HOS-585: a guard over
`isEntityPubliclyVisible` (6 near-identical lookups) stayed green after deleting
`lifecycleState` and `visibility` from the accommodation lookup.

When the realistic defect is "one of N near-identical blocks lost a line", the
idiom here is a **static guard over the source**, not a runtime assertion. Slice one
block per key (from ``SOURCE.indexOf(`\n    ${key}: async`)`` to the next) and assert
each condition inside *that* slice — asserting over the whole file passes as long as
*some* block still has it, which is exactly the bug. Add a test proving the slicing
actually cuts (`expect(block).not.toContain('otherTable.slug')`).

If you do write a local `vi.mock`, put the holder in `vi.hoisted()`: the factory is
hoisted above the module body, so a `let` declared above it does not exist yet when
the factory closes over it. The capture never happens, and it reads exactly like
"the query does not request columns".

### 2. Route-handler tests in `test/routes/*` often never reach the handler

Several hide it behind a conditional assertion:

```ts
if (res.status === 201) { /* real asserts */ }
else { expect(res.status).not.toBe(404); }  // ← the branch that always runs
```

Measured in `accommodation-protected-add-media.test.ts` (HOS-791): adding
`expect(res.status).toBe(201)` returned **400 `MISSING_REQUIRED_HEADER`** —
`validation-config.ts` requires `user-agent` by default and no test in the file
sends it. With the header set it became **500 `INTERNAL_ERROR`**: the middleware
chain does not complete under test either. No mock was ever reached
(`mockFindByAccommodation.mock.calls` → `[]`, `addMedia` → 0 calls).

Before writing a behavioural test there, check whether the neighbours use the
conditional form — if they do, the handler is not reachable. Prove it by asserting
`mock.calls` on something the handler invokes, not the status code.

### 3. `CI=true` is safe for unit tests here, and only here

`test/setup.ts:68` explicitly `delete`s the `CI` variable from the process, because
several guards read `env.CI !== 'true'` to refuse mock actors on a real pipeline.
That `delete` neutralises it for the default config — measured, 331 tests green with
no spurious 401.

But the app has **three** vitest configs and the protection is one line in one setup
file:

| Config | `setupFiles` | deletes `CI`? |
| --- | --- | --- |
| `vitest.config.ts` (default/unit) | `./test/setup.ts` | **yes** |
| `vitest.config.e2e.ts` | `./test/e2e/setup/env-setup.ts` + `test-database.ts` | **no** |
| `vitest.config.integration.ts` | the same two | **no** |

With `vitest.config.e2e.ts` and `CI=true`, **every request returns 401 GUEST** — the
`HOSPEDA_ALLOW_MOCK_ACTOR` path stops honouring the `x-mock-actor-*` headers.
Without it, the same 17 tests pass. So: `CI=true` for unit runs, never for e2e or
integration. If you see mass 401s, check which config you are running before
anything else.

## Common Gotchas

- `createAdminListRoute` auto-merges `PaginationQuerySchema` and uses `page`+`pageSize` (NOT `limit`)
- Billing endpoints from qzpay-hono (`/api/v1/protected/billing/plans`, `/api/v1/protected/billing/addons`) DO accept `limit` natively
- Always use `PermissionEnum` for auth checks, never check roles directly
- `ResponseFactory` must be used for all responses - no raw `c.json()`

## Billing: key files and operational pointers

Routes live in `src/routes/billing/`: `start-paid.ts`, `plan-change.ts`,
`subscription-cancel.ts`, `subscription-pause.ts`, `addons.ts`, `promo-codes.ts`,
`trial.ts`, `settings.ts`, `usage.ts`, `metrics.ts`, `notifications.ts`.

Cron jobs for billing: `src/cron/jobs/dunning.job.ts`, `webhook-retry.job.ts`,
`finalize-cancelled-subs.ts`, `trial-expiry.ts`, `addon-expiry.job.ts`,
`apply-scheduled-plan-changes.ts`, `subscription-poll.job.ts`,
`abandoned-pending-subs.job.ts`, `exchange-rate-fetch.job.ts`,
`preapproval-less-expiry.job.ts`, `entity-subscription-cache-reconcile.job.ts`,
`addon-subscription-reconcile.job.ts`, `courtesy-expiry.job.ts`,
`propagate-plan-price-changes.job.ts`,
`reactivation-supersession-reconcile.job.ts`,
`subscription-drift-reconcile.job.ts`, `partner-expiry.job.ts` and
`partner-unpaid-reaper.job.ts`.

**Which of those re-reads MercadoPago, and when** — worth knowing before adding a
sweep, because the answer used to be "almost none of them". Every job above
except one is keyed on a LOCAL trigger: an enqueued polling job
(`subscription-poll`), an elapsed `trial_end` (`trial-reconcile`), a
`cancel_at_period_end` flag (`finalize-cancelled-subs`), a 30-minute TTL
(`abandoned-pending-subs`), a missing preapproval (`preapproval-less-expiry`).
A row that diverged from the provider with none of those markers set was
invisible to all of them, permanently — measured in HOS-913 at over three hours
for one `paused` row. `subscription-drift-reconcile` (HOS-914) is the only sweep
whose trigger is the PROVIDER: it re-reads every non-terminal row that holds a
preapproval and re-applies the verdict through `processSubscriptionUpdated`.
Two rules it follows and a new one must too: a failed read is never a verdict
(a preapproval MercadoPago cannot resolve is reported, never cancelled — a
cash-paid partner has no counterpart at all, HOS-1062), and a correction goes
through the webhook transition rather than a second state machine.

Two traps in that list. **A job's registered NAME is not its filename** —
`trial-expiry.ts` registers as `trial-reconcile`, and that string is what
`hops cron-trigger` and the admin cron UI expect; `src/cron/schedules.manifest.ts`
is the authoritative name → schedule mapping. And the last two belong to the
**partner** vertical, which does not go through
`reconcileSubscriptionLinkedEntities` at all — its bridge is
`services/partner-reconcile.service.ts`.

For MP sandbox setup and operator procedures:
[`docs/migration/mercadopago-sandbox-runbook.md`](../../docs/migration/mercadopago-sandbox-runbook.md)

For incident response:
[`docs/billing/billing-runbooks.md`](../../docs/billing/billing-runbooks.md)

For the deferred SPEC-193 staging smoke batch (pre-promotion gate):
[`SPEC-193 pending-staging-smoke`](../../.qtm/specs/SPEC-193-billing-go-live-readiness-master/docs/pending-staging-smoke.md)

## AI Social routes — Custom GPT integration (`/api/v1/ai/social/*`)

These routes are consumed by the Custom GPT that operators use to draft social
posts. They are authenticated by the inbound `x-hospeda-ai-key` header only (no
Better Auth session), via `createApiKeyRoute`. Two behaviors carry non-obvious
design constraints worth documenting.

### Campaign/batch slugs are resolve-**or-create** (HOS-66 G-4/G-5)

`POST /api/v1/ai/social/drafts` accepts optional `campaignSlug` / `batchSlug`.
`SocialDraftIngestionService` resolves each: a slug that matches an existing row
associates the draft to it; a slug with **no** match **creates** a new active
`social_campaigns` / `social_content_batches` row (name derived from the slug)
and associates to that. The response echoes `campaignResolution` /
`batchResolution` (`{ id, slug, isNew }`) so the operator can confirm whether a
new one was created. `audienceSlug` / `footerSlug` / `baseHashtagSetSlug` stay
resolve-**only** (null on miss) — only campaigns/batches get create semantics.

**NG-2 — matching stays LLM-side, never a backend heuristic.** The backend does
NOT fuzzy-match near-duplicate names, infer a campaign from hashtags/keywords, or
guess an association when no slug is sent. That reasoning lives entirely in the
Custom GPT's instructions (the OpenAPI `description` text on `/drafts` and
`/catalog`): before submitting a new name the GPT checks `GET /catalog`'s
`campaigns` / `batches` arrays for a near-duplicate and asks the operator to
confirm "use existing" vs "create new"; when no explicit slug is given it reasons
over the active lists and proposes an association. Do NOT add keyword/hashtag
heuristics to the ingestion service — a new slug always means "create" at the
backend layer, by design.

### Public-data-pull is deliberately narrow (HOS-66 G-10, R-1)

`GET /api/v1/ai/social/public-data` (backed by `SocialPublicDataService`) returns
`{ items }` of public entities shaped for draft enrichment
(`{ entityType, id, title, slug, summary, imageUrl }`), so the GPT can link a real
accommodation or reference a real destination instead of inventing one. Optional
`?query=` narrows by title/name (via `safeIlike`).

**R-1 — this is NOT a general-purpose public API aggregator.** The
`SocialPublicDataEntityTypeEnumSchema` is intentionally limited to
`ACCOMMODATION` and `DESTINATION`, and the service only reads PUBLIC/ACTIVE rows
of those two. Extend it **deliberately, never speculatively**: to add an entity
type you must (1) add a variant to the enum in `@repo/schemas`, (2) widen
`SocialPublicDataService`, and (3) update the scope guard in
`apps/api/test/routes/social/ai/social-public-data-scope.test.ts` (which asserts
the exact enum option set and fails if it grows). That guard exists precisely to
turn silent scope creep into a deliberate, reviewed change.

## AI credential model-sync (HOS-94)

The admin AI-credentials router (`ai/credentials/index.ts`) can auto-detect
which models a stored provider credential has access to, instead of relying
only on the hardcoded `KNOWN_PROVIDERS` catalog in `apps/admin`.

### `POST /api/v1/admin/ai/credentials/{providerId}/sync-models`

Gated by `adminAuthMiddleware([AI_SETTINGS_MANAGE])` only — staff bypass
entitlements (INV-6), so there is no billing gate; see the row in
[`docs/billing/endpoint-gate-matrix.md`](../../docs/billing/endpoint-gate-matrix.md).
Orchestrated by `ai-sync-models.service.ts::syncAiProviderModels()`: decrypt
(`getDecryptedAiProviderCredential` plus a direct `metadata.baseURL` read,
since the vault's decrypt result omits metadata) → fetch
(`listProviderModels` from `@repo/ai-core`) → filter
(`ai-sync-models.filter.ts`, chat-capability classifier) → merge
(`ai-sync-models.merge.ts`, detected ∪ curated `KNOWN_PROVIDERS`, each entry
annotated `source: 'detected' | 'curated' | 'both'`).

- **Ephemeral, never persisted** (OQ-3): the endpoint never writes
  `metadata.models`. The operator reviews the returned suggestion list and
  confirms the enabled subset through the existing
  `PATCH /api/v1/admin/ai/credentials/{providerId}` route, unchanged.
- **Bad/expired key** → the fetcher throws `ListModelsAuthError`, mapped to a
  `VALIDATION_ERROR` / HTTP 400 (actionable, not retryable — operator must
  fix/rotate the credential). Rate limit / provider outage → HTTP 503
  (`SERVICE_UNAVAILABLE`, retryable). No credential configured for the
  provider → HTTP 404.
- **Fail-open auto-sync on create/rotate** (OQ-2): `createAiProviderCredential`
  and `rotateAiProviderCredential` (`ai-credential-vault.service.ts`) both call
  `syncAiProviderModels()` automatically after their own transaction commits,
  purely to validate the key against the live provider — it does **not**
  pre-enable any detected model, and `metadata.models` is never written by
  this path. Any error is swallowed into a single `apiLogger.warn` and never
  propagates, so a bad key or a down provider never blocks the credential
  save itself.
- **Detected models arrive OFF by default.** A sync call only refreshes the
  suggestion pool; nothing in a sync result is auto-added to a credential's
  enabled `metadata.models` (NG-4). An id already enabled before the sync
  stays enabled if still present in the merged result.
- **Denylist hides non-chat families**: embeddings, whisper/STT, TTS,
  dall-e/image, moderation, deprecated markers, realtime/audio, code-only,
  web-search-augmented, and deep-research variants are excluded from the
  suggestion list entirely (`DENYLIST_PATTERNS` in `ai-sync-models.filter.ts`).
  Anything not confidently classified is kept and flagged `uncertain: true`
  instead of being silently dropped (OQ-1).
- **Re-sync auto-deselects now-denylisted models**: the result's
  `hiddenModelIds` lists every raw id the denylist just excluded; the admin
  UI (`SyncModelsSection`) removes any of those ids that were previously
  enabled from the operator's selection automatically. A hand-typed custom id
  the provider API never returned is never in `hiddenModelIds`, so custom
  additions are always preserved untouched.
- **No new env var, no DB migration** — the enabled list still lives in
  `ai_provider_credentials.metadata.models` exactly as before this feature.

See [`.specs/HOS-94-auto-detect-provider-models/spec.md`](../../.specs/HOS-94-auto-detect-provider-models/spec.md)
for the full design record (OQ-1..OQ-5 resolutions, AC-1..AC-7).

## Related Documentation

- [Adding API Routes](docs/development/creating-endpoints.md)
- [Authentication Guide](../../docs/security/authentication.md)
- [Dependency Policy](../../docs/guides/dependency-policy.md)
- [API Design Standards](../../.claude/docs/api-design-standards.md)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
