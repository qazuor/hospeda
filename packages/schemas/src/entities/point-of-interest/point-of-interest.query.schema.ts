import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpQueryFields,
    HttpSortingSchema
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/index.js';
import { PointOfInterestDestinationRelationEnum } from '../../enums/point-of-interest-destination-relation.enum.js';
import { PointOfInterestDestinationRelationEnumSchema } from '../../enums/point-of-interest-destination-relation.schema.js';
import { PointOfInterestTypeEnumSchema } from '../../enums/point-of-interest-type.schema.js';
import { applyOpenApiMetadata, type OpenApiSchemaMetadata } from '../../utils/openapi.utils.js';
import { PointOfInterestSchema } from './point-of-interest.schema.js';

/**
 * Point Of Interest Query Schemas
 *
 * Standardized query schemas for point-of-interest operations following the
 * unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for points of interest
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Point-of-interest-specific filters that extend the base search functionality.
 * Adds a `type` filter on top of the attraction pattern (HOS-113 OQ-3).
 */
export const PointOfInterestFiltersSchema = z.object({
    // Basic filters
    slug: z.string().optional(),
    type: PointOfInterestTypeEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    isBuiltin: z.boolean().optional(),

    // Editorial-curation plain-column filters (HOS-138 columns, HOS-143 T-007
    // admin-search filter). Same passthrough shape as `isFeatured`/`isBuiltin`.
    hasOwnPage: z.boolean().optional(),
    verified: z.boolean().optional(),

    // Lifecycle state
    lifecycleState: LifecycleStatusEnumSchema.optional(),

    // Destination relation filter (M2M via join table, HOS-113 OQ-1)
    destinationId: z.string().uuid().optional(),

    // Category relation filters (M2M via r_poi_category join table, HOS-139
    // spec §6.5/§7.2 — additive, resolved through the join, not a plain
    // column, alongside (not replacing) the legacy `type` filter above).
    categoryId: z.string().uuid().optional(),
    categorySlug: z.string().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete point-of-interest search schema combining base search with
 * point-of-interest-specific filters. Flat pattern for HTTP compatibility.
 */
export const PointOfInterestSearchSchema = BaseSearchSchema.extend({
    slug: z.string().optional(),
    type: PointOfInterestTypeEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    isBuiltin: z.boolean().optional(),

    // Editorial-curation plain-column filters (HOS-138 columns, HOS-143 T-007
    // admin-search filter). Same passthrough shape as `isFeatured`/`isBuiltin`.
    hasOwnPage: z.boolean().optional(),
    verified: z.boolean().optional(),

    lifecycleState: LifecycleStatusEnumSchema.optional(),
    destinationId: z.string().uuid().optional(),

    // Category relation filters (M2M via r_poi_category join table, HOS-139
    // spec §6.5/§7.2 — additive, alongside the legacy `type` filter above).
    categoryId: z.string().uuid().optional(),
    categorySlug: z.string().optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Point-of-interest list item schema - contains essential fields for list display
 */
export const PointOfInterestListItemSchema = PointOfInterestSchema.pick({
    id: true,
    slug: true,
    // HOS-144: a POI list item carries its own display name — the admin list
    // column resolves it via `resolveI18nText(row.nameI18n)` and the admin's
    // list-item schema (`apps/admin/.../points-of-interest.schemas.ts`) extends
    // this one. `nameI18n` is `PartialI18nTextSchema.nullish()` on the base
    // entity, so it accepts the es-only POI catalog shape
    // (`{ es, en: null, pt: null }`, HOS-142) — only `es` is required.
    nameI18n: true,
    lat: true,
    long: true,
    type: true,
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Point-of-interest search result item - extends list item with search relevance score
 */
export const PointOfInterestSearchResultItemSchema = PointOfInterestListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

/**
 * Point of interest with destination count - used in special listing views
 */
export const PointOfInterestWithDestinationCountSchema = PointOfInterestListItemSchema.extend({
    destinationCount: z.number().int().min(0).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const PointOfInterestListResponseSchema = PaginationResultSchema(
    PointOfInterestListItemSchema
);

export const PointOfInterestSearchResponseSchema = PaginationResultSchema(
    PointOfInterestSearchResultItemSchema
);

export const PointOfInterestListWithCountsResponseSchema = PaginationResultSchema(
    PointOfInterestWithDestinationCountSchema
);

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for getting points of interest by destination.
 *
 * `relation` (HOS-140) is an optional 3-value filter — `'PRIMARY'` (default,
 * POIs physically in the destination), `'NEARBY'` (cross-referenced from a
 * different destination), or `'ALL'` (both). Omitting it preserves the
 * pre-HOS-140 default behavior (PRIMARY-only), a behavior-preserving no-op
 * for every row seeded before this spec shipped.
 */
export const PointsOfInterestByDestinationSchema = z.object({
    destinationId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    relation: z
        .union([PointOfInterestDestinationRelationEnumSchema, z.literal('ALL')])
        .default(PointOfInterestDestinationRelationEnum.PRIMARY)
});

/**
 * Schema for getting destinations by point of interest
 */
export const DestinationsByPointOfInterestSchema = z.object({
    pointOfInterestId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});

/**
 * Schema for bulk-resolving point-of-interest SLUGS (not a single UUID) to
 * the destinations that have them (HOS-113 §6.3/§6.2 — AI search resolution
 * and accommodation proximity-search entry point). Used by the AI
 * search-chat handler and the `resolvePoiToCoordinates` helper, which only
 * have NL-matched slugs from a curated allowlist, never a pre-resolved POI
 * UUID. Mirrors `DestinationIdsByAttractionSlugsSchema` exactly.
 */
export const DestinationIdsByPointOfInterestSlugsSchema = z.object({
    slugs: z.array(z.string()).min(1)
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Point-of-interest statistics schema
 */
export const PointOfInterestStatsSchema = z.object({
    total: z.number().int().min(0).default(0),
    featured: z.number().int().min(0).default(0),
    builtin: z.number().int().min(0).default(0),

    // Type distribution (closed enum, HOS-113 OQ-3)
    byType: z.record(z.string(), z.number().int().min(0)).optional(),

    // Destination distribution
    byDestination: z.record(z.string(), z.number().int().min(0)).optional(),

    // Lifecycle state distribution
    byLifecycleState: z.record(z.string(), z.number().int().min(0)).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PointOfInterestFilters = z.infer<typeof PointOfInterestFiltersSchema>;
export type PointOfInterestSearchInput = z.infer<typeof PointOfInterestSearchSchema>;
export type PointOfInterestListItem = z.infer<typeof PointOfInterestListItemSchema>;
export type PointOfInterestSearchResultItem = z.infer<typeof PointOfInterestSearchResultItemSchema>;
export type PointOfInterestWithDestinationCount = z.infer<
    typeof PointOfInterestWithDestinationCountSchema
>;
export type PointOfInterestListResponse = z.infer<typeof PointOfInterestListResponseSchema>;
export type PointOfInterestSearchResponse = z.infer<typeof PointOfInterestSearchResponseSchema>;
export type PointOfInterestListWithCountsResponse = z.infer<
    typeof PointOfInterestListWithCountsResponseSchema
>;
export type PointsOfInterestByDestinationInput = z.infer<
    typeof PointsOfInterestByDestinationSchema
>;
export type DestinationsByPointOfInterestInput = z.infer<
    typeof DestinationsByPointOfInterestSchema
>;
export type DestinationIdsByPointOfInterestSlugsInput = z.infer<
    typeof DestinationIdsByPointOfInterestSlugsSchema
>;
export type PointOfInterestStats = z.infer<typeof PointOfInterestStatsSchema>;

// Compatibility aliases for existing code (mirrors attraction.query.schema.ts)
export type PointOfInterestListInput = PointOfInterestSearchInput;
export type PointOfInterestListOutput = PointOfInterestListResponse;
export type PointOfInterestSearchOutput = PointOfInterestSearchResponse;
export type PointOfInterestListWithCountsOutput = PointOfInterestListWithCountsResponse;
export type PointsOfInterestByDestinationOutput = PointOfInterestListResponse;
export type DestinationsByPointOfInterestOutput = PointOfInterestListResponse;

// Additional compatibility schemas
const PointOfInterestCountSchema = z.object({ count: z.number().int().min(0) });
const PointOfInterestStatsWrapperSchema = z.object({
    stats: PointOfInterestStatsSchema.nullable()
});
export type PointOfInterestCountOutput = z.infer<typeof PointOfInterestCountSchema>;
export type PointOfInterestStatsOutput = z.infer<typeof PointOfInterestStatsWrapperSchema>;

// Legacy compatibility exports
export const PointOfInterestListInputSchema = PointOfInterestSearchSchema;
export const PointOfInterestListOutputSchema = PointOfInterestListResponseSchema;
export const PointOfInterestSearchInputSchema = PointOfInterestSearchSchema;
export const PointOfInterestSearchOutputSchema = PointOfInterestSearchResponseSchema;
export const PointOfInterestListWithCountsOutputSchema =
    PointOfInterestListWithCountsResponseSchema;
export const PointsOfInterestByDestinationInputSchema = PointsOfInterestByDestinationSchema;
export const PointsOfInterestByDestinationOutputSchema = PointOfInterestListResponseSchema;
export const DestinationsByPointOfInterestInputSchema = DestinationsByPointOfInterestSchema;
export const DestinationsByPointOfInterestOutputSchema = PointOfInterestListResponseSchema;
export const DestinationIdsByPointOfInterestSlugsInputSchema =
    DestinationIdsByPointOfInterestSlugsSchema;
export const DestinationIdsByPointOfInterestSlugsOutputSchema = z.object({
    destinationIds: z.array(z.string().uuid())
});
export type DestinationIdsByPointOfInterestSlugsOutput = z.infer<
    typeof DestinationIdsByPointOfInterestSlugsOutputSchema
>;
export const PointOfInterestCountOutputSchema = z.object({ count: z.number().int().min(0) });

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible point-of-interest search schema with query string coercion
 */
export const HttpPointOfInterestSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend(
    {
        // Search
        q: z.string().optional(),

        // Basic filters
        slug: z.string().optional(),
        type: PointOfInterestTypeEnumSchema.optional(),
        isFeatured: HttpQueryFields.isFeatured(),
        isBuiltin: HttpQueryFields.isBuiltin(),

        // Lifecycle state
        lifecycleState: LifecycleStatusEnumSchema.optional(),

        // Date filters with coercion
        createdAfter: HttpQueryFields.createdAfter(),
        createdBefore: HttpQueryFields.createdBefore(),

        // Destination relation filter
        destinationId: z.string().uuid().optional(),

        // Content filters with coercion
        hasDescription: HttpQueryFields.hasDescription()
    }
);

export type HttpPointOfInterestSearch = z.infer<typeof HttpPointOfInterestSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for point-of-interest search schema
 */
export const POINT_OF_INTEREST_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'PointOfInterestSearch',
    description: 'Schema for searching and filtering points of interest with comprehensive options',
    title: 'Point Of Interest Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'displayWeight',
        sortOrder: 'asc',
        q: 'playa',
        type: 'BEACH',
        isFeatured: true,
        destinationId: '123e4567-e89b-12d3-a456-426614174000'
    },
    fields: {
        page: {
            description: 'Page number (1-based)',
            example: 1,
            minimum: 1
        },
        pageSize: {
            description: 'Number of items per page',
            example: 20,
            minimum: 1,
            maximum: 100
        },
        q: {
            description: 'Search query (searches slug, description)',
            example: 'playa',
            maxLength: 100
        },
        type: {
            description: 'Filter by point-of-interest type',
            example: 'BEACH'
        },
        isFeatured: {
            description: 'Filter featured points of interest',
            example: true
        },
        destinationId: {
            description: 'Filter by destination UUID',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        }
    },
    tags: ['points-of-interest', 'search']
};

/**
 * Point-of-interest search schema with OpenAPI metadata applied
 */
export const PointOfInterestSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpPointOfInterestSearchSchema,
    POINT_OF_INTEREST_SEARCH_METADATA
);
export const PointOfInterestStatsOutputSchema = z.object({
    stats: PointOfInterestStatsSchema.nullable()
});
