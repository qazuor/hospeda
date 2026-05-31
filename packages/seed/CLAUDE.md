# CLAUDE.md - Seed Package

> **📚 Main Documentation**: For project-wide guidelines, workflows, and standards, see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Seed package (`@repo/seed`).

## Overview

Database seeding utilities for populating the database with initial and example data. Provides scripts for creating realistic test data, required system data, and development fixtures.

## Key Commands

```bash
# Seeding
pnpm seed                      # Run all seeds
pnpm seed --reset              # Reset DB first, then seed
pnpm seed --required           # Only required data
pnpm seed --example            # Only example data
pnpm seed --reset --required --example  # Full reset with all data
pnpm seed:test-users           # Re-seed only the SPEC-143 test users matrix

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
```

## Test Users for Billing (SPEC-143 Block 1)

A separate `--test-users` seed group creates 13 dev-only test users with **real login credentials** + billing state, so entitlement gates and limit enforcement can be exercised locally without redeploying to staging for every smoke iteration.

The group is **intentionally not part of `--required` or `--example`** — that way `pnpm db:seed` (production-shaped: `--reset --required --example`) never creates these accounts. Only the local-dev shortcut `pnpm db:fresh-dev` chains `pnpm db:seed:test-users` after the main seed completes.

| Email | Role | Plan | Limits highlight |
|-------|------|------|------------------|
| `editor@local.test` | EDITOR | — | content moderator |
| `sponsor@local.test` | SPONSOR | — | sponsorship flows |
| `tourist-free@local.test` | USER | (free tier) | default entitlements |
| `tourist-plus@local.test` | USER | `tourist-plus` | mid tourist tier |
| `tourist-vip@local.test` | USER | `tourist-vip` | top tourist tier |
| `host-basico@local.test` | HOST | `owner-basico` | MAX_ACCOMMODATIONS=1, MAX_PHOTOS=5 |
| `host-pro@local.test` | HOST | `owner-pro` | MAX_ACCOMMODATIONS=3, MAX_PHOTOS=15 |
| `host-premium@local.test` | HOST | `owner-premium` | MAX_ACCOMMODATIONS=10, MAX_PHOTOS=30, MAX_ACTIVE_PROMOTIONS=unlimited |
| `host-pro-plus-addon@local.test` | HOST | `owner-pro` + `extra-photos-20` addon | MAX_PHOTOS=35 (15 base + 20 addon). SPEC-143 #32 |
| `host-trial@local.test` | HOST | `owner-basico` (status=`trialing`, 14d) | Block 3 trial-lifecycle smoke (2.1.a/2.1.b/2.1.c) |
| `complex-basico@local.test` | CLIENT_MANAGER | `complex-basico` | basic complex |
| `complex-pro@local.test` | CLIENT_MANAGER | `complex-pro` | mid complex |
| `complex-premium@local.test` | CLIENT_MANAGER | `complex-premium` | top complex |

All users share password `Password123!` and have `emailVerified=true`. Super admin and admin already exist via the required seed (`admin-user.json` / `super-admin-user.json` with `admin@hospeda.com` / `superadmin@hospeda.com`).

**Workflow:**

```bash
pnpm db:fresh-dev              # Full reset + main seed + test users
pnpm db:seed:test-users        # Re-create only the test users (requires --required to have run before)
pnpm seed --test-users         # Same as above, direct CLI invocation
```

The seed inserts directly into `users` + `account` + `billing_customers` + `billing_subscriptions` (bcrypt password hash with `SALT_ROUNDS=12` matching `apps/api/src/lib/auth.ts`). It does NOT go through Better Auth's `signUpEmail` API (cross-package boundary) and does NOT call MercadoPago (we never need a real checkout for entitlement testing).

When `loadEntitlements()` runs on login, the active subscription drives `userLimits` and `userEntitlements`, so limit-enforcement endpoints behave exactly as they would for a real paying user.

Source: [`src/test-users/`](src/test-users/) (orchestrator + seed function). Design doc: [`.qtm/specs/SPEC-143-billing-testing-coverage/docs/local-test-users-seed-plan.md`](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/local-test-users-seed-plan.md).

## Role Permission Gotchas

### Why HOST has `TAG_SYSTEM_VIEW`

Looks like privilege escalation at first glance — it is not. HOST holds `TAG_SYSTEM_VIEW`
intentionally per SPEC-086 D-017 so the **tag picker in accommodation edit forms** can
list SYSTEM tags as selectable options. The grant is read-only inside the picker; HOST
cannot create / update / delete SYSTEM tags.

Admin pages at `/platform/tags/system` are gated independently on `ACCESS_API_ADMIN`
(per SPEC-156 locked decisions), so this grant does not bleed into admin surfaces.

**Do not remove `TAG_SYSTEM_VIEW` from the HOST role block in `rolePermissions.seed.ts`**
without coordinating with whatever replaces the tag picker.

## Package Structure

```
src/
├── seeders/           # Seed scripts by entity
│   ├── users.ts
│   ├── accommodations.ts
│   ├── destinations.ts
│   ├── events.ts
│   └── index.ts
├── data/              # Static seed data
│   ├── required/         # Required system data
│   └── examples/         # Example development data
├── utils/             # Seeding utilities
│   ├── faker.ts          # Faker.js helpers
│   └── generators.ts     # Data generators
├── index.ts           # Main seed script
└── cli.ts             # CLI interface
```

## Seed Types

### Required Seeds (--required)

System data required for application to function:

```ts
// seeders/required/roles.ts
export async function seedRoles() {
  await db.insert(roleTable).values([
    { name: 'user', description: 'Standard user' },
    { name: 'moderator', description: 'Content moderator' },
    { name: 'admin', description: 'Administrator' },
  ]);
}
```

Required seeds include:

- User roles and permissions
- System configuration
- Default categories
- Essential enums

### Example Seeds (--example)

Realistic development/demo data:

```ts
// seeders/examples/accommodations.ts
import { faker } from '@faker-js/faker';

export async function seedAccommodations(count = 50) {
  const accommodations = Array.from({ length: count }, () => ({
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()),
    description: faker.lorem.paragraphs(3),
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    priceRange: faker.helpers.arrayElement(['$', '$$', '$$$', '$$$$']),
    rating: faker.number.float({ min: 3, max: 5, precision: 0.1 }),
  }));

  await db.insert(accommodationTable).values(accommodations);
}
```

Example seeds include:

- Sample accommodations
- Demo users
- Test events
- Example reviews

### Accommodation Image Pool (SPEC-119)

Example accommodation seeds draw their `media.featuredImage` and `media.gallery[]`
URLs from a curated type-specific pool, NOT from arbitrary stock photos:

- Source of truth: [`src/data/accommodation/_image-pool.ts`](src/data/accommodation/_image-pool.ts) — `IMAGE_POOL_BY_TYPE` const, 25 URLs per accommodation type × 8 types = 200 curated URLs.
- Documentation: [`docs/image-pool.md`](docs/image-pool.md) — rotation conventions, how to add a URL, how to remove one.
- Lint script: `pnpm lint:image-pool` — verifies every URL in every accommodation JSON belongs to its type pool. Run before committing changes to accommodation seeds.
- Refresh script: `scripts/refresh-accommodation-images.ts` — deterministic per-accommodation assignment (featured cyclic by id position, gallery random subset 5-24 photos). Re-runnable without drift.

### Accommodation Pricing Tiers (SPEC-119)

Example accommodations use four realism tiers for the `price` field:

- Tier 0 (~25%): `price` key omitted entirely (host did not publish a price)
- Tier 1 (~25%): `{ price, currency }` only
- Tier 2 (~30%): base + 1-2 `additionalFees` OR 1 discount
- Tier 3 (~20%): base + 3-5 fees + 1-2 discounts (with ≥1 `others[]` custom entry)

Assignment is deterministic (seeded by `accommodation.id`) and runs via
`scripts/apply-pricing-tiers.ts`. ARS value ranges per type and fee shapes are
documented in `scripts/apply-pricing-tiers.ts` itself (see `BASE_RANGE_BY_TYPE`
and `buildFee`).

Invariants are enforced by tests in
[`test/accommodation-seeds-realism.test.ts`](test/accommodation-seeds-realism.test.ts):
image pool membership, camping gallery uniqueness, featured uniqueness within
type, tier distribution, gallery count variance, fee field coverage, and
`others[]` coverage. Run via `pnpm test`.

## Creating Seeders

### Basic Seeder

```ts
// seeders/destinations.ts
import { db } from '@repo/db';
import { destinationTable } from '@repo/db/schemas';

export async function seedDestinations() {
  console.log('Seeding destinations...');

  await db.insert(destinationTable).values([
    {
      name: 'Concepción del Uruguay',
      slug: 'concepcion-del-uruguay',
      description: 'Historic city on the Uruguay River',
      province: 'Entre Ríos',
      country: 'Argentina',
    },
    {
      name: 'Colón',
      slug: 'colon',
      description: 'Beautiful beach town',
      province: 'Entre Ríos',
      country: 'Argentina',
    },
  ]);

  console.log('✓ Destinations seeded');
}
```

### Using Faker for Realistic Data

```ts
import { faker } from '@faker-js/faker';

export async function seedPosts(count = 100) {
  const posts = [];

  for (let i = 0; i < count; i++) {
    posts.push({
      title: faker.lorem.sentence(),
      slug: faker.helpers.slugify(faker.lorem.sentence()),
      content: faker.lorem.paragraphs(5),
      excerpt: faker.lorem.paragraph(),
      authorId: faker.helpers.arrayElement(userIds),
      status: faker.helpers.arrayElement(['draft', 'published']),
      publishedAt: faker.date.past(),
    });
  }

  await db.insert(postTable).values(posts);
}
```

### With Relations

```ts
export async function seedAccommodationsWithReviews() {
  // Create accommodations
  const accommodations = await db
    .insert(accommodationTable)
    .values(/* ... */)
    .returning();

  // Create reviews for each accommodation
  for (const accommodation of accommodations) {
    const reviewCount = faker.number.int({ min: 5, max: 20 });

    const reviews = Array.from({ length: reviewCount }, () => ({
      accommodationId: accommodation.id,
      userId: faker.helpers.arrayElement(userIds),
      rating: faker.number.int({ min: 1, max: 5 }),
      comment: faker.lorem.paragraphs(2),
    }));

    await db.insert(reviewTable).values(reviews);
  }
}
```

## Seed Utilities

### Data Generators

```ts
// utils/generators.ts
import { faker } from '@faker-js/faker';

export function generateAccommodation() {
  return {
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    description: faker.lorem.paragraphs(3),
    address: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state(),
    zipCode: faker.location.zipCode(),
    phone: faker.phone.number(),
    email: faker.internet.email(),
    website: faker.internet.url(),
    priceRange: faker.helpers.arrayElement(['$', '$$', '$$$', '$$$$']),
    rating: faker.number.float({ min: 3, max: 5, precision: 0.1 }),
  };
}

export function generateUser() {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    firstName,
    lastName,
    role: faker.helpers.arrayElement(['user', 'moderator']),
  };
}
```

### Batch Insertion

```ts
// utils/batch.ts
export async function batchInsert<T>(
  table: any,
  data: T[],
  batchSize = 100
) {
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    await db.insert(table).values(batch);
    console.log(`Inserted ${Math.min(i + batchSize, data.length)}/${data.length}`);
  }
}
```

## Running Seeds

### From Root Directory

```bash
# Full reset and seed everything
pnpm db:fresh

# Or run seed package directly
pnpm --filter @repo/seed seed --reset --required --example
```

### Programmatically

```ts
import { runSeeds } from '@repo/seed';

await runSeeds({
  reset: true,        // Reset database first
  required: true,     // Seed required data
  example: true,      // Seed example data
});
```

## Seed Order

Seeds run in specific order to respect foreign key constraints:

1. Required system data (roles, categories)
2. Users
3. Destinations (hierarchy nodes first: countries, regions, provinces, then cities)
4. Accommodations
5. Events
6. Posts
7. Reviews
8. Amenities/Features (many-to-many)

### Destination Hierarchy Seeds

Destination seeds include hierarchy fields (`parentDestinationId`, `destinationType`, `level`, `path`, `pathIds`). Parent nodes (Argentina, Litoral, Entre Rios, Departamento Uruguay) are seeded before cities.

The seed script uses `preProcess` to resolve `parentDestinationId` references from seed IDs to real UUIDs via `context.idMapper.getRealId('destinations', seedId)`. Hierarchy nodes must be seeded in order from root (COUNTRY) to leaf (CITY/TOWN).

### Destination FAQs (SPEC-158)

The 22 CITY destination seeds (`001`–`022`) carry a top-level `faqs` array:

```json
"faqs": [
  { "question": "¿Cómo se llega a la ciudad?", "answer": "...", "category": "Cómo llegar" }
]
```

`faqs` is a 1-to-N child relation (`destination_faqs` table), NOT a column, so the
destination seed factory **excludes it in the `normalizer`** and creates the rows in a
`postProcess` hook that loops the array and calls `DestinationService.addFaq`. Unlike the
accommodation factory (which drops `category`), the destination loop **forwards `category`**
so the grouped FAQ accordion + `FAQPage` JSON-LD render correctly.

Content invariants are enforced by [`test/destination-content-faqs.test.ts`](test/destination-content-faqs.test.ts):
every CITY ships 5–7 FAQs, the baseline categories `Cómo llegar` / `Qué hacer` /
`Cuándo visitar` / `Servicios` are all present, question/answer lengths are within the
`BaseFaqSchema` bounds, and the markdown `description` stays within `[30, 8000]` chars.

## Best Practices

1. **Make seeds idempotent** - can run multiple times safely
2. **Use transactions** - rollback on error
3. **Respect foreign keys** - seed in correct order
4. **Generate realistic data** - use Faker.js
5. **Batch large inserts** - avoid memory issues
6. **Log progress** - show what's being seeded
7. **Handle errors gracefully** - clear error messages
8. **Separate required from example** - allow selective seeding
9. **Use TypeScript** - type-safe seed data
10. **Test seeds** - ensure they work after schema changes

## Example Seed Script

```ts
// seeders/complete-seed.ts
import { seedRoles } from './required/roles';
import { seedUsers } from './examples/users';
import { seedDestinations } from './examples/destinations';
import { seedAccommodations } from './examples/accommodations';

export async function runCompleteSeed() {
  console.log('🌱 Starting database seed...');

  try {
    // Required data
    await seedRoles();

    // Example data
    await seedUsers(50);
    await seedDestinations(10);
    await seedAccommodations(100);

    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}
```

## CLI Usage

```bash
# Seed everything
pnpm seed

# Reset and seed
pnpm seed --reset

# Only required data
pnpm seed --required

# Only example data
pnpm seed --example

# Specific count
pnpm seed --example --count=100
```

## Key Dependencies

- `@faker-js/faker` - Generate realistic fake data
- `@repo/db` - Database models and schemas
- `@repo/schemas` - Validation schemas

## Seed Data JSON Format

Static seed data files are in `src/data/<entity>/` as individual JSON files per record.

### Key Fields

- **`icon`**: Use actual icon component names (e.g., `"WifiIcon"`, `"PoolIcon"`), NOT generic names like `"amenity"`
- **`displayWeight`**: Integer controlling display order (higher = shown first). E.g., WiFi = 95, Pool = 80, Sauna = 30
- **`isBuiltin`**: Boolean for system-provided vs user-created items
- **`isFeatured`**: Boolean for highlighting on public pages

Example amenity seed:

```json
{
    "slug": "wifi",
    "description": "Conexion Wi-Fi",
    "type": "CONNECTIVITY",
    "icon": "WifiIcon",
    "isBuiltin": false,
    "isFeatured": true,
    "displayWeight": 95
}
```

## Seed Moderation Conventions

Seed fixtures use `"moderationState": "APPROVED"` as the default for both entity-level and media (`featuredImage`, `gallery`, `videos`) moderation fields. Seeded data is curated and pre-vetted, so it should not enter the system in a pending review state.

- **`APPROVED`** (default): Normal seed fixtures. Use this for every media asset and entity unless there is a specific reason otherwise.
- **`PENDING`**: Do NOT use in seed fixtures. This is the runtime default the moderation pipeline assigns to user-uploaded content awaiting review; seeding it would simulate an inconsistent state.
- **`REJECTED`**: Reserved for test fixtures that exercise the rejected-moderation branch. Keep the set small (currently `022-destination-ceibas.json` and `020-destination-larroque.json`, each with one gallery image flipped). Do not expand without a test-coverage justification.

If `moderationState` is missing from a fixture, `withModerationDefault('APPROVED')` in `src/utils/` fills it in. `MediaSchema.parse()` then fails loudly on any malformed media shape, so omissions are safe but malformed values are not.

## Notes

- The full `pnpm db:seed` script (which expands to `pnpm --filter @repo/seed seed --reset --required --example`) is **dev-only**. It wipes the database (`--reset`) and loads Faker-generated demo content (`--example`), so it must never run against a production or shared staging database.
- A curated `--required` run that excludes the `users` step IS the documented production day-1 step. The exact command is `pnpm --filter @repo/seed seed --required --exclude=users`. See [`docs/deployment/first-time-setup.md` Phase 4](../../docs/deployment/first-time-setup.md#phase-4-database-initialization) for the full bootstrap procedure, including how to create the first real admin user via Better Auth signup and promote them.
- The `users` step seeds [`admin-user.json`](src/data/user/required/admin-user.json) and `super-admin-user.json`, both with the well-known `admin@hospeda.com` email. Loading these on prod creates predictable admin credentials and must always be excluded.
- Always back up production data before running any seed command, even the curated production-safe one.
- Use `--reset` carefully — it drops all data. Never combine with a production database URL.
- Seed data uses realistic values for better testing.
- Example data is deterministic when using the same Faker seed.

**Last Updated**: 2026-04-30

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>
