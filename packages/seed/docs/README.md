# @repo/seed Documentation Portal

Welcome to the complete documentation for the Hospeda seed package. This system provides flexible, robust database seeding utilities for populating the database with required system data and example development data.

## Overview

The seed package is a critical component of the Hospeda monorepo, responsible for initializing and populating the database with both essential system data and realistic test data for development.

### What is the Seed Package?

The seed package provides:

- **Required Seeds**: Core system data (roles, permissions, amenities, features, base destinations)
- **Example Seeds**: Realistic test data (accommodations, users, posts, events, reviews)
- **Factory Pattern**: Reusable seed creation with customizable callbacks
- **ID Mapping**: Automatic handling of foreign key relationships
- **Progress Tracking**: Detailed logging and summary reports
- **Error Handling**: Continue on error or rollback transactions
- **CLI Interface**: Simple command-line tools

### Why Use the Seed Package?

- **Consistent Data**: Ensures all environments have necessary system data
- **Fast Development**: Quickly populate databases with realistic test data
- **Relationship Management**: Automatically handles foreign key dependencies
- **Type Safety**: Full TypeScript support with type inference
- **Flexible**: Customizable callbacks for complex seeding scenarios
- **Reliable**: Transaction support with rollback capabilities

## Core Concepts

### Seed Types

#### Required Seeds

System data that must exist for the application to function properly:

```typescript
// Examples: roles, permissions, amenities, features
await runSeed({ required: true });
```

**Use cases:**

- Initial production deployment
- CI/CD pipeline database setup
- Fresh development environment setup

#### Example Seeds

Realistic test data for development and testing:

```typescript
// Examples: users, accommodations, posts, events
await runSeed({ example: true });
```

**Use cases:**

- Local development
- Integration testing
- Demo environments
- UI/UX validation

### Seed Factory Pattern

The seed package uses a factory pattern to create reusable, customizable seeders:

```typescript
export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: ['wifi.json', 'parking.json'],

  // Custom normalization
  normalizer: (data) => {
    const { $schema, id, slug, ...cleanData } = data;
    return cleanData;
  },

  // Custom display info
  getEntityInfo: (item) => {
    return `"${item.name}" (${item.type})`;
  }
});
```

### ID Mapping System

The ID mapper tracks relationships between seed IDs (from JSON files) and real database IDs:

```typescript
// Store mapping after creation
context.idMapper.setMapping('users', 'user-001', realUserId, 'John Doe');

// Retrieve mapping when creating related entities
const ownerId = context.idMapper.getMappedUserId('user-001');
```

**Benefits:**

- Simplifies relationship creation
- Provides readable error messages
- Enables seed data reusability
- Supports incremental seeding

### Execution Order

Seeds execute in a specific order to respect foreign key dependencies:

```
Required Seeds:
1. Roles & Permissions
2. Amenities
3. Features
4. Attractions
5. Destinations

Example Seeds:
1. Users
2. Tags
3. Post Sponsors
4. Event Organizers
5. Event Locations
6. Accommodations
7. Posts
8. Events
9. Reviews
10. Bookmarks
11. Relations (many-to-many)
```

## Architecture

### Package Structure

```
@repo/seed/
├── src/
│   ├── index.ts                  # Main orchestrator
│   ├── cli.ts                    # CLI interface
│   ├── required/                 # Required seeds
│   │   ├── index.ts             # Required seed orchestrator
│   │   ├── rolePermissions.seed.ts
│   │   ├── amenities.seed.ts
│   │   ├── features.seed.ts
│   │   ├── attractions.seed.ts
│   │   └── destinations.seed.ts
│   ├── example/                  # Example seeds
│   │   ├── index.ts             # Example seed orchestrator
│   │   ├── users.seed.ts
│   │   ├── accommodations.seed.ts
│   │   ├── posts.seed.ts
│   │   ├── events.seed.ts
│   │   └── ...
│   ├── data/                     # JSON seed data
│   │   ├── amenity/
│   │   ├── feature/
│   │   ├── destination/
│   │   ├── accommodation/
│   │   └── ...
│   ├── utils/                    # Utilities
│   │   ├── seedFactory.ts       # Factory creator
│   │   ├── seedContext.ts       # Context management
│   │   ├── idMapper.ts          # ID mapping
│   │   ├── seedRunner.ts        # Execution logic
│   │   ├── summaryTracker.ts    # Progress tracking
│   │   ├── errorHistory.ts      # Error tracking
│   │   ├── normalizers.ts       # Data normalizers
│   │   ├── relationBuilders.ts  # Relationship helpers
│   │   └── ...
│   ├── manifest-required.json   # Required seed files
│   └── manifest-example.json    # Example seed files
├── docs/                         # Documentation
└── mappings/                     # Generated ID mappings
```

### Data Flow

```
1. CLI/Program Entry
   ↓
2. Load Environment & Initialize DB
   ↓
3. Create Seed Context
   - Initialize ID mapper
   - Set configuration flags
   ↓
4. Reset Database (optional)
   - Drop data in reverse dependency order
   - Respect exclude list
   ↓
5. Run Migrations (optional)
   ↓
6. Validate Manifests
   - Check file existence
   - Validate JSON structure
   ↓
7. Load/Create Super Admin
   - Create actor context
   ↓
8. Execute Required Seeds (if --required)
   - Roles & Permissions
   - Amenities
   - Features
   - Attractions
   - Destinations
   ↓
9. Execute Example Seeds (if --example)
   - Users
   - Accommodations
   - Posts
   - Events
   - Reviews
   - Relations
   ↓
10. Generate Summary Report
    - Entities created/failed
    - Error details
    - Execution time
```

### Seed Factory Lifecycle

```
For each JSON file:
1. Load JSON data
   ↓
2. Normalize data (remove metadata, transform fields)
   ↓
3. Validate before create (optional custom validation)
   ↓
4. Pre-process (map foreign key IDs, set actor)
   ↓
5. Create entity via service
   ↓
6. Store ID mapping (seedId → realId)
   ↓
7. Post-process (optional custom logic)
   ↓
8. Build relationships (amenities, features, etc.)
   ↓
9. Transform result (optional)
   ↓
10. Track success/error in summary
```

## Quick Navigation

### Getting Started

- **[Quick Start Guide](./quick-start.md)** - 5-minute tutorial to get started with seeding

### Reference Documentation

- **[API Reference - Seed Structure](./api/seed-structure.md)** - Complete API documentation for all functions, types, and interfaces

### Guides

- **[Creating Seeds](./guides/creating-seeds.md)** - Complete guide to creating new seed scripts
- **[Managing Dependencies](./guides/dependencies.md)** - How to handle foreign key relationships
- **[Testing Seeds](./guides/testing.md)** - Testing strategies for seed scripts
- **[Environment Configuration](./guides/environments.md)** - Environment-specific seeding strategies

### Examples

- **[Basic Seed Example](./examples/basic-seed.ts)** - Simple single-entity seeder
- **[Related Entities Example](./examples/related-entities.ts)** - Seeding with foreign keys
- **[Complex Data Example](./examples/complex-data.ts)** - Advanced seeding with Faker.js and relations

## Common Use Cases

### 1. Fresh Development Environment

```bash
# Reset database, run migrations, seed everything
pnpm seed --reset --migrate --required --example
```

### 2. Update Required Data

```bash
# Update system data without affecting test data
pnpm seed --required
```

### 3. Regenerate Test Data

```bash
# Clear and regenerate example data only
pnpm seed --reset --example --exclude=roles,permissions,amenities,features
```

### 4. Production Initial Setup

```bash
# Load only required system data
pnpm seed --required --migrate
```

### 5. CI/CD Pipeline

```bash
# Setup test database with full data
pnpm seed --reset --required --example --continueOnError
```

## Best Practices

### Seed Creation

1. **Use the factory pattern** - Don't write custom seed logic
2. **Normalize data properly** - Remove metadata and auto-generated fields
3. **Handle relationships** - Use idMapper and relationBuilder
4. **Provide good logging** - Custom getEntityInfo for readable logs
5. **Validate before insert** - Use validateBeforeCreate callback
6. **Test thoroughly** - Write tests for seed scripts

### Data Organization

1. **Separate required from example** - Clear distinction between system and test data
2. **Use meaningful IDs** - Use descriptive seed IDs like `user-admin-001` instead of `u1`
3. **Maintain manifests** - Keep manifest files up to date
4. **Version seed data** - Track changes to seed JSON files
5. **Document relationships** - Comment foreign key fields in JSON

### Error Handling

1. **Continue on error for development** - Use `--continueOnError` flag
2. **Rollback for production** - Use `--rollbackOnError` for critical seeds
3. **Check error reports** - Review summary tracker output
4. **Handle missing dependencies** - Validate foreign key mappings
5. **Provide clear error messages** - Custom error handlers with context

### Performance

1. **Batch inserts when possible** - Process multiple items together
2. **Minimize database queries** - Reuse ID mappings
3. **Use transactions appropriately** - Balance atomicity and performance
4. **Limit example data size** - Keep development seeds reasonable
5. **Profile slow seeds** - Identify and optimize bottlenecks

## Troubleshooting

### Common Issues

#### Missing ID Mapping

```
Error: No mapping found for owner ID: user-001
```

**Solution:** Ensure parent entities are seeded before children. Check seed execution order.

#### Duplicate Key Violations

```
Error: duplicate key value violates unique constraint
```

**Solution:** Use `--reset` flag or implement idempotent seeds that check for existing data.

#### Foreign Key Constraint Violations

```
Error: insert or update violates foreign key constraint
```

**Solution:** Verify foreign key IDs exist in idMapper. Check preProcess callback.

#### Actor Not Available

```
Error: Actor not available in context
```

**Solution:** Ensure super admin is loaded before seeds that require authentication.

#### Manifest File Mismatch

```
Warning: File 'data/amenity/wifi.json' in manifest but not found
```

**Solution:** Check file paths in manifest match actual file locations.

### Debug Tips

1. **Enable detailed logging** - Check logger output for execution flow
2. **Inspect ID mappings** - Review `mappings/id-mappings.json`
3. **Check summary report** - Review entities created and errors
4. **Validate JSON files** - Ensure JSON is valid and complete
5. **Test seed isolation** - Run individual seeds to isolate issues
6. **Review error history** - Check errorHistory output for patterns

## Advanced Topics

### Custom Normalizers

Create reusable data transformation functions:

```typescript
import { createExcludingNormalizer, createCombinedNormalizer } from './utils';

const myNormalizer = createCombinedNormalizer(
  createExcludingNormalizer(['slug', 'id']),
  (data) => ({
    ...data,
    customField: processCustom(data.customField)
  })
);
```

### Custom Relation Builders

Create reusable relationship creation logic:

```typescript
import { createServiceRelationBuilder } from './utils';

const amenitiesBuilder = createServiceRelationBuilder({
  serviceClass: AmenityService,
  methodName: 'addAmenityToAccommodation',
  extractIds: (item) => item.amenityIds || [],
  entityType: 'amenities',
  relationType: 'amenities',
  buildParams: (mainId, relatedId) => ({
    accommodationId: mainId,
    amenityId: relatedId
  })
});
```

### Custom Error Handlers

Implement custom error recovery strategies:

```typescript
const customErrorHandler = (item, index, error) => {
  if (error.code === 'ALREADY_EXISTS') {
    logger.info(`Skipping duplicate: ${item.name}`);
    return; // Continue processing
  }
  throw error; // Re-throw for other errors
};
```

### Transaction Management

Use transactions for atomic operations:

```typescript
import { db } from '@repo/db';

await db.transaction(async (tx) => {
  // All operations within this block are atomic
  await seedEntitiesA(tx);
  await seedEntitiesB(tx);
  // If any operation fails, all are rolled back
});
```

## Contributing

When contributing to the seed package:

1. **Follow the factory pattern** - Use `createSeedFactory` for new seeds
2. **Update manifests** - Add new JSON files to appropriate manifest
3. **Document relationships** - Comment foreign key dependencies
4. **Add tests** - Write tests for new seed functionality
5. **Update documentation** - Keep guides and examples current
6. **Test thoroughly** - Verify seeds work with `--reset`, `--continueOnError`, etc.

## Support

For issues, questions, or contributions:

- **Issues**: Create GitHub issue with `[seed]` prefix
- **Questions**: Ask in team chat or create discussion
- **Documentation**: Submit PR to update docs

## Additional Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Faker.js Documentation](https://fakerjs.dev)
- [Hospeda Architecture Docs](../../../docs/architecture/)
- [Database Schema Reference](../../db/docs/)

---

Last updated: 2024-11-05
