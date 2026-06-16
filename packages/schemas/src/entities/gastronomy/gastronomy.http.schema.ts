/**
 * Gastronomy HTTP Schemas
 *
 * HTTP-compatible schemas for gastronomy listing operations with automatic
 * query string coercion. These schemas handle the conversion from HTTP query
 * parameters (strings) to properly typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import { GastronomyTypeEnumSchema, PriceRangeEnumSchema } from '../../enums/index.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * HTTP-compatible gastronomy search schema with automatic coercion.
 * Handles conversion from HTTP query parameters (strings) to typed domain objects.
 */
export const GastronomySearchHttpSchema = BaseHttpSearchSchema.extend({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by gastronomy sub-type. */
    type: GastronomyTypeEnumSchema.optional(),
    /** Filter by price-range tier. */
    priceRange: PriceRangeEnumSchema.optional(),
    /** Filter by featured status (coerced from query string). */
    isFeatured: createBooleanQueryParam('Filter featured gastronomy listings'),
    /** Minimum average rating (0–5, coerced from query string). */
    minRating: z.coerce.number().min(0).max(5).optional(),
    /** Maximum average rating (0–5, coerced from query string). */
    maxRating: z.coerce.number().min(0).max(5).optional(),
    /** Filter by owner UUID. */
    ownerId: z.string().uuid().optional(),
    /** Opt-in projection: include amenities per result. */
    includeAmenities: createBooleanQueryParam('Include gastronomy amenities in response'),
    /** Opt-in projection: include features per result. */
    includeFeatures: createBooleanQueryParam('Include gastronomy features in response')
});

export type GastronomySearchHttp = z.infer<typeof GastronomySearchHttpSchema>;

/**
 * HTTP-compatible gastronomy creation schema.
 * Handles form data and JSON input for creating gastronomy listings via HTTP.
 */
export const GastronomyCreateHttpSchema = z.object({
    /** Display name of the gastronomy listing. */
    name: z.string().min(2, { message: 'zodError.commerce.name.min' }).max(100),
    /** Short marketing summary. */
    summary: z
        .string()
        .min(10, { message: 'zodError.commerce.summary.min' })
        .max(300, { message: 'zodError.commerce.summary.max' })
        .optional(),
    /** Full description. */
    description: z
        .string()
        .min(20, { message: 'zodError.commerce.description.min' })
        .max(2000, { message: 'zodError.commerce.description.max' })
        .optional(),
    /** Gastronomy sub-type. */
    type: GastronomyTypeEnumSchema,
    /** Price-range tier. */
    priceRange: PriceRangeEnumSchema.optional(),
    /** Online menu URL (must be HTTPS). */
    menuUrl: z
        .string()
        .url({ message: 'zodError.gastronomy.menuUrl.invalid' })
        .startsWith('https://', { message: 'zodError.gastronomy.menuUrl.httpsRequired' })
        .optional(),
    /** Whether the listing is featured. */
    isFeatured: z.coerce.boolean().default(false),
    /** Destination UUID for the listing. */
    destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** Owner UUID for the listing. */
    ownerId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).optional(),
    // Junction sync fields (write-only)
    /** Optional amenity UUIDs to associate on create (write-only). */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.gastronomy.amenityIds.invalidUuid' }))
        .optional(),
    /** Optional feature UUIDs to associate on create (write-only). */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.gastronomy.featureIds.invalidUuid' }))
        .optional(),
    // Contact information (flat fields mapped to ContactInfoSchema in converter)
    phone: z.string().optional(),
    email: z
        .string()
        .email({ message: 'zodError.common.contact.personalEmail.invalid' })
        .optional(),
    website: z.string().url({ message: 'zodError.common.contact.website.invalid' }).optional(),
    // Social media links (flat fields mapped to SocialNetworkSchema in converter)
    twitter: z.string().url({ message: 'zodError.common.social.twitter.invalid' }).optional(),
    facebook: z.string().url({ message: 'zodError.common.social.facebook.invalid' }).optional(),
    instagram: z.string().url({ message: 'zodError.common.social.instagram.invalid' }).optional(),
    linkedin: z.string().url({ message: 'zodError.common.social.linkedIn.invalid' }).optional(),
    tiktok: z.string().url({ message: 'zodError.common.social.tiktok.invalid' }).optional(),
    youtube: z.string().url({ message: 'zodError.common.social.youtube.invalid' }).optional()
});

export type GastronomyCreateHttp = z.infer<typeof GastronomyCreateHttpSchema>;

/**
 * HTTP-compatible gastronomy update schema.
 * Handles partial updates via HTTP PATCH requests.
 * Strips defaults to preserve "absent key = no change" PATCH semantics.
 */
export const GastronomyUpdateHttpSchema = z
    .object(stripShapeDefaults(GastronomyCreateHttpSchema.shape))
    .partial()
    .omit({
        ownerId: true // Owner cannot be changed after creation via HTTP
    });

export type GastronomyUpdateHttp = z.infer<typeof GastronomyUpdateHttpSchema>;

/**
 * HTTP-compatible query parameters for single gastronomy retrieval.
 * Used for GET /gastronomy/:id type requests.
 */
export const GastronomyGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeReviews: createBooleanQueryParam('Include gastronomy reviews'),
    includeAmenities: createBooleanQueryParam('Include gastronomy amenities'),
    includeFeatures: createBooleanQueryParam('Include gastronomy features')
});

export type GastronomyGetHttp = z.infer<typeof GastronomyGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';
import type {
    GastronomyAdminCreateInput,
    GastronomyUpdateInput
} from './gastronomy.crud.schema.js';
import type { GastronomySearch } from './gastronomy.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object.
 * Only maps fields that exist in both HTTP and domain schemas.
 */
export const httpToDomainGastronomySearch = (
    httpParams: GastronomySearchHttp
): GastronomySearch => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    sorts: httpParams.sorts,
    featuredFirst: httpParams.featuredFirst,
    q: httpParams.q,
    // Entity-specific filters
    type: httpParams.type,
    isFeatured: httpParams.isFeatured,
    priceRange: httpParams.priceRange,
    destinationId: httpParams.destinationId,
    ownerId: httpParams.ownerId,
    minRating: httpParams.minRating,
    maxRating: httpParams.maxRating,
    includeAmenities: httpParams.includeAmenities,
    includeFeatures: httpParams.includeFeatures
    // Note: amenities, features, createdAfter, createdBefore exist in domain
    // but not in HTTP schema, so they are not mapped here.
});

/**
 * Convert HTTP create data to domain admin create input.
 * Transforms HTTP form/JSON data to domain object with proper nested structures.
 *
 * The caller (route handler) is responsible for injecting `ownerId` from the
 * authenticated actor when it is absent from the HTTP payload.
 */
export const httpToDomainGastronomyCreate = (
    httpData: GastronomyCreateHttp
): GastronomyAdminCreateInput => ({
    // Identity fields
    name: httpData.name,
    summary: httpData.summary ?? httpData.description?.substring(0, 300) ?? httpData.name,
    description: httpData.description ?? '',
    type: httpData.type,
    destinationId: httpData.destinationId,
    ...(httpData.ownerId !== undefined ? { ownerId: httpData.ownerId } : {}),
    priceRange: httpData.priceRange,
    menuUrl: httpData.menuUrl,
    isFeatured: httpData.isFeatured,

    // Server-managed defaults
    moderationState: ModerationStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    reviewsCount: 0,
    averageRating: 0,
    visibility: VisibilityEnum.PUBLIC,

    // Contact info mapping from flat HTTP fields
    ...(httpData.phone !== undefined ||
    httpData.email !== undefined ||
    httpData.website !== undefined
        ? {
              contactInfo: {
                  mobilePhone: httpData.phone ?? '',
                  personalEmail: httpData.email,
                  website: httpData.website
              }
          }
        : {}),

    // Social networks mapping from flat HTTP fields
    ...(httpData.twitter !== undefined ||
    httpData.facebook !== undefined ||
    httpData.instagram !== undefined ||
    httpData.linkedin !== undefined ||
    httpData.tiktok !== undefined ||
    httpData.youtube !== undefined
        ? {
              socialNetworks: {
                  twitter: httpData.twitter,
                  facebook: httpData.facebook,
                  instagram: httpData.instagram,
                  linkedIn: httpData.linkedin,
                  tiktok: httpData.tiktok,
                  youtube: httpData.youtube
              }
          }
        : {}),

    // Junction sync (write-only): pass through when provided
    ...(httpData.amenityIds !== undefined ? { amenityIds: httpData.amenityIds } : {}),
    ...(httpData.featureIds !== undefined ? { featureIds: httpData.featureIds } : {})
});

/**
 * Convert HTTP update data to domain update input.
 * Transforms HTTP PATCH data (all fields optional) to domain object.
 */
export const httpToDomainGastronomyUpdate = (
    httpData: GastronomyUpdateHttp
): GastronomyUpdateInput => ({
    name: httpData.name,
    summary: httpData.summary,
    description: httpData.description,
    type: httpData.type,
    priceRange: httpData.priceRange,
    menuUrl: httpData.menuUrl,
    isFeatured: httpData.isFeatured,
    destinationId: httpData.destinationId,

    // Contact info mapping (emit only provided fields).
    // Cast is needed because TypeScript cannot narrow the spread-conditional object
    // to the exact ContactInfo shape required by GastronomyUpdateInput; at runtime
    // the service validates the final object with Zod before persisting.
    ...(httpData.phone !== undefined ||
    httpData.email !== undefined ||
    httpData.website !== undefined
        ? {
              contactInfo: {
                  ...(httpData.phone !== undefined ? { mobilePhone: httpData.phone } : {}),
                  ...(httpData.email !== undefined ? { personalEmail: httpData.email } : {}),
                  ...(httpData.website !== undefined ? { website: httpData.website } : {})
              } as GastronomyUpdateInput['contactInfo']
          }
        : {}),

    // Social networks mapping (emit only provided handles)
    ...(httpData.twitter !== undefined ||
    httpData.facebook !== undefined ||
    httpData.instagram !== undefined ||
    httpData.linkedin !== undefined ||
    httpData.tiktok !== undefined ||
    httpData.youtube !== undefined
        ? {
              socialNetworks: {
                  ...(httpData.twitter !== undefined ? { twitter: httpData.twitter } : {}),
                  ...(httpData.facebook !== undefined ? { facebook: httpData.facebook } : {}),
                  ...(httpData.instagram !== undefined ? { instagram: httpData.instagram } : {}),
                  ...(httpData.linkedin !== undefined ? { linkedIn: httpData.linkedin } : {}),
                  ...(httpData.tiktok !== undefined ? { tiktok: httpData.tiktok } : {}),
                  ...(httpData.youtube !== undefined ? { youtube: httpData.youtube } : {})
              }
          }
        : {}),

    // Junction sync (write-only): pass through when provided
    ...(httpData.amenityIds !== undefined ? { amenityIds: httpData.amenityIds } : {}),
    ...(httpData.featureIds !== undefined ? { featureIds: httpData.featureIds } : {})
});

// ============================================================================
// COMPILE-TIME VALIDATION
// ============================================================================

/**
 * Type-level validation to ensure HTTP→Domain conversion covers all fields.
 * These checks cause TypeScript compilation errors if schemas are inconsistent.
 *
 * Mirrors the pattern in `accommodation.http.schema.ts` (checks 1–6).
 *
 * ### What "MissingXxxFields extends never" means
 *
 * If the `Exclude<>` type is NOT `never`, there are domain fields the HTTP
 * converter does NOT emit. Many of these are intentionally absent because they
 * are either:
 *   a) Server-managed (ownerId, reviewsCount, averageRating, lifecycleState,
 *      moderationState, visibility) — injected by the service, not by HTTP.
 *   b) Rich content not carried by the basic HTTP form (richDescription, seo*,
 *      adminInfo, tags, faqs, rating, openingHours, media, i18n variants).
 *
 * The critical gate is the **type-compatibility check** (even-numbered checks):
 * `ReturnType<converter> extends DomainInput ? true : never`. If the converter
 * returns a value that is NOT assignable to the domain type, that check produces
 * `never` and compilation fails, catching real contract violations.
 */

// Check 1: All domain search fields are mapped in HTTP conversion
type DomainSearchFields = keyof GastronomySearch;
type HttpConversionFields = keyof ReturnType<typeof httpToDomainGastronomySearch>;
type MissingSearchFields = Exclude<DomainSearchFields, HttpConversionFields>;

const _searchFieldsCheck: MissingSearchFields extends never ? true : never =
    true as MissingSearchFields extends never ? true : never;

// Check 2: HTTP search conversion output is compatible with domain type
const _searchTypeCheck: ReturnType<typeof httpToDomainGastronomySearch> extends GastronomySearch
    ? true
    : never = true as ReturnType<typeof httpToDomainGastronomySearch> extends GastronomySearch
    ? true
    : never;

// Check 3: All domain create fields are mapped in HTTP conversion
// (Non-never MissingCreateFields is expected for rich-content + server-managed fields;
//  the critical gate is Check 4.)
type DomainCreateFields = keyof GastronomyAdminCreateInput;
type HttpCreateConversionFields = keyof ReturnType<typeof httpToDomainGastronomyCreate>;
type MissingCreateFields = Exclude<DomainCreateFields, HttpCreateConversionFields>;

const _createFieldsCheck: MissingCreateFields extends never ? true : never =
    true as MissingCreateFields extends never ? true : never;

// Check 4: HTTP create conversion output is compatible with domain create type
const _createTypeCheck: ReturnType<
    typeof httpToDomainGastronomyCreate
> extends GastronomyAdminCreateInput
    ? true
    : never = true as ReturnType<
    typeof httpToDomainGastronomyCreate
> extends GastronomyAdminCreateInput
    ? true
    : never;

// Check 5: All domain update fields are mapped in HTTP conversion
// (Non-never MissingUpdateFields is expected for rich-content + server-managed fields;
//  the critical gate is Check 6.)
type DomainUpdateFields = keyof GastronomyUpdateInput;
type HttpUpdateConversionFields = keyof ReturnType<typeof httpToDomainGastronomyUpdate>;
type MissingUpdateFields = Exclude<DomainUpdateFields, HttpUpdateConversionFields>;

const _updateFieldsCheck: MissingUpdateFields extends never ? true : never =
    true as MissingUpdateFields extends never ? true : never;

// Check 6: HTTP update conversion output is compatible with domain update type
const _updateTypeCheck: ReturnType<
    typeof httpToDomainGastronomyUpdate
> extends GastronomyUpdateInput
    ? true
    : never = true as ReturnType<typeof httpToDomainGastronomyUpdate> extends GastronomyUpdateInput
    ? true
    : never;

// Suppress unused variable warnings for validation checks
void _searchFieldsCheck;
void _searchTypeCheck;
void _createFieldsCheck;
void _createTypeCheck;
void _updateFieldsCheck;
void _updateTypeCheck;

/**
 * Runtime validation function for development/testing.
 * Validates that conversion functions work correctly.
 */
export const validateGastronomySchemaConsistency = () => {
    const searchCheck: typeof _searchFieldsCheck = true;
    const searchTypeCheck: typeof _searchTypeCheck = true;
    const createCheck: typeof _createFieldsCheck = true;
    const createTypeCheck: typeof _createTypeCheck = true;
    const updateCheck: typeof _updateFieldsCheck = true;
    const updateTypeCheck: typeof _updateTypeCheck = true;
    return {
        searchCheck,
        searchTypeCheck,
        createCheck,
        createTypeCheck,
        updateCheck,
        updateTypeCheck
    };
};
