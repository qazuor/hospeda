# @repo/seed

Database seeding utilities for the Hospeda tourism platform. Provides flexible, robust tools for populating the database with required system data and example development data.

## Overview

The seed package helps you:

- **Load required system data**: Roles, permissions, amenities, features, destinations
- **Generate example data**: Sample accommodations, posts, users, events for development
- **Manage relationships**: Automatically handle foreign key dependencies
- **Track progress**: Detailed logging with summary reports
- **Handle errors**: Continue on error or rollback transactions

## Installation

This package is part of the Hospeda monorepo. No separate installation is needed.

## Quick Usage

```bash
# Run all seeds (required + example)
pnpm seed --reset --required --example

# Required data only (production-safe)
pnpm seed --required

# Example data only (development)
pnpm seed --example --reset

# Continue processing on errors
pnpm seed --required --continueOnError

# Exclude specific entities from reset
pnpm seed --reset --exclude=roles,permissions
```

## Programmatic Usage

```typescript
import { runSeed } from '@repo/seed';

await runSeed({
  required: true,
  example: true,
  reset: true,
  continueOnError: false
});
```

## Features

- **Factory-based seed creation** with customizable callbacks
- **ID mapping system** for handling entity relationships
- **Batch insertion** for large datasets
- **Transaction support** with rollback on error
- **Realistic test data** using Faker.js
- **Progress tracking** with detailed summary reports
- **Error handling** with recovery options
- **CLI interface** with multiple flags

## Documentation

Complete documentation is available in the `/docs` folder:

- **[Documentation Portal](./docs/README.md)** - Complete overview and navigation
- **[Quick Start Guide](./docs/quick-start.md)** - 5-minute tutorial
- **[API Reference](./docs/api/seed-structure.md)** - Complete API documentation
- **[Creating Seeds Guide](./docs/guides/creating-seeds.md)** - How to create new seeders
- **[Dependencies Guide](./docs/guides/dependencies.md)** - Managing entity relationships
- **[Testing Guide](./docs/guides/testing.md)** - Testing seed scripts
- **[Environments Guide](./docs/guides/environments.md)** - Environment-specific seeding
- **[Examples](./docs/examples/)** - Working TypeScript examples

## Quick Examples

### Basic Seed

```typescript
import { createSeedFactory } from '@repo/seed';
import { AmenityService } from '@repo/service-core';

export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: ['wifi.json', 'parking.json', 'pool.json'],
  normalizer: (data) => {
    const { $schema, id, slug, ...cleanData } = data;
    return cleanData;
  }
});
```

### Seed with Relations

```typescript
export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: ['hotel-001.json', 'cabin-001.json'],

  preProcess: async (item, context) => {
    // Map foreign key IDs
    const ownerId = context.idMapper.getMappedUserId(item.ownerId);
    if (!ownerId) throw new Error('Owner not found');
    item.ownerId = ownerId;
  },

  relationBuilder: async (result, item, context) => {
    // Create relationships after entity creation
    const accommodationId = result.data.id;
    const amenityIds = context.idMapper.getValidRealIds(
      'amenities',
      item.amenityIds
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

## CLI Flags

| Flag | Description |
|------|-------------|
| `--required` | Run required seeds (core system data) |
| `--example` | Run example seeds (sample development data) |
| `--reset` | Reset database before seeding |
| `--migrate` | Run migrations before seeding |
| `--continueOnError` | Continue processing when encountering errors |
| `--rollbackOnError` | Rollback transaction on error (incompatible with continueOnError) |
| `--exclude=entity1,entity2` | Exclude specific entities from reset |

## Seed Types

### Required Seeds

Core system data needed for the application to function:

- Roles and permissions
- Amenities (WiFi, parking, pool, etc.)
- Features (kitchen, balcony, sea view, etc.)
- Base destinations
- System configuration

### Example Seeds

Sample data for development and testing:

- Users (with Better Auth integration)
- Accommodations (hotels, cabins, camping, etc.)
- Posts and sponsors
- Events and organizers
- Reviews and bookmarks
- Tags and relations

## Environment Variables

```bash
# Database connection
HOSPEDA_DATABASE_URL=postgresql://user:password@localhost:5432/hospeda

# Super Admin authentication (optional)
SEED_AUTH_PROVIDER=BETTER_AUTH
SEED_SUPER_ADMIN_AUTH_PROVIDER_USER_ID=user_xxxxxxxxxxxxx
```

## Dependencies

- `@repo/db` - Database models and schemas
- `@repo/service-core` - Business logic services
- `@repo/schemas` - Validation schemas
- `@repo/logger` - Logging utilities
- `@faker-js/faker` - Realistic test data generation

## Contributing

See [Creating Seeds Guide](./docs/guides/creating-seeds.md) for detailed instructions on creating new seeders.

## License

Private - Part of Hospeda monorepo
