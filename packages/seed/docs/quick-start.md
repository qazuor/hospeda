# Quick Start Guide

Get started with the Hospeda seed package in 5 minutes. This guide walks you through running seeds, understanding the output, and creating your first seeder.

## Prerequisites

- Node.js 20+ installed
- PostgreSQL database running
- Environment variables configured in `.env.local`:

```bash
HOSPEDA_DATABASE_URL=postgresql://user:password@localhost:5432/hospeda
```

## Step 1: Run Your First Seed (2 minutes)

### Reset Database and Seed Everything

```bash
# From project root
pnpm seed --reset --required --example
```

**What happens:**

1. Database tables are cleared (respecting dependencies)
2. Required system data is loaded (roles, permissions, amenities, features, destinations)
3. Example test data is created (users, accommodations, posts, events, reviews)
4. Summary report is displayed

**Expected output:**

```
🚀 Starting seed process...
🔄 Executing reset
✅ Reset DB: Database reset successfully

📋 Validating manifests...
✅ Manifest Validation: All manifests validated successfully

👤 Loading super admin...
✅ Super Admin: Super admin loaded/created successfully

🌱 Seeding required data...
✅ Roles & Permissions: 5 created
✅ Amenities: 24 created
✅ Features: 18 created
✅ Attractions: 12 created
✅ Destinations: 5 created

🌱 Seeding example data...
✅ Users: 15 created
✅ Accommodations: 25 created
✅ Posts: 10 created
✅ Events: 8 created
✅ Reviews: 50 created

✅ Seed process complete
⏱️  Total time: 45.3s

📊 Summary:
- Total entities: 172 created, 0 failed
```

### Seed Only Required Data

```bash
# For production-like setup
pnpm seed --required
```

### Seed Only Example Data

```bash
# For development with existing required data
pnpm seed --example
```

### Continue on Errors

```bash
# Don't stop if individual items fail
pnpm seed --required --example --continueOnError
```

## Step 2: Understand Seed Types (1 minute)

### Required Seeds

System data your application needs to function:

```typescript
// Examples from packages/seed/src/required/
- rolePermissions.seed.ts  → User roles and permissions
- amenities.seed.ts        → WiFi, parking, pool, etc.
- features.seed.ts         → Kitchen, balcony, sea view, etc.
- attractions.seed.ts      → Tourist attractions
- destinations.seed.ts     → Cities and regions
```

**When to use:**

- Initial production deployment
- CI/CD database setup
- Fresh development environment

### Example Seeds

Realistic test data for development:

```typescript
// Examples from packages/seed/src/example/
- users.seed.ts              → Sample users
- accommodations.seed.ts     → Hotels, cabins, camping
- posts.seed.ts              → Blog posts
- events.seed.ts             → Events and festivals
- accommodationReviews.seed.ts → User reviews
```

**When to use:**

- Local development
- UI/UX testing
- Integration tests
- Demo environments

## Step 3: Explore Seed Data (1 minute)

### View JSON Seed Files

```bash
# Amenity example
cat packages/seed/src/data/amenity/wifi.json
```

```json
{
  "$schema": "../../schemas/amenity.schema.json",
  "id": "amenity-wifi",
  "name": "WiFi",
  "type": "CONNECTIVITY",
  "description": "High-speed wireless internet access"
}
```

**Key fields:**

- `$schema`: JSON schema reference (excluded during seeding)
- `id`: Seed ID used for relationships (excluded, mapped to real DB ID)
- `slug`: Auto-generated (excluded)
- Other fields: Actual data inserted into database

### Check ID Mappings

After seeding, ID mappings are saved to track relationships:

```bash
cat mappings/id-mappings.json
```

```json
{
  "amenities": {
    "amenity-wifi": {
      "id": "a1b2c3d4-...",
      "name": "WiFi"
    }
  },
  "users": {
    "user-001": {
      "id": "e5f6g7h8-...",
      "name": "John Doe"
    }
  }
}
```

**Purpose:** Maps seed IDs to real database UUIDs for relationship creation.

## Step 4: Create Your First Seeder (2 minutes)

Let's create a seeder for a hypothetical "Category" entity.

### 1. Create JSON Data Files

```bash
mkdir packages/seed/src/data/category
```

Create `packages/seed/src/data/category/outdoor.json`:

```json
{
  "$schema": "../../schemas/category.schema.json",
  "id": "category-outdoor",
  "name": "Outdoor Activities",
  "description": "Activities in nature",
  "icon": "🏕️"
}
```

Create `packages/seed/src/data/category/culture.json`:

```json
{
  "$schema": "../../schemas/category.schema.json",
  "id": "category-culture",
  "name": "Cultural Experiences",
  "description": "Museums, art, and history",
  "icon": "🎭"
}
```

### 2. Update Manifest

Add to `packages/seed/src/manifest-required.json`:

```json
{
  "categories": [
    "outdoor.json",
    "culture.json"
  ]
}
```

### 3. Create Seed Script

Create `packages/seed/src/required/categories.seed.ts`:

```typescript
import { CategoryService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';

/**
 * Seed factory for categories
 *
 * Creates category records from JSON files, excluding the slug field
 * since it's auto-generated by the service lifecycle hooks.
 */
export const seedCategories = createSeedFactory({
  entityName: 'Categories',
  serviceClass: CategoryService,
  folder: 'src/data/category',
  files: requiredManifest.categories,

  // Remove metadata and auto-generated fields
  normalizer: (data) => {
    const { $schema, id, slug, ...cleanData } = data as {
      $schema?: string;
      id?: string;
      slug?: string;
      [key: string]: unknown;
    };
    return cleanData;
  },

  // Custom entity info for better logging
  getEntityInfo: (item) => {
    const category = item as { name: string; icon?: string };
    const iconInfo = category.icon ? ` ${category.icon}` : '';
    return `"${category.name}"${iconInfo}`;
  }
});
```

### 4. Register in Orchestrator

Add to `packages/seed/src/required/index.ts`:

```typescript
import { seedCategories } from './categories.seed.js';

export async function runRequiredSeeds(context: SeedContext): Promise<void> {
  // ... existing seeds
  await seedCategories(context);
  // ... more seeds
}
```

### 5. Run Your New Seed

```bash
pnpm seed --required
```

**Output:**

```
🌱 Seeding Categories...
[1 of 2] ✅ Created Category: "Outdoor Activities" 🏕️
[2 of 2] ✅ Created Category: "Cultural Experiences" 🎭
✅ Categories: 2 created, 0 failed
```

## Step 5: Create Seed with Relationships (Bonus)

Let's add relationships to our category seeder.

### 1. Update JSON with Relations

Update `packages/seed/src/data/category/outdoor.json`:

```json
{
  "$schema": "../../schemas/category.schema.json",
  "id": "category-outdoor",
  "name": "Outdoor Activities",
  "description": "Activities in nature",
  "icon": "🏕️",
  "attractionIds": [
    "attraction-beach",
    "attraction-river",
    "attraction-park"
  ]
}
```

### 2. Add Relationship Logic

Update `packages/seed/src/required/categories.seed.ts`:

```typescript
import { CategoryService, AttractionService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';
import { createServiceRelationBuilder } from '../utils/serviceRelationBuilder.js';

export const seedCategories = createSeedFactory({
  entityName: 'Categories',
  serviceClass: CategoryService,
  folder: 'src/data/category',
  files: requiredManifest.categories,

  normalizer: (data) => {
    // Exclude relationships from main data
    const { $schema, id, slug, attractionIds, ...cleanData } = data as {
      $schema?: string;
      id?: string;
      slug?: string;
      attractionIds?: string[];
      [key: string]: unknown;
    };
    return cleanData;
  },

  getEntityInfo: (item) => {
    const category = item as { name: string; icon?: string };
    const iconInfo = category.icon ? ` ${category.icon}` : '';
    return `"${category.name}"${iconInfo}`;
  },

  // Add relationship builder
  relationBuilder: createServiceRelationBuilder({
    serviceClass: AttractionService,
    methodName: 'addAttractionToCategory',
    extractIds: (item) => (item as { attractionIds?: string[] }).attractionIds || [],
    entityType: 'attractions',
    relationType: 'attractions',
    buildParams: (categoryId: string, attractionId: string) => ({
      categoryId,
      attractionId
    }),
    getMainEntityInfo: (item) => {
      const cat = item as { name: string };
      return `"${cat.name}"`;
    },
    getRelatedEntityInfo: (seedId: string, context) => {
      return context.idMapper.getDisplayName('attractions', seedId);
    }
  })
});
```

### 3. Run and Verify

```bash
pnpm seed --reset --required
```

**Output:**

```
🌱 Seeding Categories...
[1 of 2] ✅ Created Category: "Outdoor Activities" 🏕️
  ↳ Adding attractions to "Outdoor Activities"
  ↳ [1 of 3] ✅ Added attraction: "Playa Grande"
  ↳ [2 of 3] ✅ Added attraction: "Río Uruguay"
  ↳ [3 of 3] ✅ Added attraction: "Parque San Martín"
[2 of 2] ✅ Created Category: "Cultural Experiences" 🎭
✅ Categories: 2 created, 0 failed
```

## Common CLI Options

```bash
# Full reset and seed everything
pnpm seed --reset --required --example

# Required data only
pnpm seed --required

# Example data with existing required data
pnpm seed --example

# Reset example data but keep required data
pnpm seed --reset --example --exclude=roles,permissions,amenities,features

# Continue on errors (don't stop if one item fails)
pnpm seed --continueOnError --required --example

# Run migrations first
pnpm seed --migrate --required
```

## Next Steps

### Learn More

- **[Creating Seeds Guide](./guides/creating-seeds.md)** - Comprehensive guide to seed creation
- **[Dependencies Guide](./guides/dependencies.md)** - Managing foreign key relationships
- **[API Reference](./api/seed-structure.md)** - Complete API documentation
- **[Examples](./examples/)** - Working TypeScript examples

### Advanced Topics

- **Custom normalizers** - Transform data before insertion
- **Batch insertion** - Process large datasets efficiently
- **Transaction management** - Atomic operations with rollback
- **Error handling** - Custom error recovery strategies
- **Faker.js integration** - Generate realistic test data

### Troubleshooting

#### Seed fails with "Actor not available"

**Solution:** Ensure super admin is loaded first. This happens automatically when using `--required` or `--example`.

#### Foreign key constraint violation

**Solution:** Check seed execution order. Parent entities must be seeded before children.

#### Duplicate key error

**Solution:** Use `--reset` flag to clear existing data before seeding.

#### Missing ID mapping

**Solution:** Verify parent entity was seeded successfully. Check `mappings/id-mappings.json`.

## Tips for Success

1. **Always use `--reset` during development** - Ensures clean state
2. **Check summary report** - Review entities created and errors
3. **Use meaningful seed IDs** - `user-admin-001` instead of `u1`
4. **Test seeds in isolation** - Run individual entity seeds to debug
5. **Keep manifests up to date** - Add new JSON files to manifests
6. **Document relationships** - Comment foreign key fields in JSON
7. **Use the factory pattern** - Don't write custom seed logic

## Summary

You now know how to:

- ✅ Run seeds with different flags
- ✅ Understand required vs example seeds
- ✅ Create basic seeders
- ✅ Add relationships between entities
- ✅ Debug common issues

**Total time: 5 minutes**

For more advanced use cases, see the [Complete Guides](./guides/) and [Examples](./examples/).

---

Last updated: 2024-11-05
