---
spec-id: SPEC-006
title: Destination Hierarchy System
type: feature
complexity: high
status: draft
created: 2026-02-12T22:00:00.000Z
---

## SPEC-006: Destination Hierarchy System

## Part 1 - Functional Specification

### 1. Overview & Goals

#### Goal

Transform the current flat destination structure (11 cities in Entre Ríos, Argentina) into a hierarchical system that supports multi-level geographic organization, enabling phased deployment across different geographic scopes: local (Depto. Uruguay), provincial (Entre Ríos river cities), regional (Argentina regions), and international (Uruguay).

#### Motivation

- **Phased deployment**: Support gradual expansion from Concepción del Uruguay to regional and international coverage
- **SEO optimization**: Enable full hierarchical URLs (`/destinos/argentina/entre-rios/concepcion-del-uruguay`) from day 1
- **User navigation**: Allow users to browse destinations by geographic hierarchy (country > region > province > city)
- **Search efficiency**: Enable queries like "all cities in Litoral region" or "all destinations in Entre Ríos province"
- **Data organization**: Reflect real-world geographic relationships in the data model
- **Future scalability**: Support expansion to other countries (Uruguay) without schema changes

#### Success Metrics

- Hierarchical URLs work for all destinations (`/destinos/argentina/entre-rios/concepcion-del-uruguay/`)
- Search supports filtering by any hierarchy level (country, region, province, department, city)
- Breadcrumb navigation displays full path (Argentina > Litoral > Entre Ríos > Depto. Uruguay > Concepción del Uruguay)
- Migration from flat to hierarchical completes without data loss for 11 existing destinations
- New destination creation auto-computes path and level based on parent
- Query performance for hierarchy operations (getChildren, getDescendants, getAncestors) < 100ms for datasets up to 1000 destinations
- All existing destination tests pass with updated fixtures
- API routes support hierarchy filters without breaking existing clients

#### Target Users

- **Tourists**: Browse destinations by geographic area (province, region, country)
- **Content managers**: Create destinations within proper geographic hierarchy
- **SEO/Marketing**: Benefit from hierarchical URLs and structured data
- **Developers**: Query destinations by hierarchy efficiently
- **Administrators**: Manage geographic structure (add provinces, regions, departments)

### 2. User Stories & Acceptance Criteria

#### US-001: Browse Destinations by Province

**As a** tourist,
**I want** to see all destinations within a specific province,
**So that** I can explore accommodations in that geographic area.

**Acceptance Criteria:**

- **Given** a user on the destination search page
  **When** they select "Entre Ríos" as the province filter
  **Then** all destinations with parent chain including "Entre Ríos" province are displayed
  **And** the count shows the total number of destinations in that province

- **Given** a province with nested departments and cities
  **When** the user filters by province
  **Then** all descendants (departments and cities) are included in results
  **And** the hierarchy level is visually indicated (e.g., indentation or breadcrumb)

#### US-002: Browse Destinations by Region

**As a** tourist,
**I want** to see all destinations within a region (e.g., Litoral),
**So that** I can plan a multi-province trip.

**Acceptance Criteria:**

- **Given** a user browsing destinations
  **When** they select "Litoral" as the region filter
  **Then** all provinces in Litoral (Entre Ríos, Corrientes, Misiones, etc.) and their cities are shown
  **And** results are grouped by province for easier navigation

- **Given** a region with no destinations yet
  **When** the user selects that region
  **Then** an empty state message is shown with a suggestion to explore other regions
  **And** no error is thrown

#### US-003: Hierarchical Destination URL

**As a** user,
**I want** destination URLs to reflect the full geographic hierarchy,
**So that** I understand the location context and URLs are SEO-friendly.

**Acceptance Criteria:**

- **Given** a destination "Concepción del Uruguay"
  **When** a user navigates to its page
  **Then** the URL is `/destinos/argentina/entre-rios/concepcion-del-uruguay`
  **And** the breadcrumb navigation shows: Home > Destinos > Argentina > Litoral > Entre Ríos > Depto. Uruguay > Concepción del Uruguay

- **Given** a destination URL with the full path
  **When** a user shares or bookmarks it
  **Then** the URL remains stable and does not change over time
  **And** intermediate hierarchy nodes (province, region) are also accessible at `/destinos/argentina/entre-rios`

#### US-004: Breadcrumb Navigation

**As a** user,
**I want** to see a breadcrumb trail showing the destination's location,
**So that** I can navigate up the hierarchy easily.

**Acceptance Criteria:**

- **Given** a user on a city destination page (e.g., Concepción del Uruguay)
  **When** the page loads
  **Then** a breadcrumb displays: Argentina > Litoral > Entre Ríos > Depto. Uruguay > Concepción del Uruguay
  **And** each breadcrumb segment is clickable
  **And** clicking a segment navigates to that hierarchy level

- **Given** a user on a province page (e.g., Entre Ríos)
  **When** the page loads
  **Then** the breadcrumb shows: Argentina > Litoral > Entre Ríos
  **And** a list of child destinations (departments/cities) is displayed below

#### US-005: Create Destination with Parent Hierarchy

**As a** content manager,
**I want** to create a new destination by selecting its parent,
**So that** the hierarchy is automatically maintained.

**Acceptance Criteria:**

- **Given** a content manager in the admin dashboard
  **When** they create a new destination
  **Then** they must select a parent destination from a hierarchical dropdown (or autocomplete)
  **And** the system auto-computes the destination's `level` based on parent's level + 1
  **And** the system auto-computes the destination's `path` by appending slug to parent's path
  **And** the system auto-computes the destination's `pathIds` by appending ID to parent's pathIds

- **Given** a new city being created under "Depto. Uruguay"
  **When** the manager saves the destination
  **Then** the city's parent is set to "Depto. Uruguay"
  **And** the city's type is automatically set to CITY
  **And** the path is `/argentina/litoral/entre-rios/depto-uruguay/new-city`

- **Given** a top-level country destination (e.g., Argentina)
  **When** the manager creates it
  **Then** `parentDestinationId` is null
  **And** `level` is 0
  **And** `path` is `/argentina`
  **And** `destinationType` is COUNTRY

#### US-006: Update Destination Parent (Reparenting)

**As a** content manager,
**I want** to move a destination to a different parent,
**So that** I can correct mistakes or reorganize the hierarchy.

**Acceptance Criteria:**

- **Given** a destination with an incorrect parent
  **When** the manager updates its `parentDestinationId`
  **Then** the destination's `path`, `pathIds`, and `level` are recalculated
  **And** all descendants' paths and levels are recursively updated
  **And** the change is logged in the audit trail

- **Given** a destination being moved to a parent at the same level
  **When** the manager attempts to save
  **Then** a validation error is shown: "Parent must be at a higher hierarchy level"

- **Given** a destination being moved to one of its own descendants (cycle)
  **When** the manager attempts to save
  **Then** a validation error is shown: "Cannot set a descendant as parent (would create cycle)"

#### US-007: Search Destinations by Hierarchy Level

**As a** developer using the API,
**I want** to query destinations by hierarchy level,
**So that** I can fetch all provinces or all cities independently.

**Acceptance Criteria:**

- **Given** an API request to `/api/destinations?destinationType=CITY`
  **When** the request is processed
  **Then** only destinations with `destinationType = CITY` are returned
  **And** the response includes pagination metadata

- **Given** an API request to `/api/destinations?level=2`
  **When** the request is processed
  **Then** only destinations at level 2 (e.g., provinces) are returned
  **And** the count is accurate

#### US-008: Get All Children of a Destination

**As a** developer,
**I want** to fetch immediate children of a destination,
**So that** I can display a list of sub-destinations.

**Acceptance Criteria:**

- **Given** a destination ID for "Entre Ríos" province
  **When** I call `GET /api/destinations/{id}/children`
  **Then** only direct children (departments like "Depto. Uruguay") are returned
  **And** grandchildren (cities) are not included

- **Given** a leaf destination (city with no children)
  **When** I call `GET /api/destinations/{id}/children`
  **Then** an empty array is returned
  **And** the response code is 200

#### US-009: Get All Descendants of a Destination

**As a** developer,
**I want** to fetch all descendants of a destination (recursive),
**So that** I can display all sub-destinations at any level.

**Acceptance Criteria:**

- **Given** a destination ID for "Entre Ríos" province
  **When** I call `GET /api/destinations/{id}/descendants`
  **Then** all descendants (departments, cities, neighborhoods) are returned in a flat list
  **And** each item includes its `level` and `path` for sorting/filtering

- **Given** a destination with deeply nested children (5+ levels)
  **When** I call the descendants endpoint
  **Then** the query completes in < 100ms (using materialized path)
  **And** the result is limited to 1000 items by default with pagination support

#### US-010: Get Ancestor Path (Breadcrumb Data)

**As a** frontend developer,
**I want** to fetch the full ancestor chain for a destination,
**So that** I can render a breadcrumb trail.

**Acceptance Criteria:**

- **Given** a destination "Concepción del Uruguay"
  **When** I call `GET /api/destinations/{id}/ancestors`
  **Then** the ancestors are returned in order: [Argentina, Litoral, Entre Ríos, Depto. Uruguay]
  **And** each ancestor includes `id`, `slug`, `name`, `level`, `destinationType`

- **Given** a top-level destination (country)
  **When** I call the ancestors endpoint
  **Then** an empty array is returned
  **And** no error is thrown

#### US-011: Find Destination by Path

**As a** router/middleware,
**I want** to resolve a destination by its materialized path,
**So that** I can match URLs efficiently.

**Acceptance Criteria:**

- **Given** a URL path `/argentina/entre-rios/concepcion-del-uruguay`
  **When** I call `GET /api/destinations/by-path?path=/argentina/entre-rios/concepcion-del-uruguay`
  **Then** the destination "Concepción del Uruguay" is returned
  **And** the query uses an index on the `path` column for fast lookup

- **Given** a non-existent path
  **When** I call the endpoint
  **Then** a 404 response is returned with error: "Destination not found"

### 3. UX Considerations

#### Empty States

- **No destinations in a region**: Show message "No destinations yet in [Region Name]. Explore other regions or check back soon."
- **No children for a destination**: Hide the "Explore Sub-Destinations" section rather than showing empty list

#### Loading States

- **Hierarchy loading**: Show skeleton breadcrumb while fetching ancestors
- **Children loading**: Show loading spinner in the sub-destinations section

#### Error States

- **Invalid parent selection**: Show inline validation error "Cannot select this destination as parent"
- **Cycle detection**: Show clear error "A destination cannot be its own ancestor"
- **Missing parent**: Show warning "Parent destination not found. This may indicate data corruption."

#### Accessibility

- **Breadcrumb navigation**: Use `aria-label="Breadcrumb"` and `nav` element
- **Hierarchy level indicators**: Use semantic headings (h2 for provinces, h3 for cities)
- **Keyboard navigation**: Ensure all hierarchy filters are keyboard-accessible

### 4. Out of Scope

The following are explicitly excluded from this specification and may be addressed in future iterations:

- **Administrative boundaries sync**: No automatic sync with external geographic databases (OpenStreetMap, GeoNames)
- **Multi-lingual hierarchy names**: Hierarchy node names remain in Spanish only (future i18n for node names)
- **Custom hierarchy types**: Only predefined types (COUNTRY, REGION, PROVINCE, DEPARTMENT, CITY, TOWN, NEIGHBORHOOD)
- **Geographic coordinates inheritance**: Child destinations do not inherit coordinates from parents
- **Hierarchy-based permissions**: No permission model based on geographic hierarchy (e.g., "can manage all destinations in Entre Ríos")
- **Hierarchy visualization**: No tree view or org-chart style visualization in admin UI (may be added later)
- **Bulk hierarchy operations**: No batch reparenting or bulk hierarchy changes
- **Destination merging**: No functionality to merge two destinations and reconcile hierarchy
- **Historical hierarchy tracking**: No versioning of hierarchy changes over time

---

## Part 2 - Technical Specification

### 1. Database Schema Changes

#### 1.1 Destination Type Enum

**Location**: `packages/db/src/schemas/destination/destination.dbschema.ts`

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Destination Type Enum
 * Defines the hierarchy level of a destination in the geographic structure.
 */
export const DestinationTypePgEnum = pgEnum('destination_type', [
    'COUNTRY',       // Level 0 - e.g., Argentina, Uruguay
    'REGION',        // Level 1 - e.g., Litoral, Cuyo, Patagonia
    'PROVINCE',      // Level 2 - e.g., Entre Ríos, Buenos Aires
    'DEPARTMENT',    // Level 3 - e.g., Depto. Uruguay
    'CITY',          // Level 4 - e.g., Concepción del Uruguay
    'TOWN',          // Level 5 - e.g., Small towns/villages
    'NEIGHBORHOOD'   // Level 6 - e.g., Barrio within a city
]);
```

#### 1.2 Destinations Table Updates

**Location**: `packages/db/src/schemas/destination/destination.dbschema.ts`

Add the following columns to the `destinations` table:

```typescript
export const destinations = pgTable(
    'destinations',
    {
        // ... existing fields ...

        // Hierarchy fields
        parentDestinationId: uuid('parent_destination_id').references(() => destinations.id, {
            onDelete: 'restrict' // Prevent deletion of parent with children
        }),
        destinationType: DestinationTypePgEnum('destination_type').notNull(),
        level: integer('level').notNull().default(0), // 0 = country, 1 = region, etc.
        path: text('path').notNull().unique(), // e.g., "/argentina/entre-rios/concepcion-del-uruguay"
        pathIds: text('path_ids').notNull(), // e.g., "uuid1/uuid2/uuid3" for efficient ancestor queries

        // ... existing fields continue ...
    },
    (table) => ({
        // ... existing indexes ...

        // New indexes for hierarchy queries
        destinations_parentDestinationId_idx: index('destinations_parentDestinationId_idx').on(
            table.parentDestinationId
        ),
        destinations_destinationType_idx: index('destinations_destinationType_idx').on(
            table.destinationType
        ),
        destinations_level_idx: index('destinations_level_idx').on(table.level),
        destinations_path_idx: index('destinations_path_idx').on(table.path), // For path-based lookups
        destinations_pathIds_idx: index('destinations_pathIds_idx').on(table.pathIds) // For ancestor queries

        // ... existing indexes continue ...
    })
);
```

#### 1.3 Destinations Relations Updates

**Location**: `packages/db/src/schemas/destination/destination.dbschema.ts`

```typescript
export const destinationsRelations = relations(destinations, ({ one, many }) => ({
    // ... existing relations ...

    // Self-referencing hierarchy relations
    parent: one(destinations, {
        fields: [destinations.parentDestinationId],
        references: [destinations.id],
        relationName: 'destination_hierarchy'
    }),
    children: many(destinations, {
        relationName: 'destination_hierarchy'
    })

    // ... existing relations continue ...
}));
```

#### 1.4 Migration Script

**Location**: `packages/db/src/migrations/XXXX_add_destination_hierarchy.sql`

```sql
-- Add destination_type enum
CREATE TYPE destination_type AS ENUM (
    'COUNTRY',
    'REGION',
    'PROVINCE',
    'DEPARTMENT',
    'CITY',
    'TOWN',
    'NEIGHBORHOOD'
);

-- Add new columns to destinations table
ALTER TABLE destinations
ADD COLUMN parent_destination_id UUID REFERENCES destinations(id) ON DELETE RESTRICT,
ADD COLUMN destination_type destination_type NOT NULL DEFAULT 'CITY',
ADD COLUMN level INTEGER NOT NULL DEFAULT 4,
ADD COLUMN path TEXT NOT NULL DEFAULT '',
ADD COLUMN path_ids TEXT NOT NULL DEFAULT '';

-- Create indexes for hierarchy queries
CREATE INDEX destinations_parent_destination_id_idx ON destinations(parent_destination_id);
CREATE INDEX destinations_destination_type_idx ON destinations(destination_type);
CREATE INDEX destinations_level_idx ON destinations(level);
CREATE INDEX destinations_path_idx ON destinations(path);
CREATE INDEX destinations_path_ids_idx ON destinations(path_ids);

-- Add unique constraint on path
ALTER TABLE destinations ADD CONSTRAINT destinations_path_unique UNIQUE (path);

-- Remove default after initial migration
ALTER TABLE destinations ALTER COLUMN path DROP DEFAULT;
ALTER TABLE destinations ALTER COLUMN path_ids DROP DEFAULT;
```

### 2. Schema Changes (Zod Validation)

#### 2.1 Destination Type Enum

**Location**: `packages/schemas/src/enums/destination-type.enum.ts`

```typescript
import { z } from 'zod';

/**
 * Destination Type Enum
 * Maps to database destination_type enum
 */
export const DestinationTypeEnum = z.enum([
    'COUNTRY',
    'REGION',
    'PROVINCE',
    'DEPARTMENT',
    'CITY',
    'TOWN',
    'NEIGHBORHOOD'
]);

export type DestinationType = z.infer<typeof DestinationTypeEnum>;

/**
 * Mapping of destination types to expected hierarchy levels
 */
export const DESTINATION_TYPE_LEVELS: Record<DestinationType, number> = {
    COUNTRY: 0,
    REGION: 1,
    PROVINCE: 2,
    DEPARTMENT: 3,
    CITY: 4,
    TOWN: 5,
    NEIGHBORHOOD: 6
} as const;
```

#### 2.2 Base Destination Schema Updates

**Location**: `packages/schemas/src/entities/destination/destination.schema.ts`

```typescript
import { DestinationTypeEnum } from '../../enums/destination-type.enum.js';

/**
 * Destination Schema - Main Entity Schema (Updated with Hierarchy)
 */
export const DestinationSchema = z.object({
    // ... existing fields ...

    // Hierarchy fields
    parentDestinationId: z.string().uuid().nullable(),
    destinationType: DestinationTypeEnum,
    level: z.number().int().min(0).max(6),
    path: z.string().min(1).max(500).regex(/^\/[a-z0-9\-\/]+$/),
    pathIds: z.string().min(1).max(500),

    // ... existing fields continue ...
});
```

#### 2.3 Destination Create Schema Updates

**Location**: `packages/schemas/src/entities/destination/destination.crud.schema.ts`

```typescript
/**
 * Destination Create Input Schema
 * Excludes auto-computed fields: path, pathIds, level (computed from parent)
 */
export const DestinationCreateInputSchema = DestinationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    createdById: true,
    updatedById: true,
    deletedById: true,
    reviewsCount: true,
    averageRating: true,
    accommodationsCount: true,
    path: true,        // Auto-computed
    pathIds: true,     // Auto-computed
    level: true        // Auto-computed
}).extend({
    parentDestinationId: z.string().uuid().nullable().optional(), // Optional for top-level (country)
    destinationType: DestinationTypeEnum // Required
});

export type DestinationCreateInput = z.infer<typeof DestinationCreateInputSchema>;
```

#### 2.4 Destination Update Schema Updates

**Location**: `packages/schemas/src/entities/destination/destination.crud.schema.ts`

```typescript
/**
 * Destination Update Input Schema
 * Allows changing parent (triggers path/level recalculation)
 */
export const DestinationUpdateInputSchema = DestinationSchema.pick({
    slug: true,
    name: true,
    summary: true,
    description: true,
    location: true,
    media: true,
    isFeatured: true,
    visibility: true,
    lifecycleState: true,
    seo: true,
    parentDestinationId: true,  // Allow reparenting
    destinationType: true        // Allow type change (with validation)
}).partial();

export type DestinationUpdateInput = z.infer<typeof DestinationUpdateInputSchema>;
```

#### 2.5 Destination Search Schema Updates

**Location**: `packages/schemas/src/entities/destination/destination.search.schema.ts`

```typescript
/**
 * Destination Search Input Schema
 * Extended with hierarchy filters
 */
export const DestinationSearchInputSchema = z.object({
    // ... existing search fields ...

    // Hierarchy filters
    parentDestinationId: z.string().uuid().optional(),
    destinationType: DestinationTypeEnum.optional(),
    level: z.number().int().min(0).max(6).optional(),
    ancestorId: z.string().uuid().optional(), // Find all descendants of this ancestor

    // ... existing pagination ...
});

export type DestinationSearchInput = z.infer<typeof DestinationSearchInputSchema>;
```

#### 2.6 New Hierarchy-Specific Schemas

**Location**: `packages/schemas/src/entities/destination/destination.hierarchy.schema.ts`

```typescript
import { z } from 'zod';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { DestinationTypeEnum } from '../../enums/destination-type.enum.js';

/**
 * Get Children Input Schema
 */
export const GetDestinationChildrenInputSchema = z.object({
    destinationId: DestinationIdSchema
});

export type GetDestinationChildrenInput = z.infer<typeof GetDestinationChildrenInputSchema>;

/**
 * Get Descendants Input Schema
 */
export const GetDestinationDescendantsInputSchema = z.object({
    destinationId: DestinationIdSchema,
    maxDepth: z.number().int().min(1).max(10).optional(), // Limit recursion depth
    destinationType: DestinationTypeEnum.optional() // Filter by type
});

export type GetDestinationDescendantsInput = z.infer<typeof GetDestinationDescendantsInputSchema>;

/**
 * Get Ancestors Input Schema
 */
export const GetDestinationAncestorsInputSchema = z.object({
    destinationId: DestinationIdSchema
});

export type GetDestinationAncestorsInput = z.infer<typeof GetDestinationAncestorsInputSchema>;

/**
 * Get By Path Input Schema
 */
export const GetDestinationByPathInputSchema = z.object({
    path: z.string().min(1).max(500).regex(/^\/[a-z0-9\-\/]+$/)
});

export type GetDestinationByPathInput = z.infer<typeof GetDestinationByPathInputSchema>;

/**
 * Breadcrumb Item Schema
 */
export const BreadcrumbItemSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    level: z.number().int(),
    destinationType: DestinationTypeEnum,
    path: z.string()
});

export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;

/**
 * Get Breadcrumb Input Schema
 */
export const GetDestinationBreadcrumbInputSchema = z.object({
    destinationId: DestinationIdSchema
});

export type GetDestinationBreadcrumbInput = z.infer<typeof GetDestinationBreadcrumbInputSchema>;
```

### 3. Service Layer Changes

#### 3.1 Destination Service Updates

**Location**: `packages/service-core/src/services/destination/destination.service.ts`

Add the following methods to `DestinationService`:

```typescript
/**
 * Get immediate children of a destination
 * @param actor - The actor performing the action
 * @param params - Input containing destinationId
 * @returns ServiceOutput with array of child destinations
 */
public async getChildren(
    actor: Actor,
    params: GetDestinationChildrenInput
): Promise<ServiceOutput<{ children: Destination[] }>> {
    return this.runWithLoggingAndValidation({
        methodName: 'getChildren',
        input: { ...params, actor },
        schema: GetDestinationChildrenInputSchema,
        execute: async (validated, actor) => {
            const { destinationId } = validated;

            // Check permission to view parent
            const parent = await this.model.findById(destinationId);
            if (!parent) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Destination with id '${destinationId}' not found.`
                );
            }
            checkCanViewDestination(actor, parent);

            // Fetch children
            const { items } = await this.model.findAll({
                parentDestinationId: destinationId,
                deletedAt: null
            });

            return { children: items };
        }
    });
}

/**
 * Get all descendants of a destination (recursive)
 * Uses materialized path for efficient querying
 * @param actor - The actor performing the action
 * @param params - Input containing destinationId and optional filters
 * @returns ServiceOutput with array of descendant destinations
 */
public async getDescendants(
    actor: Actor,
    params: GetDestinationDescendantsInput
): Promise<ServiceOutput<{ descendants: Destination[] }>> {
    return this.runWithLoggingAndValidation({
        methodName: 'getDescendants',
        input: { ...params, actor },
        schema: GetDestinationDescendantsInputSchema,
        execute: async (validated, actor) => {
            const { destinationId, maxDepth, destinationType } = validated;

            // Check permission to view parent
            const parent = await this.model.findById(destinationId);
            if (!parent) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Destination with id '${destinationId}' not found.`
                );
            }
            checkCanViewDestination(actor, parent);

            // Build filter for descendants using pathIds
            const filters: Record<string, unknown> = {
                deletedAt: null
            };

            // Use materialized path for efficient querying
            // Find all destinations whose pathIds start with parent's pathIds
            const descendants = await this.model.findDescendants(destinationId, {
                maxDepth,
                destinationType
            });

            return { descendants };
        }
    });
}

/**
 * Get all ancestors of a destination (path to root)
 * @param actor - The actor performing the action
 * @param params - Input containing destinationId
 * @returns ServiceOutput with array of ancestor destinations (ordered from root to parent)
 */
public async getAncestors(
    actor: Actor,
    params: GetDestinationAncestorsInput
): Promise<ServiceOutput<{ ancestors: Destination[] }>> {
    return this.runWithLoggingAndValidation({
        methodName: 'getAncestors',
        input: { ...params, actor },
        schema: GetDestinationAncestorsInputSchema,
        execute: async (validated, actor) => {
            const { destinationId } = validated;

            const destination = await this.model.findById(destinationId);
            if (!destination) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Destination with id '${destinationId}' not found.`
                );
            }
            checkCanViewDestination(actor, destination);

            // Use pathIds to fetch all ancestors efficiently
            const ancestors = await this.model.findAncestors(destinationId);

            return { ancestors };
        }
    });
}

/**
 * Get breadcrumb trail for a destination
 * @param actor - The actor performing the action
 * @param params - Input containing destinationId
 * @returns ServiceOutput with array of breadcrumb items
 */
public async getBreadcrumb(
    actor: Actor,
    params: GetDestinationBreadcrumbInput
): Promise<ServiceOutput<{ breadcrumb: BreadcrumbItem[] }>> {
    return this.runWithLoggingAndValidation({
        methodName: 'getBreadcrumb',
        input: { ...params, actor },
        schema: GetDestinationBreadcrumbInputSchema,
        execute: async (validated, actor) => {
            const { destinationId } = validated;

            const destination = await this.model.findById(destinationId);
            if (!destination) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Destination with id '${destinationId}' not found.`
                );
            }
            checkCanViewDestination(actor, destination);

            // Get ancestors
            const ancestors = await this.model.findAncestors(destinationId);

            // Build breadcrumb items (ancestors + current destination)
            const breadcrumb: BreadcrumbItem[] = [
                ...ancestors.map(a => ({
                    id: a.id,
                    slug: a.slug,
                    name: a.name,
                    level: a.level,
                    destinationType: a.destinationType,
                    path: a.path
                })),
                {
                    id: destination.id,
                    slug: destination.slug,
                    name: destination.name,
                    level: destination.level,
                    destinationType: destination.destinationType,
                    path: destination.path
                }
            ];

            return { breadcrumb };
        }
    });
}

/**
 * Find destination by materialized path
 * @param actor - The actor performing the action
 * @param params - Input containing path
 * @returns ServiceOutput with destination
 */
public async getByPath(
    actor: Actor,
    params: GetDestinationByPathInput
): Promise<ServiceOutput<{ destination: Destination }>> {
    return this.runWithLoggingAndValidation({
        methodName: 'getByPath',
        input: { ...params, actor },
        schema: GetDestinationByPathInputSchema,
        execute: async (validated, actor) => {
            const { path } = validated;

            const destination = await this.model.findOne({ path, deletedAt: null });
            if (!destination) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    `Destination with path '${path}' not found.`
                );
            }
            checkCanViewDestination(actor, destination);

            return { destination };
        }
    });
}

/**
 * Before create hook: auto-compute hierarchy fields
 */
protected async _beforeCreate(
    data: DestinationCreateInput,
    actor: Actor
): Promise<Partial<Destination>> {
    const updates: Partial<Destination> = {};

    // Generate slug if not provided
    if (!data.slug) {
        updates.slug = await generateDestinationSlug(data.name);
    }

    // Compute hierarchy fields
    if (data.parentDestinationId) {
        const parent = await this.model.findById(data.parentDestinationId);
        if (!parent) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Parent destination not found'
            );
        }

        // Validate destination type matches expected level
        const expectedLevel = parent.level + 1;
        const typeLevel = DESTINATION_TYPE_LEVELS[data.destinationType];

        if (typeLevel !== expectedLevel) {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Destination type ${data.destinationType} expects level ${typeLevel}, but parent level is ${parent.level}`
            );
        }

        // Compute hierarchy fields
        updates.level = expectedLevel;
        updates.path = `${parent.path}/${data.slug || updates.slug}`;
        updates.pathIds = `${parent.pathIds}/${parent.id}`;
    } else {
        // Top-level destination (country)
        if (data.destinationType !== 'COUNTRY') {
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Destinations without a parent must be of type COUNTRY'
            );
        }
        updates.level = 0;
        updates.path = `/${data.slug || updates.slug}`;
        updates.pathIds = '';
    }

    return updates;
}

/**
 * Before update hook: recalculate hierarchy if parent changed
 */
protected async _beforeUpdate(
    id: string,
    data: DestinationUpdateInput,
    actor: Actor
): Promise<Partial<Destination>> {
    const updates: Partial<Destination> = {};

    // If parentDestinationId or slug changed, recalculate hierarchy
    if (data.parentDestinationId !== undefined || data.slug !== undefined) {
        const current = await this.model.findById(id);
        if (!current) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Destination with id '${id}' not found.`
            );
        }

        const newParentId = data.parentDestinationId ?? current.parentDestinationId;
        const newSlug = data.slug ?? current.slug;

        // Validate no cycles (destination cannot be its own ancestor)
        if (newParentId) {
            const isDescendant = await this.model.isDescendant(newParentId, id);
            if (isDescendant) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Cannot set a descendant as parent (would create cycle)'
                );
            }

            const parent = await this.model.findById(newParentId);
            if (!parent) {
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    'Parent destination not found'
                );
            }

            updates.level = parent.level + 1;
            updates.path = `${parent.path}/${newSlug}`;
            updates.pathIds = `${parent.pathIds}/${parent.id}`;
        } else {
            updates.level = 0;
            updates.path = `/${newSlug}`;
            updates.pathIds = '';
        }

        // If path changed, update all descendants recursively
        if (updates.path && updates.path !== current.path) {
            await this.model.updateDescendantPaths(id, current.path, updates.path);
        }
    }

    return updates;
}
```

#### 3.2 Helper Functions

**Location**: `packages/service-core/src/services/destination/destination.helpers.ts`

```typescript
import type { DestinationType } from '@repo/schemas';
import { DESTINATION_TYPE_LEVELS } from '@repo/schemas';

/**
 * Validates that a destination type matches the expected hierarchy level
 * @param destinationType - The destination type to validate
 * @param level - The hierarchy level
 * @returns True if valid, false otherwise
 */
export function validateDestinationTypeLevel(params: {
    destinationType: DestinationType;
    level: number;
}): boolean {
    const { destinationType, level } = params;
    return DESTINATION_TYPE_LEVELS[destinationType] === level;
}

/**
 * Gets the expected parent type for a given destination type
 * @param destinationType - The destination type
 * @returns The expected parent type, or null for top-level (COUNTRY)
 */
export function getExpectedParentType(params: {
    destinationType: DestinationType;
}): DestinationType | null {
    const { destinationType } = params;
    const level = DESTINATION_TYPE_LEVELS[destinationType];

    if (level === 0) return null; // COUNTRY has no parent

    const parentLevel = level - 1;
    return (Object.keys(DESTINATION_TYPE_LEVELS) as DestinationType[]).find(
        (type) => DESTINATION_TYPE_LEVELS[type] === parentLevel
    ) ?? null;
}
```

### 4. Model Layer Changes

#### 4.1 Destination Model Updates

**Location**: `packages/db/src/models/destination/destination.model.ts`

Add the following methods to `DestinationModel`:

```typescript
/**
 * Find all descendants of a destination using materialized path
 * @param destinationId - The parent destination ID
 * @param options - Optional filters (maxDepth, destinationType)
 * @returns Array of descendant destinations
 */
public async findDescendants(
    destinationId: string,
    options?: { maxDepth?: number; destinationType?: DestinationType }
): Promise<Destination[]> {
    const parent = await this.findById(destinationId);
    if (!parent) return [];

    const db = getDb();

    // Build query to find all destinations whose pathIds include the parent ID
    let query = db
        .select()
        .from(destinations)
        .where(
            and(
                sql`${destinations.pathIds} LIKE ${parent.pathIds + '/' + parent.id + '%'}`,
                eq(destinations.deletedAt, null)
            )
        );

    // Apply maxDepth filter
    if (options?.maxDepth) {
        query = query.where(lte(destinations.level, parent.level + options.maxDepth));
    }

    // Apply destinationType filter
    if (options?.destinationType) {
        query = query.where(eq(destinations.destinationType, options.destinationType));
    }

    const results = await query;
    return results as Destination[];
}

/**
 * Find all ancestors of a destination using pathIds
 * @param destinationId - The destination ID
 * @returns Array of ancestor destinations (ordered from root to immediate parent)
 */
public async findAncestors(destinationId: string): Promise<Destination[]> {
    const destination = await this.findById(destinationId);
    if (!destination || !destination.pathIds) return [];

    // Split pathIds to get all ancestor IDs
    const ancestorIds = destination.pathIds
        .split('/')
        .filter((id) => id.length > 0);

    if (ancestorIds.length === 0) return [];

    const db = getDb();

    // Fetch all ancestors in one query
    const ancestors = await db
        .select()
        .from(destinations)
        .where(
            and(
                sql`${destinations.id} = ANY(${ancestorIds})`,
                eq(destinations.deletedAt, null)
            )
        )
        .orderBy(asc(destinations.level));

    return ancestors as Destination[];
}

/**
 * Check if a destination is a descendant of another
 * Used for cycle detection during reparenting
 * @param potentialDescendantId - ID of the potential descendant
 * @param ancestorId - ID of the potential ancestor
 * @returns True if potentialDescendantId is a descendant of ancestorId
 */
public async isDescendant(
    potentialDescendantId: string,
    ancestorId: string
): Promise<boolean> {
    const descendant = await this.findById(potentialDescendantId);
    if (!descendant) return false;

    // Check if ancestorId is in the descendant's pathIds
    return descendant.pathIds.includes(ancestorId);
}

/**
 * Update paths of all descendants when a parent's path changes
 * Called after reparenting to maintain path integrity
 * @param parentId - ID of the parent whose children need path updates
 * @param oldPath - The old path of the parent
 * @param newPath - The new path of the parent
 */
public async updateDescendantPaths(
    parentId: string,
    oldPath: string,
    newPath: string
): Promise<void> {
    const descendants = await this.findDescendants(parentId);

    const db = getDb();

    // Update each descendant's path by replacing the old prefix with new prefix
    for (const descendant of descendants) {
        const updatedPath = descendant.path.replace(oldPath, newPath);
        await db
            .update(destinations)
            .set({ path: updatedPath })
            .where(eq(destinations.id, descendant.id));
    }
}
```

### 5. Seed Data Updates

#### 5.1 Hierarchy Node Seeds

**Location**: `packages/seed/src/data/destination/hierarchy/`

Create the following seed files for hierarchy nodes:

`000-country-argentina.json`:

```json
{
    "$schema": "../../../schemas/destination.schema.json",
    "id": "000-country-argentina",
    "slug": "argentina",
    "name": "Argentina",
    "summary": "República Argentina",
    "description": "Argentina es un país de América del Sur con una rica diversidad geográfica, cultural y turística.",
    "destinationType": "COUNTRY",
    "level": 0,
    "path": "/argentina",
    "pathIds": "",
    "parentDestinationId": null,
    "isFeatured": false,
    "moderationState": "APPROVED",
    "visibility": "PUBLIC",
    "lifecycleState": "ACTIVE",
    "location": {
        "country": "Argentina",
        "coordinates": {
            "lat": "-38.4161",
            "long": "-63.6167"
        }
    },
    "media": {
        "featuredImage": {
            "url": "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=800&h=600&fit=crop",
            "caption": "Argentina",
            "moderationState": "APPROVED"
        }
    },
    "seo": {
        "title": "Argentina - Destinos Turísticos",
        "description": "Explora Argentina y sus destinos turísticos.",
        "keywords": ["Argentina", "turismo", "destinos"]
    }
}
```

`001-region-litoral.json`:

```json
{
    "$schema": "../../../schemas/destination.schema.json",
    "id": "001-region-litoral",
    "slug": "litoral",
    "name": "Litoral",
    "summary": "Región del Litoral argentino",
    "description": "El Litoral argentino comprende las provincias de Entre Ríos, Corrientes, Misiones, Santa Fe y parte de Buenos Aires, caracterizada por sus ríos y humedales.",
    "destinationType": "REGION",
    "level": 1,
    "path": "/argentina/litoral",
    "pathIds": "/000-country-argentina",
    "parentDestinationId": "000-country-argentina",
    "isFeatured": false,
    "moderationState": "APPROVED",
    "visibility": "PUBLIC",
    "lifecycleState": "ACTIVE",
    "location": {
        "country": "Argentina",
        "coordinates": {
            "lat": "-31.4201",
            "long": "-58.0175"
        }
    },
    "media": {
        "featuredImage": {
            "url": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop",
            "caption": "Región del Litoral",
            "moderationState": "APPROVED"
        }
    },
    "seo": {
        "title": "Litoral Argentino - Región Turística",
        "description": "Descubre la región del Litoral argentino.",
        "keywords": ["Litoral", "Argentina", "turismo"]
    }
}
```

`002-province-entre-rios.json`:

```json
{
    "$schema": "../../../schemas/destination.schema.json",
    "id": "002-province-entre-rios",
    "slug": "entre-rios",
    "name": "Entre Ríos",
    "summary": "Provincia de Entre Ríos",
    "description": "Entre Ríos es una provincia argentina ubicada en la región del Litoral, conocida por sus termas, ríos y playas.",
    "destinationType": "PROVINCE",
    "level": 2,
    "path": "/argentina/litoral/entre-rios",
    "pathIds": "/000-country-argentina/001-region-litoral",
    "parentDestinationId": "001-region-litoral",
    "isFeatured": false,
    "moderationState": "APPROVED",
    "visibility": "PUBLIC",
    "lifecycleState": "ACTIVE",
    "location": {
        "state": "Entre Ríos",
        "country": "Argentina",
        "coordinates": {
            "lat": "-31.7333",
            "long": "-60.5297"
        }
    },
    "media": {
        "featuredImage": {
            "url": "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=600&fit=crop",
            "caption": "Entre Ríos",
            "moderationState": "APPROVED"
        }
    },
    "seo": {
        "title": "Entre Ríos - Provincia Argentina",
        "description": "Descubre Entre Ríos y sus destinos turísticos.",
        "keywords": ["Entre Ríos", "Argentina", "turismo"]
    }
}
```

`003-department-uruguay.json`:

```json
{
    "$schema": "../../../schemas/destination.schema.json",
    "id": "003-department-uruguay",
    "slug": "depto-uruguay",
    "name": "Departamento Uruguay",
    "summary": "Departamento Uruguay de Entre Ríos",
    "description": "El Departamento Uruguay es una división administrativa de la provincia de Entre Ríos, con Concepción del Uruguay como su ciudad cabecera.",
    "destinationType": "DEPARTMENT",
    "level": 3,
    "path": "/argentina/litoral/entre-rios/depto-uruguay",
    "pathIds": "/000-country-argentina/001-region-litoral/002-province-entre-rios",
    "parentDestinationId": "002-province-entre-rios",
    "isFeatured": false,
    "moderationState": "APPROVED",
    "visibility": "PUBLIC",
    "lifecycleState": "ACTIVE",
    "location": {
        "state": "Entre Ríos",
        "country": "Argentina",
        "coordinates": {
            "lat": "-32.4833",
            "long": "-58.2333"
        }
    },
    "media": {
        "featuredImage": {
            "url": "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=600&fit=crop",
            "caption": "Departamento Uruguay",
            "moderationState": "APPROVED"
        }
    },
    "seo": {
        "title": "Departamento Uruguay - Entre Ríos",
        "description": "Explora el Departamento Uruguay en Entre Ríos.",
        "keywords": ["Departamento Uruguay", "Entre Ríos", "Argentina"]
    }
}
```

#### 5.2 Update Existing City Seeds

Update all 11 existing city destination seeds to include hierarchy fields. Example for Concepción del Uruguay:

`011-destination-concepcion-del-uruguay.json` (updated):

```json
{
    "$schema": "../../schemas/destination.schema.json",
    "id": "011-destination-concepcion-del-uruguay",
    "slug": "concepcion-del-uruguay",
    "name": "Concepción del Uruguay",
    "summary": "Primera capital histórica de Entre Ríos con rica arquitectura y tradición cultural",
    "description": "Concepción del Uruguay es una histórica ciudad situada en el centro-oeste de Entre Ríos...",
    "destinationType": "CITY",
    "level": 4,
    "path": "/argentina/litoral/entre-rios/depto-uruguay/concepcion-del-uruguay",
    "pathIds": "/000-country-argentina/001-region-litoral/002-province-entre-rios/003-department-uruguay",
    "parentDestinationId": "003-department-uruguay",
    "isFeatured": false,
    "moderationState": "PENDING",
    "reviewsCount": 0,
    "averageRating": 0,
    "location": {
        "state": "Entre Ríos",
        "zipCode": "3260",
        "country": "Argentina",
        "city": "Concepción del Uruguay",
        "coordinates": {
            "lat": "-32.4833",
            "long": "-58.2333"
        }
    },
    // ... rest of existing fields ...
}
```

#### 5.3 Seed Script Updates

**Location**: `packages/seed/src/required/destinations.seed.ts`

```typescript
import { destinations } from '@repo/db/schemas';
import { getDb } from '@repo/db';
import { readJsonFile } from '../utils/file-reader';

/**
 * Seed destination hierarchy (countries, regions, provinces, departments, cities)
 * Must be seeded in order to respect parent-child relationships
 */
export async function seedDestinations() {
    console.log('Seeding destination hierarchy...');

    const db = getDb();

    // Seed in order: country > region > province > department > cities
    const hierarchyOrder = [
        'hierarchy/000-country-argentina.json',
        'hierarchy/001-region-litoral.json',
        'hierarchy/002-province-entre-rios.json',
        'hierarchy/003-department-uruguay.json',
        // Then seed existing cities (updated with hierarchy fields)
        '011-destination-concepcion-del-uruguay.json',
        '001-destination-chajari.json',
        '002-destination-colon.json',
        // ... rest of cities
    ];

    for (const file of hierarchyOrder) {
        const destination = await readJsonFile(`src/data/destination/${file}`);
        await db.insert(destinations).values(destination);
        console.log(`  ✓ Seeded ${destination.name} (${destination.destinationType})`);
    }

    console.log('✓ Destination hierarchy seeded');
}
```

### 6. API Routes

#### 6.1 New Hierarchy Endpoints

**Location**: `apps/api/src/routes/destination/hierarchy.routes.ts`

```typescript
import { createSimpleRoute } from '@repo/api-utils';
import { DestinationService } from '@repo/service-core';
import {
    GetDestinationChildrenInputSchema,
    GetDestinationDescendantsInputSchema,
    GetDestinationAncestorsInputSchema,
    GetDestinationBreadcrumbInputSchema,
    GetDestinationByPathInputSchema
} from '@repo/schemas';

/**
 * GET /api/destinations/:id/children
 * Get immediate children of a destination
 */
export const getDestinationChildren = createSimpleRoute({
    method: 'GET',
    path: '/destinations/:id/children',
    inputSchema: GetDestinationChildrenInputSchema,
    handler: async (c) => {
        const service = new DestinationService(c);
        const actor = c.get('actor');
        const { id } = c.req.param();

        const result = await service.getChildren(actor, { destinationId: id });

        if (!result.success) {
            return c.json({ error: result.error.message }, 400);
        }

        return c.json({ data: result.data.children });
    }
});

/**
 * GET /api/destinations/:id/descendants
 * Get all descendants of a destination
 */
export const getDestinationDescendants = createSimpleRoute({
    method: 'GET',
    path: '/destinations/:id/descendants',
    inputSchema: GetDestinationDescendantsInputSchema,
    handler: async (c) => {
        const service = new DestinationService(c);
        const actor = c.get('actor');
        const { id } = c.req.param();
        const query = c.req.query();

        const result = await service.getDescendants(actor, {
            destinationId: id,
            maxDepth: query.maxDepth ? Number(query.maxDepth) : undefined,
            destinationType: query.destinationType
        });

        if (!result.success) {
            return c.json({ error: result.error.message }, 400);
        }

        return c.json({ data: result.data.descendants });
    }
});

/**
 * GET /api/destinations/:id/ancestors
 * Get all ancestors of a destination
 */
export const getDestinationAncestors = createSimpleRoute({
    method: 'GET',
    path: '/destinations/:id/ancestors',
    inputSchema: GetDestinationAncestorsInputSchema,
    handler: async (c) => {
        const service = new DestinationService(c);
        const actor = c.get('actor');
        const { id } = c.req.param();

        const result = await service.getAncestors(actor, { destinationId: id });

        if (!result.success) {
            return c.json({ error: result.error.message }, 400);
        }

        return c.json({ data: result.data.ancestors });
    }
});

/**
 * GET /api/destinations/:id/breadcrumb
 * Get breadcrumb trail for a destination
 */
export const getDestinationBreadcrumb = createSimpleRoute({
    method: 'GET',
    path: '/destinations/:id/breadcrumb',
    inputSchema: GetDestinationBreadcrumbInputSchema,
    handler: async (c) => {
        const service = new DestinationService(c);
        const actor = c.get('actor');
        const { id } = c.req.param();

        const result = await service.getBreadcrumb(actor, { destinationId: id });

        if (!result.success) {
            return c.json({ error: result.error.message }, 400);
        }

        return c.json({ data: result.data.breadcrumb });
    }
});

/**
 * GET /api/destinations/by-path
 * Get destination by materialized path
 */
export const getDestinationByPath = createSimpleRoute({
    method: 'GET',
    path: '/destinations/by-path',
    inputSchema: GetDestinationByPathInputSchema,
    handler: async (c) => {
        const service = new DestinationService(c);
        const actor = c.get('actor');
        const { path } = c.req.query();

        const result = await service.getByPath(actor, { path });

        if (!result.success) {
            return c.json({ error: result.error.message }, 404);
        }

        return c.json({ data: result.data.destination });
    }
});
```

#### 6.2 Update Existing Search Endpoint

**Location**: `apps/api/src/routes/destination/destination.routes.ts`

Update the search endpoint to support hierarchy filters:

```typescript
/**
 * GET /api/destinations
 * Search destinations with hierarchy support
 */
export const searchDestinations = createListRoute({
    method: 'GET',
    path: '/destinations',
    inputSchema: DestinationSearchInputSchema,
    handler: async (c) => {
        const service = new DestinationService(c);
        const actor = c.get('actor');
        const query = c.req.query();

        // Parse query parameters including hierarchy filters
        const searchParams = {
            ...query,
            page: query.page ? Number(query.page) : 1,
            pageSize: query.pageSize ? Number(query.pageSize) : 10,
            level: query.level ? Number(query.level) : undefined,
            parentDestinationId: query.parentDestinationId,
            destinationType: query.destinationType,
            ancestorId: query.ancestorId
        };

        const result = await service.search(actor, searchParams);

        if (!result.success) {
            return c.json({ error: result.error.message }, 400);
        }

        return c.json({
            data: result.data.items,
            pagination: result.data.pagination
        });
    }
});
```

### 7. Frontend Updates

#### 7.1 URL Generation Utility

**Location**: `apps/web/src/utils/urls.ts`

Update to support hierarchical destination URLs:

```typescript
/**
 * Generate hierarchical destination URL
 * @param destination - Destination object or path
 * @returns Full destination URL
 */
export function getDestinationUrl(params: {
    destination?: { path: string };
    path?: string;
}): string {
    const { destination, path } = params;
    const destPath = destination?.path ?? path;

    if (!destPath) {
        throw new Error('Destination path is required');
    }

    // Ensure path starts with /destinos
    return `/destinos${destPath}`;
}

// Example usage:
// getDestinationUrl({ destination }) => "/destinos/argentina/entre-rios/concepcion-del-uruguay"
// getDestinationUrl({ path: "/argentina/entre-rios/colon" }) => "/destinos/argentina/entre-rios/colon"
```

#### 7.2 Breadcrumb Component

**Location**: `apps/web/src/components/shared/Breadcrumb.astro`

Update or create breadcrumb component to use hierarchy data:

```astro
---
import type { BreadcrumbItem } from '@repo/schemas';

interface Props {
    breadcrumb: BreadcrumbItem[];
}

const { breadcrumb } = Astro.props;
---

<nav aria-label="Breadcrumb" class="breadcrumb">
    <ol class="breadcrumb-list">
        <li class="breadcrumb-item">
            <a href="/">Inicio</a>
        </li>
        <li class="breadcrumb-item">
            <a href="/destinos">Destinos</a>
        </li>
        {breadcrumb.map((item, index) => (
            <li class="breadcrumb-item">
                {index === breadcrumb.length - 1 ? (
                    <span aria-current="page">{item.name}</span>
                ) : (
                    <a href={`/destinos${item.path}`}>{item.name}</a>
                )}
            </li>
        ))}
    </ol>
</nav>

<style>
    .breadcrumb-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .breadcrumb-item:not(:last-child)::after {
        content: '›';
        margin-left: 0.5rem;
        color: var(--color-text-muted);
    }

    .breadcrumb-item a {
        color: var(--color-primary);
        text-decoration: none;
    }

    .breadcrumb-item a:hover {
        text-decoration: underline;
    }

    .breadcrumb-item span[aria-current] {
        color: var(--color-text);
        font-weight: 500;
    }
</style>
```

#### 7.3 Dynamic Destination Route

**Location**: `apps/web/src/pages/destinos/[...path].astro`

Create a catch-all route for hierarchical destination URLs:

```astro
---
import { DestinationService } from '@repo/service-core';
import Breadcrumb from '@/components/shared/Breadcrumb.astro';
import Layout from '@/layout/Layout.astro';

const { path } = Astro.params;

if (!path) {
    return Astro.redirect('/destinos');
}

// Build the full path (remove /destinos prefix if present)
const fullPath = path.startsWith('/') ? path : `/${path}`;

// Fetch destination by path
const service = new DestinationService(Astro);
const actor = Astro.locals.actor;

const destinationResult = await service.getByPath(actor, { path: fullPath });

if (!destinationResult.success) {
    return Astro.redirect('/404');
}

const destination = destinationResult.data.destination;

// Fetch breadcrumb
const breadcrumbResult = await service.getBreadcrumb(actor, {
    destinationId: destination.id
});

const breadcrumb = breadcrumbResult.success ? breadcrumbResult.data.breadcrumb : [];

// Fetch children (for non-leaf destinations)
const childrenResult = await service.getChildren(actor, {
    destinationId: destination.id
});

const children = childrenResult.success ? childrenResult.data.children : [];
---

<Layout title={destination.seo?.title ?? destination.name}>
    <Breadcrumb breadcrumb={breadcrumb} />

    <main>
        <h1>{destination.name}</h1>
        <p class="summary">{destination.summary}</p>

        <div class="description">
            {destination.description}
        </div>

        {children.length > 0 && (
            <section class="sub-destinations">
                <h2>Explora Destinos en {destination.name}</h2>
                <ul>
                    {children.map((child) => (
                        <li>
                            <a href={`/destinos${child.path}`}>
                                {child.name}
                                <span class="type">({child.destinationType})</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </section>
        )}
    </main>
</Layout>
```

### 8. Testing Requirements

#### 8.1 Unit Tests

**Location**: `packages/service-core/test/services/destination/destination.hierarchy.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DestinationService } from '@repo/service-core';
import { createTestActor, createTestDestination } from '@repo/test-utils';

describe('DestinationService - Hierarchy', () => {
    let service: DestinationService;
    let actor: Actor;

    beforeEach(() => {
        service = new DestinationService({ userId: 'test-user' });
        actor = createTestActor({ role: 'ADMIN' });
    });

    describe('getChildren', () => {
        it('should return immediate children only', async () => {
            // Test implementation
        });

        it('should return empty array for leaf destinations', async () => {
            // Test implementation
        });
    });

    describe('getDescendants', () => {
        it('should return all descendants recursively', async () => {
            // Test implementation
        });

        it('should respect maxDepth filter', async () => {
            // Test implementation
        });

        it('should filter by destinationType', async () => {
            // Test implementation
        });
    });

    describe('getAncestors', () => {
        it('should return path to root in correct order', async () => {
            // Test implementation
        });

        it('should return empty array for top-level destination', async () => {
            // Test implementation
        });
    });

    describe('getBreadcrumb', () => {
        it('should include all ancestors plus current destination', async () => {
            // Test implementation
        });
    });

    describe('getByPath', () => {
        it('should resolve destination by materialized path', async () => {
            // Test implementation
        });

        it('should return 404 for non-existent path', async () => {
            // Test implementation
        });
    });

    describe('create with hierarchy', () => {
        it('should auto-compute path, pathIds, and level', async () => {
            // Test implementation
        });

        it('should validate destination type matches expected level', async () => {
            // Test implementation
        });

        it('should reject country with parent', async () => {
            // Test implementation
        });
    });

    describe('update with reparenting', () => {
        it('should recalculate path when parent changes', async () => {
            // Test implementation
        });

        it('should update all descendant paths recursively', async () => {
            // Test implementation
        });

        it('should prevent cycles (cannot set descendant as parent)', async () => {
            // Test implementation
        });
    });
});
```

#### 8.2 Integration Tests

**Location**: `apps/api/test/routes/destination/hierarchy.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { testClient } from '@repo/test-utils';

describe('GET /api/destinations/:id/children', () => {
    it('should return immediate children', async () => {
        // Test implementation
    });
});

describe('GET /api/destinations/:id/descendants', () => {
    it('should return all descendants', async () => {
        // Test implementation
    });
});

describe('GET /api/destinations/:id/ancestors', () => {
    it('should return ancestor path', async () => {
        // Test implementation
    });
});

describe('GET /api/destinations/by-path', () => {
    it('should resolve destination by path', async () => {
        // Test implementation
    });
});
```

### 9. Migration Strategy

#### Phase 1: Schema & Database (Week 1)

1. Create destination_type enum
2. Add hierarchy columns to destinations table
3. Create indexes for hierarchy queries
4. Run migration on development database
5. Verify no data loss for existing 11 destinations

#### Phase 2: Seed Data (Week 1)

1. Create hierarchy node seed files (country, region, province, department)
2. Update existing 11 city seed files with hierarchy fields
3. Update seed script to respect hierarchy order
4. Test seed script on fresh database
5. Verify all destinations load correctly

#### Phase 3: Backend (Week 2)

1. Update Zod schemas (enums, base, CRUD, search, hierarchy)
2. Add hierarchy methods to DestinationModel
3. Add hierarchy methods to DestinationService
4. Create new API routes for hierarchy operations
5. Update existing search route to support hierarchy filters
6. Write unit tests for all hierarchy methods
7. Write integration tests for all hierarchy routes

#### Phase 4: Frontend (Week 3)

1. Update URL generation utility
2. Create/update Breadcrumb component
3. Create dynamic destination route ([...path].astro)
4. Update search/filter UI to support hierarchy
5. Add hierarchy navigation (e.g., "Explore sub-destinations")
6. Test all URLs work correctly
7. Test breadcrumb navigation

#### Phase 5: Testing & QA (Week 3)

1. Run full test suite (unit + integration)
2. Manual testing of all hierarchy features
3. Performance testing (query speed for 1000+ destinations)
4. SEO validation (hierarchical URLs, structured data)
5. Accessibility testing (breadcrumbs, keyboard navigation)

#### Phase 6: Documentation (Week 4)

1. Update CLAUDE.md files in affected packages
2. Document hierarchy schema in database README
3. Add hierarchy examples to service documentation
4. Update API documentation with new endpoints
5. Create user guide for content managers

### 10. Performance Considerations

#### Materialized Path Benefits

- **O(1) lookup by path**: Direct index lookup instead of recursive queries
- **O(1) children query**: Simple WHERE parentDestinationId = X
- **O(n) descendants query**: Single query using LIKE on pathIds (index-optimized)
- **O(n) ancestors query**: Single query using IN on pathIds array

#### Index Strategy

1. `parent_destination_id`: For children queries
2. `path`: For URL-based lookups (UNIQUE)
3. `path_ids`: For descendant/ancestor queries
4. `destination_type` + `level`: For type/level filtering

#### Query Optimization

- Limit descendants queries to 1000 results by default
- Use pagination for large descendant sets
- Cache breadcrumb data at edge (CDN) for 1 hour
- Preload common hierarchy nodes (countries, regions) in application cache

### 11. Risks & Mitigation

#### Risk 1: Data Migration Errors

**Mitigation**:

- Extensive testing on development/staging databases before production
- Backup production database before migration
- Write rollback script in case of issues
- Validate all existing destinations after migration

#### Risk 2: Performance Degradation

**Mitigation**:

- Load test with 10,000+ destinations
- Monitor query performance in production
- Add caching layer for common queries
- Optimize indexes based on query patterns

#### Risk 3: Breaking Changes for API Clients

**Mitigation**:

- Make hierarchy fields optional in search (backward compatible)
- Version API routes if necessary
- Provide migration guide for API consumers
- Deprecate old routes gracefully (6-month notice)

#### Risk 4: SEO Impact from URL Changes

**Mitigation**:

- Implement 301 redirects from old URLs to new hierarchical URLs
- Update sitemap.xml with new URL structure
- Submit updated sitemap to search engines
- Monitor search rankings for 3 months post-launch

---

## Part 3 - Implementation Checklist

### Database Layer

- [ ] Create DestinationTypePgEnum
- [ ] Add hierarchy columns to destinations table
- [ ] Add indexes for hierarchy queries
- [ ] Generate and test migration script
- [ ] Run migration on development database
- [ ] Validate existing data after migration

### Schema Layer

- [ ] Create DestinationTypeEnum (Zod)
- [ ] Update DestinationSchema with hierarchy fields
- [ ] Update DestinationCreateInputSchema
- [ ] Update DestinationUpdateInputSchema
- [ ] Update DestinationSearchInputSchema
- [ ] Create hierarchy-specific schemas (GetChildren, GetDescendants, etc.)
- [ ] Write schema unit tests

### Model Layer

- [ ] Add findDescendants method to DestinationModel
- [ ] Add findAncestors method to DestinationModel
- [ ] Add isDescendant method to DestinationModel
- [ ] Add updateDescendantPaths method to DestinationModel
- [ ] Write model unit tests

### Service Layer

- [ ] Add getChildren method to DestinationService
- [ ] Add getDescendants method to DestinationService
- [ ] Add getAncestors method to DestinationService
- [ ] Add getBreadcrumb method to DestinationService
- [ ] Add getByPath method to DestinationService
- [ ] Update _beforeCreate hook for hierarchy auto-computation
- [ ] Update _beforeUpdate hook for reparenting logic
- [ ] Add helper functions (validateDestinationTypeLevel, getExpectedParentType)
- [ ] Write service unit tests
- [ ] Write service integration tests

### Seed Data

- [ ] Create hierarchy node seed files (country, region, province, department)
- [ ] Update existing 11 city seed files with hierarchy fields
- [ ] Update seed script to respect hierarchy order
- [ ] Test seed script on fresh database

### API Routes

- [ ] Create GET /api/destinations/:id/children
- [ ] Create GET /api/destinations/:id/descendants
- [ ] Create GET /api/destinations/:id/ancestors
- [ ] Create GET /api/destinations/:id/breadcrumb
- [ ] Create GET /api/destinations/by-path
- [ ] Update GET /api/destinations (search) to support hierarchy filters
- [ ] Write API integration tests

### Frontend

- [ ] Update getDestinationUrl utility for hierarchical URLs
- [ ] Create/update Breadcrumb component
- [ ] Create dynamic destination route ([...path].astro)
- [ ] Update destination search/filter UI
- [ ] Add hierarchy navigation UI
- [ ] Test all URLs and navigation flows

### Documentation

- [ ] Update packages/db/CLAUDE.md
- [ ] Update packages/schemas/CLAUDE.md
- [ ] Update packages/service-core/CLAUDE.md
- [ ] Update apps/api/CLAUDE.md
- [ ] Update apps/web/CLAUDE.md
- [ ] Create user guide for content managers

### Testing & QA

- [ ] All unit tests pass (>= 90% coverage)
- [ ] All integration tests pass
- [ ] Manual testing of all hierarchy features
- [ ] Performance testing (query speed)
- [ ] SEO validation (URLs, structured data)
- [ ] Accessibility testing

### Deployment

- [ ] Deploy schema migration to staging
- [ ] Test on staging environment
- [ ] Deploy to production
- [ ] Monitor performance and errors
- [ ] Set up 301 redirects for old URLs

---

## Part 4 - Success Criteria

This specification is considered complete when:

1. **Functional**:
   - All 11 user stories are implemented and pass acceptance criteria
   - Hierarchical URLs work for all destinations
   - Breadcrumb navigation displays correctly
   - Search supports all hierarchy filters

2. **Technical**:
   - All database migrations applied successfully
   - All unit tests pass (>= 90% coverage)
   - All integration tests pass
   - API routes respond in < 100ms for typical queries
   - No breaking changes to existing API consumers

3. **User Experience**:
   - Destination pages load in < 2 seconds
   - Breadcrumb navigation is accessible (WCAG AA)
   - Empty states and error states handled gracefully
   - Mobile-responsive hierarchy navigation

4. **Documentation**:
   - All CLAUDE.md files updated
   - API documentation includes hierarchy endpoints
   - User guide for content managers complete
   - Migration guide for API consumers published

5. **Deployment**:
   - Successfully deployed to production
   - No data loss or corruption
   - 301 redirects in place for old URLs
   - Monitoring shows no performance degradation
