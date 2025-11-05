# Guide: Creating Seeds

Complete guide to creating seed scripts for the Hospeda tourism platform. Learn how to add new seeds, handle relationships, and follow best practices.

## Table of Contents

- [When to Create Seeds](#when-to-create-seeds)
- [Seed Types](#seed-types)
- [File Structure](#file-structure)
- [Basic Seeder](#basic-seeder)
- [Data Normalization](#data-normalization)
- [Handling Relationships](#handling-relationships)
- [Using Faker.js](#using-fakerjs)
- [Error Handling](#error-handling)
- [Testing Seeds](#testing-seeds)
- [Best Practices](#best-practices)

## When to Create Seeds

Create seeds when:

- **New entity added**: Every new database entity needs seed data
- **Required system data**: Configuration, roles, permissions, categories
- **Test data needed**: Development and testing require realistic sample data
- **Demo environments**: Showcasing features needs convincing data
- **CI/CD pipelines**: Automated testing needs consistent data

Don't create seeds for:

- User-generated content in production
- Sensitive or private information
- Temporary or experimental data
- Data that changes frequently

## Seed Types

### Required Seeds

Located in `packages/seed/src/required/`

**Purpose:** Core system data needed for application to function

**Examples:**

- Roles and permissions
- Amenities (WiFi, parking, pool)
- Features (kitchen, balcony, sea view)
- Base destinations
- System configuration

**Characteristics:**

- Must be idempotent (can run multiple times safely)
- Should not depend on external APIs
- Limited dataset (only essential items)
- Version controlled carefully
- Safe for production

**Template:**

```typescript
import { AmenityService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';

export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: requiredManifest.amenities,

  normalizer: (data) => {
    const { $schema, id, slug, ...cleanData } = data as {
      $schema?: string;
      id?: string;
      slug?: string;
      [key: string]: unknown;
    };
    return cleanData;
  },

  getEntityInfo: (item) => {
    const amenity = item as { name: string; type?: string };
    const typeInfo = amenity.type ? ` (${amenity.type})` : '';
    return `"${amenity.name}"${typeInfo}`;
  }
});
```

### Example Seeds

Located in `packages/seed/src/example/`

**Purpose:** Realistic test data for development and testing

**Examples:**

- Sample users with various roles
- Accommodations (hotels, cabins, camping)
- Posts and blog content
- Events and festivals
- Reviews and ratings

**Characteristics:**

- Can use Faker.js for realistic data
- Larger datasets for testing pagination, search, etc.
- Can be regenerated frequently
- Not used in production
- Can depend on required seeds

**Template:**

```typescript
import { AccommodationService } from '@repo/service-core';
import exampleManifest from '../manifest-example.json';
import { createSeedFactory } from '../utils/index.js';

export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: exampleManifest.accommodations,

  normalizer: (data) => {
    const { $schema, id, slug, amenityIds, ...cleanData } = data;
    return cleanData;
  },

  preProcess: async (item, context) => {
    // Map foreign keys
    const ownerId = context.idMapper.getMappedUserId(item.ownerId);
    if (!ownerId) throw new Error(`Owner not found: ${item.ownerId}`);
    item.ownerId = ownerId;
  },

  relationBuilder: async (result, item, context) => {
    // Handle relationships after creation
    const accommodationId = result.data?.id;
    if (!accommodationId) return;

    // Add amenities
    const amenityIds = context.idMapper.getValidRealIds(
      'amenities',
      item.amenityIds || []
    );

    for (const amenityId of amenityIds) {
      await service.addAmenityToAccommodation({
        accommodationId,
        amenityId
      });
    }
  }
});
```

## File Structure

### 1. Create JSON Data Files

Each entity gets its own folder under `src/data/`:

```bash
mkdir packages/seed/src/data/category
```

Create individual JSON files:

`packages/seed/src/data/category/outdoor.json`:

```json
{
  "$schema": "../../schemas/category.schema.json",
  "id": "category-outdoor",
  "name": "Outdoor Activities",
  "description": "Activities in nature and outdoors",
  "icon": "🏕️",
  "order": 1
}
```

**Field guidelines:**

- `$schema`: Optional JSON schema reference (excluded during seeding)
- `id`: Seed ID for relationships (excluded, replaced with real UUID)
- `slug`: Auto-generated (excluded)
- Other fields: Actual data to insert

### 2. Update Manifest

Add files to appropriate manifest:

`packages/seed/src/manifest-required.json`:

```json
{
  "categories": [
    "outdoor.json",
    "culture.json",
    "gastronomy.json"
  ]
}
```

Or `packages/seed/src/manifest-example.json` for example seeds.

### 3. Create Seed Script

`packages/seed/src/required/categories.seed.ts`:

```typescript
import { CategoryService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';

export const seedCategories = createSeedFactory({
  entityName: 'Categories',
  serviceClass: CategoryService,
  folder: 'src/data/category',
  files: requiredManifest.categories
});
```

### 4. Register in Orchestrator

Add to `packages/seed/src/required/index.ts`:

```typescript
import { seedCategories } from './categories.seed.js';
import type { SeedContext } from '../utils/seedContext.js';

export async function runRequiredSeeds(context: SeedContext): Promise<void> {
  logger.info('🌱 Seeding required data...');

  // ... existing seeds

  await seedCategories(context);

  // ... more seeds
}
```

**Execution order matters:** Respect foreign key dependencies.

## Basic Seeder

### Minimal Configuration

```typescript
export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: ['wifi.json', 'parking.json', 'pool.json']
});
```

This creates a seeder that:

1. Loads JSON files from `src/data/amenity/`
2. Creates entities using `AmenityService`
3. Stores ID mappings for relationships
4. Tracks progress and errors

### With Custom Display Info

```typescript
export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: ['wifi.json', 'parking.json', 'pool.json'],

  getEntityInfo: (item) => {
    const amenity = item as { name: string; type?: string };
    const typeInfo = amenity.type ? ` (${amenity.type})` : '';
    return `"${amenity.name}"${typeInfo}`;
  }
});
```

**Output:**

```
[1 of 3] ✅ Created Amenity: "WiFi" (CONNECTIVITY)
[2 of 3] ✅ Created Amenity: "Parking" (PARKING)
[3 of 3] ✅ Created Amenity: "Swimming Pool" (RECREATION)
```

## Data Normalization

### Why Normalize?

JSON files contain metadata that shouldn't be inserted:

- `$schema`: JSON schema reference
- `id`: Seed ID (replaced with real UUID)
- `slug`: Auto-generated by service
- Other auto-generated fields

### Basic Normalization

```typescript
normalizer: (data) => {
  const { $schema, id, slug, ...cleanData } = data;
  return cleanData;
}
```

### Type-Safe Normalization

```typescript
normalizer: (data) => {
  const {
    $schema,
    id,
    slug,
    createdAt,
    updatedAt,
    ...cleanData
  } = data as {
    $schema?: string;
    id?: string;
    slug?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
  return cleanData;
}
```

### Excluding Relationships

```typescript
normalizer: (data) => {
  const {
    $schema,
    id,
    slug,
    amenityIds,     // Handled in relationBuilder
    featureIds,     // Handled in relationBuilder
    ...cleanData
  } = data as {
    $schema?: string;
    id?: string;
    slug?: string;
    amenityIds?: string[];
    featureIds?: string[];
    [key: string]: unknown;
  };
  return cleanData;
}
```

### Using Normalizer Utilities

```typescript
import {
  createExcludingNormalizer,
  createCombinedNormalizer
} from '../utils/index.js';

// Simple exclusion
normalizer: createExcludingNormalizer(['$schema', 'id', 'slug'])

// Combined operations
normalizer: createCombinedNormalizer(
  createExcludingNormalizer(['$schema', 'id', 'slug']),
  (data) => ({
    ...data,
    status: data.status || 'active'
  })
)
```

## Handling Relationships

### Foreign Keys (One-to-Many)

Map seed IDs to real database IDs in `preProcess`:

```typescript
export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: exampleManifest.accommodations,

  preProcess: async (item, context) => {
    // Map owner ID
    const seedOwnerId = item.ownerId as string;
    const realOwnerId = context.idMapper.getMappedUserId(seedOwnerId);

    if (!realOwnerId) {
      throw new Error(`Owner not found: ${seedOwnerId}`);
    }

    item.ownerId = realOwnerId;

    // Map destination ID
    const seedDestinationId = item.destinationId as string;
    const realDestinationId = context.idMapper.getMappedDestinationId(
      seedDestinationId
    );

    if (!realDestinationId) {
      throw new Error(`Destination not found: ${seedDestinationId}`);
    }

    item.destinationId = realDestinationId;
  }
});
```

**JSON example:**

```json
{
  "id": "accommodation-001",
  "name": "Beach Hotel Paradise",
  "ownerId": "user-001",
  "destinationId": "destination-001"
}
```

### Many-to-Many Relationships

Handle in `relationBuilder` after entity creation:

```typescript
export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: exampleManifest.accommodations,

  normalizer: (data) => {
    const { $schema, id, slug, amenityIds, featureIds, ...cleanData } = data;
    return cleanData;
  },

  preProcess: async (item, context) => {
    // Map foreign keys...
  },

  relationBuilder: async (result, item, context) => {
    const accommodationId = result.data?.id;
    if (!accommodationId) {
      throw new Error('No accommodation ID in result');
    }

    const service = new AccommodationService({});

    // Add amenities
    const seedAmenityIds = (item as { amenityIds?: string[] }).amenityIds || [];
    const realAmenityIds = context.idMapper.getValidRealIds(
      'amenities',
      seedAmenityIds
    );

    for (const amenityId of realAmenityIds) {
      await service.addAmenityToAccommodation(context.actor!, {
        accommodationId,
        amenityId
      });
    }

    // Add features
    const seedFeatureIds = (item as { featureIds?: string[] }).featureIds || [];
    const realFeatureIds = context.idMapper.getValidRealIds(
      'features',
      seedFeatureIds
    );

    for (const featureId of realFeatureIds) {
      await service.addFeatureToAccommodation(context.actor!, {
        accommodationId,
        featureId
      });
    }
  }
});
```

**JSON example:**

```json
{
  "id": "accommodation-001",
  "name": "Beach Hotel Paradise",
  "amenityIds": [
    "amenity-wifi",
    "amenity-parking",
    "amenity-pool"
  ],
  "featureIds": [
    "feature-beach-view",
    "feature-balcony"
  ]
}
```

### Using Relation Builder Utility

```typescript
import { createServiceRelationBuilder } from '../utils/index.js';

const amenitiesBuilder = createServiceRelationBuilder({
  serviceClass: AmenityService,
  methodName: 'addAmenityToAccommodation',
  extractIds: (item) => (item as { amenityIds?: string[] }).amenityIds || [],
  entityType: 'amenities',
  relationType: 'amenities',
  buildParams: (accommodationId, amenityId) => ({
    accommodationId,
    amenityId
  }),
  getMainEntityInfo: (item) => {
    const acc = item as { name: string };
    return `"${acc.name}"`;
  },
  getRelatedEntityInfo: (seedId, context) => {
    return context.idMapper.getDisplayName('amenities', seedId);
  }
});

export const seedAccommodations = createSeedFactory({
  // ... other config
  relationBuilder: amenitiesBuilder
});
```

## Using Faker.js

For generating realistic test data programmatically.

### Installation

Already included in package dependencies.

### Basic Usage

```typescript
import { faker } from '@faker-js/faker';

const user = {
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email(),
  phone: faker.phone.number(),
  avatar: faker.image.avatar()
};
```

### In Seed Scripts

```typescript
export const seedUsers = createSeedFactory({
  entityName: 'Users',
  serviceClass: UserService,
  folder: 'src/data/user',
  files: exampleManifest.users,

  preProcess: async (item, context) => {
    const user = item as Record<string, unknown>;

    // Generate realistic data if not provided
    if (!user.bio) {
      user.bio = faker.lorem.paragraph();
    }

    if (!user.phoneNumber) {
      user.phoneNumber = faker.phone.number();
    }
  }
});
```

### Deterministic Seeds

Use seed for reproducible data:

```typescript
import { faker } from '@faker-js/faker';

// Set seed for consistent results
faker.seed(123);

const users = Array.from({ length: 10 }, (_, i) => ({
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  email: faker.internet.email()
}));
```

### Common Patterns

```typescript
// Names
const firstName = faker.person.firstName();
const lastName = faker.person.lastName();
const fullName = faker.person.fullName();

// Contact
const email = faker.internet.email({ firstName, lastName });
const phone = faker.phone.number();

// Addresses
const street = faker.location.streetAddress();
const city = faker.location.city();
const state = faker.location.state();
const zipCode = faker.location.zipCode();

// Dates
const past = faker.date.past();
const future = faker.date.future();
const between = faker.date.between({
  from: '2024-01-01',
  to: '2024-12-31'
});

// Numbers
const rating = faker.number.float({ min: 1, max: 5, precision: 0.1 });
const price = faker.number.int({ min: 50, max: 500 });

// Text
const title = faker.lorem.sentence();
const description = faker.lorem.paragraphs(3);
const excerpt = faker.lorem.paragraph();

// Images
const avatar = faker.image.avatar();
const photo = faker.image.url();

// Arrays
const tags = faker.helpers.arrayElements(
  ['beach', 'mountain', 'city', 'rural'],
  { min: 1, max: 3 }
);

// Choices
const status = faker.helpers.arrayElement(['active', 'inactive', 'pending']);
```

## Error Handling

### Continue on Error

Allow seed to continue even if individual items fail:

```typescript
export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: exampleManifest.accommodations,
  continueOnError: true  // Continue even if one accommodation fails
});
```

Or use CLI flag:

```bash
pnpm seed --example --continueOnError
```

### Custom Error Handler

```typescript
export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: exampleManifest.accommodations,

  errorHandler: (item, index, error) => {
    const accommodation = item as { name?: string };
    logger.warn(`Failed to seed accommodation "${accommodation.name}": ${error.message}`);

    // Could implement retry logic, skip certain errors, etc.
    if (error.code === 'ALREADY_EXISTS') {
      logger.info('Skipping duplicate accommodation');
      return; // Continue processing
    }

    throw error; // Re-throw for other errors
  }
});
```

### Validation Before Create

```typescript
export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: exampleManifest.accommodations,

  validateBeforeCreate: (data) => {
    const accommodation = data as {
      name?: string;
      type?: string;
      maxGuests?: number;
    };

    // Check required fields
    if (!accommodation.name) {
      logger.warn('Skipping accommodation without name');
      return false;
    }

    // Validate values
    if (accommodation.maxGuests && accommodation.maxGuests < 1) {
      logger.warn('Skipping accommodation with invalid maxGuests');
      return false;
    }

    return true;
  }
});
```

## Testing Seeds

### Unit Testing

Test individual seed functions:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { seedAmenities } from '../amenities.seed.js';
import { createSeedContext } from '../../utils/seedContext.js';
import { IdMapper } from '../../utils/idMapper.js';

describe('seedAmenities', () => {
  let context: SeedContext;

  beforeEach(() => {
    context = createSeedContext({
      continueOnError: false,
      idMapper: new IdMapper(true) // Don't load saved mappings
    });
  });

  it('should seed amenities successfully', async () => {
    await seedAmenities(context);

    // Check ID mappings were created
    expect(context.idMapper.hasMapping('amenities', 'amenity-wifi')).toBe(true);
    expect(context.idMapper.hasMapping('amenities', 'amenity-parking')).toBe(true);
  });

  it('should handle missing files gracefully', async () => {
    // Test with continueOnError
    context.continueOnError = true;

    await expect(seedAmenities(context)).resolves.not.toThrow();
  });
});
```

### Integration Testing

Test complete seed flow:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runSeed } from '../index.js';
import { db } from '@repo/db';
import { amenitiesTable } from '@repo/db/schemas';
import { eq } from 'drizzle-orm';

describe('runSeed integration', () => {
  beforeEach(async () => {
    // Clear database
    await db.delete(amenitiesTable);
  });

  afterEach(async () => {
    // Cleanup
    await db.delete(amenitiesTable);
  });

  it('should seed required data', async () => {
    await runSeed({
      required: true,
      reset: false
    });

    // Verify amenities were created
    const amenities = await db.select().from(amenitiesTable);
    expect(amenities.length).toBeGreaterThan(0);

    // Verify specific amenity
    const wifi = amenities.find(a => a.name === 'WiFi');
    expect(wifi).toBeDefined();
    expect(wifi?.type).toBe('CONNECTIVITY');
  });

  it('should handle relationships correctly', async () => {
    await runSeed({
      required: true,
      example: true,
      reset: true
    });

    // Verify accommodation-amenity relationships
    const accommodations = await db.query.accommodations.findMany({
      with: {
        amenities: true
      }
    });

    expect(accommodations.length).toBeGreaterThan(0);
    expect(accommodations[0].amenities.length).toBeGreaterThan(0);
  });
});
```

## Best Practices

### 1. Naming Conventions

```typescript
// File names: lowercase-with-dashes.json
outdoor-activities.json
beach-hotel-paradise.json

// Seed IDs: entity-type-descriptor
category-outdoor
accommodation-beach-hotel-001
user-admin-john-doe

// Functions: seed + PluralEntityName
seedAmenities
seedAccommodations
seedUsers
```

### 2. Data Organization

```
src/data/
├── amenity/           # Group by entity type
│   ├── wifi.json
│   ├── parking.json
│   └── pool.json
├── accommodation/
│   ├── hotel-001.json
│   ├── cabin-001.json
│   └── camping-001.json
```

### 3. Idempotency

Make seeds safe to run multiple times:

```typescript
// Bad: Assumes clean database
await db.insert(table).values(data);

// Good: Check if exists first
const existing = await db.query.table.findFirst({
  where: eq(table.name, data.name)
});

if (!existing) {
  await db.insert(table).values(data);
}

// Better: Use upsert if available
await db.insert(table).values(data).onConflictDoNothing();
```

### 4. Clear Dependencies

Document foreign key requirements:

```typescript
/**
 * Seeds accommodations with their amenities and features.
 *
 * Dependencies:
 * - Users (for ownerId)
 * - Destinations (for destinationId)
 * - Amenities (for amenityIds)
 * - Features (for featureIds)
 *
 * Must be seeded AFTER: users, destinations, amenities, features
 * Must be seeded BEFORE: reviews, bookmarks
 */
export const seedAccommodations = createSeedFactory({
  // ... config
});
```

### 5. Meaningful IDs

```typescript
// Bad: Hard to understand relationships
"ownerId": "u1"
"destinationId": "d1"

// Good: Clear what entity it references
"ownerId": "user-admin-001"
"destinationId": "destination-concepcion"

// Better: Include description
"ownerId": "user-admin-john-doe"
"destinationId": "destination-concepcion-del-uruguay"
```

### 6. Complete JSON Schema

```json
{
  "$schema": "../../schemas/accommodation.schema.json",
  "id": "accommodation-beach-hotel-001",
  "name": "Beach Hotel Paradise",
  "type": "HOTEL",
  "description": "Luxury beachfront hotel with ocean views",
  "ownerId": "user-owner-maria-garcia",
  "destinationId": "destination-concepcion",
  "maxGuests": 4,
  "bedrooms": 2,
  "bathrooms": 2,
  "pricePerNight": 150,
  "amenityIds": [
    "amenity-wifi",
    "amenity-parking",
    "amenity-pool"
  ],
  "featureIds": [
    "feature-beach-view",
    "feature-balcony",
    "feature-air-conditioning"
  ]
}
```

### 7. Logging Information

```typescript
getEntityInfo: (item) => {
  const accommodation = item as {
    name: string;
    type: string;
    maxGuests?: number;
  };

  const guestInfo = accommodation.maxGuests
    ? ` (${accommodation.maxGuests} guests)`
    : '';

  return `"${accommodation.name}" - ${accommodation.type}${guestInfo}`;
}

// Output: "Beach Hotel Paradise" - HOTEL (4 guests)
```

### 8. Error Context

```typescript
preProcess: async (item, context) => {
  const accommodation = item as { name: string; ownerId: string };

  const ownerId = context.idMapper.getMappedUserId(accommodation.ownerId);
  if (!ownerId) {
    throw new Error(
      `Owner not found for accommodation "${accommodation.name}": ${accommodation.ownerId}`
    );
  }

  item.ownerId = ownerId;
}
```

### 9. Type Safety

```typescript
// Define types for your data
interface AccommodationSeedData {
  id: string;
  name: string;
  type: string;
  ownerId: string;
  destinationId: string;
  amenityIds?: string[];
  featureIds?: string[];
  [key: string]: unknown;
}

export const seedAccommodations = createSeedFactory<AccommodationSeedData>({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: exampleManifest.accommodations,

  preProcess: async (item, context) => {
    // TypeScript knows item is AccommodationSeedData
    const ownerId = context.idMapper.getMappedUserId(item.ownerId);
    // ... type-safe access to properties
  }
});
```

### 10. Progressive Enhancement

Start simple, add complexity as needed:

```typescript
// 1. Basic seed
export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: requiredManifest.amenities
});

// 2. Add normalization
export const seedAmenities = createSeedFactory({
  // ... basic config
  normalizer: createExcludingNormalizer(['$schema', 'id', 'slug'])
});

// 3. Add display info
export const seedAmenities = createSeedFactory({
  // ... basic config + normalization
  getEntityInfo: (item) => {
    const amenity = item as { name: string; type?: string };
    return `"${amenity.name}" (${amenity.type})`;
  }
});

// 4. Add validation
export const seedAmenities = createSeedFactory({
  // ... previous config
  validateBeforeCreate: (data) => {
    return Boolean(data.name && data.type);
  }
});
```

## Summary

You now know how to:

- ✅ Choose between required and example seeds
- ✅ Structure JSON data files
- ✅ Create seed scripts with the factory pattern
- ✅ Normalize data and remove metadata
- ✅ Handle foreign keys and relationships
- ✅ Use Faker.js for realistic data
- ✅ Implement error handling
- ✅ Test seed scripts
- ✅ Follow best practices

## Next Steps

- **[Dependencies Guide](./dependencies.md)** - Deep dive into relationship management
- **[Testing Guide](./testing.md)** - Comprehensive testing strategies
- **[Environments Guide](./environments.md)** - Environment-specific seeding
- **[Examples](../examples/)** - Working code examples

---

Last updated: 2024-11-05
