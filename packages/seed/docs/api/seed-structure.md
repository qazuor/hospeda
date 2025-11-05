# API Reference - Seed Structure

Complete API documentation for the @repo/seed package. This reference covers all functions, types, interfaces, and utilities available for database seeding.

## Table of Contents

- [Main Functions](#main-functions)
- [Seed Factory](#seed-factory)
- [Seed Context](#seed-context)
- [ID Mapper](#id-mapper)
- [Utilities](#utilities)
- [CLI Interface](#cli-interface)
- [Types](#types)

## Main Functions

### runSeed

Main seed execution function that orchestrates the entire seeding process.

```typescript
function runSeed(options: SeedOptions): Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `SeedOptions` | Configuration options for seed process |

**SeedOptions Interface:**

```typescript
interface SeedOptions {
  /** Whether to run required seeds (core system data) */
  required?: boolean;

  /** Whether to run example seeds (sample data) */
  example?: boolean;

  /** Whether to reset the database before seeding */
  reset?: boolean;

  /** Whether to run migrations before seeding */
  migrate?: boolean;

  /** Whether to rollback on error (incompatible with continueOnError) */
  rollbackOnError?: boolean;

  /** Whether to continue processing when encountering errors */
  continueOnError?: boolean;

  /** List of entities to exclude from seeding */
  exclude?: string[];
}
```

**Returns:** `Promise<void>` - Resolves when seeding is complete

**Throws:**

- `Error` when seeding fails and `continueOnError` is false
- `Error` when both `rollbackOnError` and `continueOnError` are true

**Example:**

```typescript
import { runSeed } from '@repo/seed';

// Basic usage
await runSeed({
  required: true,
  example: true,
  reset: true
});

// Advanced usage with error handling
await runSeed({
  required: true,
  example: true,
  reset: true,
  continueOnError: true,
  exclude: ['roles', 'permissions']
});
```

**Process Flow:**

1. Start execution timer and error tracking
2. Configure logger for detailed output
3. Initialize database connection
4. Create seed context
5. Reset database if requested
6. Run migrations if requested
7. Validate manifests
8. Load/create super admin user
9. Execute required seeds if requested
10. Execute example seeds if requested
11. Generate summary report
12. Close database connection

### runRequiredSeeds

Executes all required seeds in the correct dependency order.

```typescript
function runRequiredSeeds(context: SeedContext): Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | `SeedContext` | Seed execution context |

**Execution Order:**

1. Role Permissions
2. Amenities
3. Features
4. Attractions
5. Destinations

**Example:**

```typescript
import { runRequiredSeeds } from '@repo/seed/required';
import { createSeedContext } from '@repo/seed/utils';

const context = createSeedContext({
  continueOnError: false,
  resetDatabase: true
});

await runRequiredSeeds(context);
```

### runExampleSeeds

Executes all example seeds in the correct dependency order.

```typescript
function runExampleSeeds(context: SeedContext): Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | `SeedContext` | Seed execution context |

**Execution Order:**

1. Users
2. Tags
3. Post Sponsors
4. Event Organizers
5. Event Locations
6. Accommodations
7. Posts
8. Events
9. Accommodation Reviews
10. Destination Reviews
11. Bookmarks
12. Post Sponsorships
13. Tag Relations

**Example:**

```typescript
import { runExampleSeeds } from '@repo/seed/example';
import { createSeedContext } from '@repo/seed/utils';

const context = createSeedContext({
  continueOnError: true
});

await runExampleSeeds(context);
```

## Seed Factory

### createSeedFactory

Creates a reusable seed function with customizable callbacks.

```typescript
function createSeedFactory<T = unknown, R = unknown>(
  config: SeedFactoryConfig<T, R>
): (context: SeedContext) => Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `SeedFactoryConfig<T, R>` | Factory configuration |

**SeedFactoryConfig Interface:**

```typescript
interface SeedFactoryConfig<T = unknown, R = unknown> {
  // ============================================================================
  // Required Configuration
  // ============================================================================

  /** Name of the entity being seeded (e.g., 'Amenities', 'Users') */
  entityName: string;

  /** Service class to use for creating entities */
  serviceClass: ServiceConstructor;

  /** Folder path containing the JSON files (relative to package root) */
  folder: string;

  /** Array of JSON file names to process */
  files: string[];

  // ============================================================================
  // Optional Callbacks
  // ============================================================================

  /**
   * Normalizes data before entity creation
   * @param data - Raw JSON data
   * @returns Normalized data ready for service
   */
  normalizer?: (data: Record<string, unknown>) => R;

  /**
   * Gets display information for logging
   * @param item - Entity item
   * @param context - Seed context
   * @returns Formatted string for logs
   */
  getEntityInfo?: (item: unknown, context: SeedContext) => string;

  /**
   * Called before processing each item
   * Use for mapping foreign keys, setting actor, etc.
   * @param item - Entity item to process
   * @param context - Seed context
   */
  preProcess?: (item: T, context: SeedContext) => Promise<void>;

  /**
   * Called after successfully creating each item
   * @param result - Service result
   * @param item - Entity item that was created
   * @param context - Seed context
   */
  postProcess?: (result: unknown, item: T, context: SeedContext) => Promise<void>;

  /**
   * Custom error handler for individual items
   * @param item - Item that failed
   * @param index - Index in the file list
   * @param error - Error that occurred
   */
  errorHandler?: (item: unknown, index: number, error: Error) => void;

  /**
   * Builds relationships after entity creation
   * Use for many-to-many relations, nested entities, etc.
   * @param result - Service result with entity ID
   * @param item - Entity item with relationship IDs
   * @param context - Seed context with idMapper
   */
  relationBuilder?: (result: unknown, item: T, context: SeedContext) => Promise<void>;

  /**
   * Validates data before creation
   * @param data - Normalized data
   * @returns True if valid, false to skip
   */
  validateBeforeCreate?: (data: Record<string, unknown> | R) => boolean | Promise<boolean>;

  /**
   * Transforms result after creation
   * @param result - Service result
   * @returns Transformed result
   */
  transformResult?: (result: unknown) => unknown;

  // ============================================================================
  // Advanced Configuration
  // ============================================================================

  /** Whether to continue processing when encountering errors */
  continueOnError?: boolean;
}
```

**Returns:** `(context: SeedContext) => Promise<void>` - Seed function

**Example - Basic:**

```typescript
import { createSeedFactory } from '@repo/seed/utils';
import { AmenityService } from '@repo/service-core';

export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: ['wifi.json', 'parking.json', 'pool.json']
});
```

**Example - With Normalizer:**

```typescript
export const seedAmenities = createSeedFactory({
  entityName: 'Amenities',
  serviceClass: AmenityService,
  folder: 'src/data/amenity',
  files: ['wifi.json', 'parking.json'],

  normalizer: (data) => {
    // Remove metadata and auto-generated fields
    const { $schema, id, slug, ...cleanData } = data;
    return cleanData;
  },

  getEntityInfo: (item) => {
    const amenity = item as { name: string; type?: string };
    const typeInfo = amenity.type ? ` (${amenity.type})` : '';
    return `"${amenity.name}"${typeInfo}`;
  }
});
```

**Example - With Relationships:**

```typescript
export const seedAccommodations = createSeedFactory({
  entityName: 'Accommodations',
  serviceClass: AccommodationService,
  folder: 'src/data/accommodation',
  files: ['hotel-001.json', 'cabin-001.json'],

  normalizer: (data) => {
    const { $schema, id, slug, amenityIds, featureIds, ...cleanData } = data;
    return cleanData;
  },

  preProcess: async (item, context) => {
    // Map foreign key IDs
    const seedOwnerId = item.ownerId as string;
    const realOwnerId = context.idMapper.getMappedUserId(seedOwnerId);
    if (!realOwnerId) {
      throw new Error(`Owner not found: ${seedOwnerId}`);
    }
    item.ownerId = realOwnerId;
  },

  relationBuilder: async (result, item, context) => {
    const accommodationId = result.data?.id;
    if (!accommodationId) return;

    // Add amenities
    const amenityIds = context.idMapper.getValidRealIds(
      'amenities',
      item.amenityIds || []
    );

    for (const amenityId of amenityIds) {
      await amenityService.addAmenityToAccommodation({
        accommodationId,
        amenityId
      });
    }
  }
});
```

## Seed Context

### SeedContext Interface

Context object passed to all seed functions containing configuration and utilities.

```typescript
interface SeedContext {
  /**
   * Whether to continue processing when encountering errors
   * @default false
   */
  continueOnError: boolean;

  /**
   * Whether to validate manifests before seeding
   * @default true
   */
  validateManifests: boolean;

  /**
   * Whether to reset database before seeding
   * @default false
   */
  resetDatabase: boolean;

  /**
   * Whether to run migrations before seeding
   * @default false
   */
  runMigrations: boolean;

  /**
   * Entities to exclude from seeding
   * @default []
   */
  exclude: string[];

  /**
   * Actor to use for seeding operations
   * Set after super admin is created
   */
  actor?: Actor;

  /**
   * ID mapper for converting seed IDs to real database IDs
   * Used for handling relationships between entities
   */
  idMapper: IdMapper;

  /**
   * Current entity being processed (for error tracking)
   * @internal
   */
  currentEntity?: string;

  /**
   * Current file being processed (for error tracking)
   * @internal
   */
  currentFile?: string;
}
```

### createSeedContext

Creates a seed context with custom options.

```typescript
function createSeedContext(overrides?: Partial<SeedContext>): SeedContext
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `overrides` | `Partial<SeedContext>` | Custom context options |

**Returns:** `SeedContext` - Configured seed context

**Example:**

```typescript
import { createSeedContext } from '@repo/seed/utils';

const context = createSeedContext({
  continueOnError: true,
  resetDatabase: true,
  exclude: ['roles', 'permissions']
});
```

## ID Mapper

### IdMapper Class

Utility class for mapping seed IDs to real database IDs.

```typescript
class IdMapper {
  constructor(dontLoadSavedMappings?: boolean);

  // ============================================================================
  // Core Methods
  // ============================================================================

  /**
   * Sets a mapping from seed ID to real ID
   * @param entityType - Entity type (e.g., 'users', 'amenities')
   * @param seedId - Seed ID from JSON file
   * @param realId - Real UUID from database
   * @param name - Optional display name
   */
  setMapping(
    entityType: string,
    seedId: string,
    realId: string,
    name?: string
  ): void;

  /**
   * Gets real ID for a seed ID
   * @param entityType - Entity type
   * @param seedId - Seed ID to look up
   * @returns Real ID or undefined
   */
  getRealId(entityType: string, seedId: string): string | undefined;

  /**
   * Gets mapping data (ID and name)
   * @param entityType - Entity type
   * @param seedId - Seed ID to look up
   * @returns Mapping data or undefined
   */
  getMappingData(
    entityType: string,
    seedId: string
  ): { id: string; name?: string } | undefined;

  /**
   * Checks if mapping exists
   * @param entityType - Entity type
   * @param seedId - Seed ID to check
   * @returns True if mapping exists
   */
  hasMapping(entityType: string, seedId: string): boolean;

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Gets real IDs for array of seed IDs
   * @param entityType - Entity type
   * @param seedIds - Array of seed IDs
   * @returns Array of real IDs (may contain undefined)
   */
  getRealIds(
    entityType: string,
    seedIds: string[]
  ): (string | undefined)[];

  /**
   * Gets valid real IDs, filtering out undefined
   * @param entityType - Entity type
   * @param seedIds - Array of seed IDs
   * @returns Array of valid real IDs
   */
  getValidRealIds(entityType: string, seedIds: string[]): string[];

  /**
   * Validates all mappings exist
   * @param entityType - Entity type
   * @param seedIds - Array of seed IDs to validate
   * @returns Validation result with missing IDs
   */
  validateMappings(entityType: string, seedIds: string[]): {
    isValid: boolean;
    missingIds: string[];
    validIds: string[];
  };

  // ============================================================================
  // Display Names
  // ============================================================================

  /**
   * Gets display name for seed ID
   * @param entityType - Entity type
   * @param seedId - Seed ID
   * @returns Display name or seed ID
   */
  getDisplayName(entityType: string, seedId: string): string;

  /**
   * Gets display name using real ID (reverse lookup)
   * @param entityType - Entity type
   * @param realId - Real database ID
   * @returns Display name or real ID
   */
  getDisplayNameByRealId(entityType: string, realId: string): string;

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Gets mapping statistics for entity type
   * @param entityType - Entity type
   * @returns Statistics with count and examples
   */
  getMappingStats(entityType: string): {
    count: number;
    examples: string[];
  };

  /**
   * Gets statistics for all entity types
   * @returns Statistics for all entities
   */
  getAllMappingStats(): Record<string, { count: number; examples: string[] }>;

  /**
   * Prints mapping statistics to console
   * @param entityType - Entity type
   */
  printMappingStats(entityType: string): void;

  /**
   * Prints all mapping statistics
   */
  printAllMappingStats(): void;

  // ============================================================================
  // Management
  // ============================================================================

  /**
   * Clears all mappings for entity type
   * @param entityType - Entity type to clear
   */
  clearEntityType(entityType: string): void;

  /**
   * Clears all mappings
   */
  clearAll(): void;

  /**
   * Saves mappings to file
   */
  saveMappingsToFile(): void;

  /**
   * Gets file path where mappings are stored
   * @returns File path
   */
  getMappingsFilePath(): string;

  // ============================================================================
  // Specific Entity Getters
  // ============================================================================

  getMappedUserId(seedUserId: string): string | undefined;
  getMappedDestinationId(seedDestinationId: string): string | undefined;
  getMappedAccommodationId(seedAccommodationId: string): string | undefined;
  getMappedAttractionId(seedAttractionId: string): string | undefined;
  getMappedPostId(seedPostId: string): string | undefined;
  getMappedEventId(seedEventId: string): string | undefined;
  getMappedTagId(seedTagId: string): string | undefined;
  getMappedAmenityId(seedAmenityId: string): string | undefined;
  getMappedFeatureId(seedFeatureId: string): string | undefined;
  getMappedSponsorId(seedSponsorId: string): string | undefined;
  getMappedEventOrganizerId(seedOrganizerId: string): string | undefined;
  getMappedEventLocationId(seedLocationId: string): string | undefined;
}
```

**Example:**

```typescript
import { IdMapper } from '@repo/seed/utils';

const idMapper = new IdMapper();

// Store mapping
idMapper.setMapping('users', 'user-001', 'uuid-abc-123', 'John Doe');

// Retrieve mapping
const realId = idMapper.getMappedUserId('user-001');

// Batch retrieval
const realIds = idMapper.getValidRealIds('amenities', [
  'amenity-wifi',
  'amenity-parking',
  'amenity-pool'
]);

// Validation
const validation = idMapper.validateMappings('features', [
  'feature-kitchen',
  'feature-balcony',
  'feature-invalid'
]);

if (!validation.isValid) {
  console.error('Missing mappings:', validation.missingIds);
}

// Statistics
idMapper.printAllMappingStats();
```

## Utilities

### Normalizers

Pre-built data transformation functions.

#### createExcludingNormalizer

Creates normalizer that excludes specific fields.

```typescript
function createExcludingNormalizer(
  fieldsToExclude: string[]
): (data: Record<string, unknown>) => Record<string, unknown>
```

**Example:**

```typescript
import { createExcludingNormalizer } from '@repo/seed/utils';

const normalizer = createExcludingNormalizer(['$schema', 'id', 'slug']);

const normalized = normalizer({
  $schema: 'schema.json',
  id: 'seed-001',
  slug: 'my-slug',
  name: 'My Name',
  description: 'Description'
});
// Result: { name: 'My Name', description: 'Description' }
```

#### createIncludingNormalizer

Creates normalizer that includes only specific fields.

```typescript
function createIncludingNormalizer(
  fieldsToInclude: string[]
): (data: Record<string, unknown>) => Record<string, unknown>
```

#### createFieldMapper

Creates normalizer that maps field names.

```typescript
function createFieldMapper(
  fieldMap: Record<string, string>
): (data: Record<string, unknown>) => Record<string, unknown>
```

**Example:**

```typescript
const normalizer = createFieldMapper({
  fullName: 'name',
  emailAddress: 'email',
  phoneNumber: 'phone'
});

const normalized = normalizer({
  fullName: 'John Doe',
  emailAddress: 'john@example.com',
  phoneNumber: '555-1234'
});
// Result: { name: 'John Doe', email: 'john@example.com', phone: '555-1234' }
```

#### createDateTransformer

Creates normalizer that converts date strings to Date objects.

```typescript
function createDateTransformer(
  dateFields: string[]
): (data: Record<string, unknown>) => Record<string, unknown>
```

#### createCombinedNormalizer

Combines multiple normalizers into one.

```typescript
function createCombinedNormalizer(
  ...normalizers: Array<(data: Record<string, unknown>) => Record<string, unknown>>
): (data: Record<string, unknown>) => Record<string, unknown>
```

**Example:**

```typescript
const normalizer = createCombinedNormalizer(
  createExcludingNormalizer(['$schema', 'id', 'slug']),
  createDateTransformer(['createdAt', 'updatedAt']),
  (data) => ({
    ...data,
    status: data.status || 'active'
  })
);
```

### Relation Builders

#### createServiceRelationBuilder

Creates reusable relationship builder using service methods.

```typescript
function createServiceRelationBuilder<TService = unknown>(config: {
  /** Service class for relationship creation */
  serviceClass: ServiceConstructor<TService>;

  /** Service method name to call */
  methodName: string;

  /** Function to extract related IDs from item */
  extractIds: (item: unknown) => string[];

  /** Entity type for ID mapping (e.g., 'amenities') */
  entityType: string;

  /** Relation type for logging (e.g., 'amenities') */
  relationType: string;

  /** Function to build service method parameters */
  buildParams: (mainEntityId: string, relatedEntityId: string) => Record<string, unknown>;

  /** Function to get main entity display info */
  getMainEntityInfo?: (item: unknown) => string;

  /** Function to get related entity display info */
  getRelatedEntityInfo?: (seedId: string, context: SeedContext) => string;
}): (result: unknown, item: unknown, context: SeedContext) => Promise<void>
```

**Example:**

```typescript
import { createServiceRelationBuilder } from '@repo/seed/utils';
import { AmenityService } from '@repo/service-core';

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

// Use in seed factory
export const seedAccommodations = createSeedFactory({
  // ... other config
  relationBuilder: amenitiesBuilder
});
```

### Summary Tracker

Tracks seeding progress and generates summary reports.

```typescript
class SummaryTracker {
  /**
   * Starts execution timer
   */
  startTimer(): void;

  /**
   * Tracks a process step
   * @param step - Step name
   * @param status - 'success' | 'error' | 'warning'
   * @param message - Status message
   * @param details - Optional details
   */
  trackProcessStep(
    step: string,
    status: 'success' | 'error' | 'warning',
    message: string,
    details?: string
  ): void;

  /**
   * Tracks entity creation
   * @param entityName - Entity type
   * @param count - Number created
   */
  trackEntityCreated(entityName: string, count: number): void;

  /**
   * Tracks entity error
   * @param entityName - Entity type
   * @param fileName - File that failed
   * @param error - Error message
   */
  trackError(entityName: string, fileName: string, error: string): void;

  /**
   * Prints summary report to console
   */
  print(): void;

  /**
   * Gets execution time in seconds
   * @returns Execution time
   */
  getExecutionTime(): number;

  /**
   * Resets all tracking data
   */
  reset(): void;
}
```

**Usage:**

```typescript
import { summaryTracker } from '@repo/seed/utils';

summaryTracker.startTimer();
summaryTracker.trackEntityCreated('Users', 15);
summaryTracker.trackError('Accommodations', 'hotel-001.json', 'Missing owner ID');
summaryTracker.print();
```

### Error History

Tracks and reports errors during seeding.

```typescript
class ErrorHistory {
  /**
   * Starts error tracking
   */
  startTracking(): void;

  /**
   * Stops error tracking
   */
  stopTracking(): void;

  /**
   * Records an error
   * @param entityName - Entity type
   * @param fileName - File that failed
   * @param message - Error message
   * @param error - Original error
   */
  recordError(
    entityName: string,
    fileName: string,
    message: string,
    error?: unknown
  ): void;

  /**
   * Records a warning
   * @param entityName - Entity type
   * @param fileName - File with warning
   * @param message - Warning message
   */
  recordWarning(
    entityName: string,
    fileName: string,
    message: string
  ): void;

  /**
   * Prints error summary to console
   */
  printSummary(): void;

  /**
   * Gets all errors
   * @returns Array of errors
   */
  getErrors(): Array<{
    entityName: string;
    fileName: string;
    message: string;
    timestamp: Date;
  }>;

  /**
   * Gets all warnings
   * @returns Array of warnings
   */
  getWarnings(): Array<{
    entityName: string;
    fileName: string;
    message: string;
    timestamp: Date;
  }>;

  /**
   * Clears error history
   */
  clear(): void;
}
```

## CLI Interface

### CLI Entry Point

Located at `packages/seed/src/cli.ts`.

```bash
pnpm seed [options]
```

**Available Options:**

| Flag | Description | Type |
|------|-------------|------|
| `--required` | Run required seeds | boolean |
| `--example` | Run example seeds | boolean |
| `--reset` | Reset database before seeding | boolean |
| `--migrate` | Run migrations before seeding | boolean |
| `--rollbackOnError` | Rollback on error | boolean |
| `--continueOnError` | Continue on error | boolean |
| `--exclude=entity1,entity2` | Exclude entities from reset | string |

**Examples:**

```bash
# Run all seeds with reset
pnpm seed --reset --required --example

# Run required seeds only
pnpm seed --required

# Continue on errors
pnpm seed --required --continueOnError

# Exclude entities from reset
pnpm seed --reset --exclude=roles,permissions --required --example
```

## Types

### Actor

Authentication context for service operations.

```typescript
interface Actor {
  /** User ID */
  id: string;

  /** User role */
  role: RoleEnum;

  /** User permissions */
  permissions: PermissionEnum[];
}
```

### ServiceConstructor

Type for service class constructors.

```typescript
type ServiceConstructor<T = unknown> = new (ctx: any, ...args: any[]) => T;
```

### ServiceResult

Result from service operations.

```typescript
interface ServiceResult {
  /** Result data with entity ID */
  data?: {
    id?: string;
    [key: string]: unknown;
  };

  /** Error information */
  error?: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}
```

## Advanced Usage

### Custom Seed Runner

For cases where the factory pattern doesn't fit:

```typescript
import { seedRunner } from '@repo/seed/utils';

export async function seedCustomEntity(context: SeedContext) {
  const files = await loadJsonFiles('src/data/custom', manifest.custom);

  await seedRunner({
    entityName: 'Custom',
    items: files,
    context,
    async process(item, context) {
      // Custom processing logic
      const service = new CustomService({});
      const result = await service.create(context.actor!, item);

      // Map ID
      context.idMapper.setMapping(
        'custom',
        item.id,
        result.data.id,
        item.name
      );

      return result;
    }
  });
}
```

### Transaction Support

Using Drizzle transactions:

```typescript
import { db } from '@repo/db';

await db.transaction(async (tx) => {
  // All operations in this block are atomic
  for (const item of items) {
    await tx.insert(table).values(item);
  }
});
```

### Batch Operations

For large datasets:

```typescript
const BATCH_SIZE = 100;

for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  await db.insert(table).values(batch);
  logger.info(`Processed ${i + batch.length}/${items.length}`);
}
```

## See Also

- [Creating Seeds Guide](../guides/creating-seeds.md) - Complete guide to creating seeders
- [Dependencies Guide](../guides/dependencies.md) - Managing relationships
- [Testing Guide](../guides/testing.md) - Testing seed scripts
- [Examples](../examples/) - Working code examples

---

Last updated: 2024-11-05
