# CLAUDE.md - Seed Package

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

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode

# Code Quality
pnpm typecheck         # TypeScript validation
pnpm lint              # Biome linting
pnpm format            # Format code
```

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
3. Destinations
4. Accommodations
5. Events
6. Posts
7. Reviews
8. Amenities/Features (many-to-many)

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

## Notes

- Seeds are meant for development/testing, not production
- Always backup production data before running seeds
- Use `--reset` flag carefully - it drops all data
- Seed data uses realistic values for better testing
- Example data is deterministic when using same Faker seed
