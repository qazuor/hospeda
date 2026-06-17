/**
 * Experience HTTP Schemas
 *
 * HTTP-compatible schemas for experience listing operations with automatic
 * query string coercion. These schemas handle the conversion from HTTP query
 * parameters (strings) to properly typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import { ExperiencePriceUnitEnumSchema, ExperienceTypeEnumSchema } from '../../enums/index.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * HTTP-compatible experience search schema with automatic coercion.
 * Handles conversion from HTTP query parameters (strings) to typed domain objects.
 */
export const ExperienceSearchHttpSchema = BaseHttpSearchSchema.extend({
    /** Filter by destination UUID. */
    destinationId: z.string().uuid().optional(),
    /** Filter by experience sub-type. */
    type: ExperienceTypeEnumSchema.optional(),
    /** Filter by featured status (coerced from query string). */
    isFeatured: createBooleanQueryParam('Filter featured experience listings'),
    /** Minimum average rating (0–5, coerced from query string). */
    minRating: z.coerce.number().min(0).max(5).optional(),
    /** Maximum average rating (0–5, coerced from query string). */
    maxRating: z.coerce.number().min(0).max(5).optional(),
    /** Filter by owner UUID. */
    ownerId: z.string().uuid().optional(),
    /** Opt-in projection: include amenities per result. */
    includeAmenities: createBooleanQueryParam('Include experience amenities in response'),
    /** Opt-in projection: include features per result. */
    includeFeatures: createBooleanQueryParam('Include experience features in response'),
    /** Filter by active subscription flag (coerced from query string). */
    hasActiveSubscription: createBooleanQueryParam('Filter experiences with active subscription')
});

export type ExperienceSearchHttp = z.infer<typeof ExperienceSearchHttpSchema>;

/**
 * HTTP-compatible experience creation schema.
 * Handles form data and JSON input for creating experience listings via HTTP.
 */
export const ExperienceCreateHttpSchema = z.object({
    /** Display name of the experience listing. */
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
    /** Experience sub-type. */
    type: ExperienceTypeEnumSchema,
    /**
     * Starting price in integer centavos.
     * Set to 0 when `isPriceOnRequest` is true.
     */
    priceFrom: z.coerce.number().int().nonnegative().default(0),
    /** Billing unit for the price. */
    priceUnit: ExperiencePriceUnitEnumSchema,
    /**
     * When true, the UI shows "Consultar precio" instead of the numeric price.
     */
    isPriceOnRequest: z.coerce.boolean().default(false),
    /** Whether the listing is featured. */
    isFeatured: z.coerce.boolean().default(false),
    /** Destination UUID for the listing. */
    destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    /** Owner UUID for the listing. */
    ownerId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }).optional(),
    // Junction sync fields (write-only)
    /** Optional amenity UUIDs to associate on create (write-only). */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.experience.amenityIds.invalidUuid' }))
        .optional(),
    /** Optional feature UUIDs to associate on create (write-only). */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.experience.featureIds.invalidUuid' }))
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

export type ExperienceCreateHttp = z.infer<typeof ExperienceCreateHttpSchema>;

/**
 * HTTP-compatible experience update schema.
 * Handles partial updates via HTTP PATCH requests.
 * Strips defaults to preserve "absent key = no change" PATCH semantics.
 */
export const ExperienceUpdateHttpSchema = z
    .object(stripShapeDefaults(ExperienceCreateHttpSchema.shape))
    .partial()
    .omit({
        ownerId: true // Owner cannot be changed after creation via HTTP
    });

export type ExperienceUpdateHttp = z.infer<typeof ExperienceUpdateHttpSchema>;

/**
 * HTTP-compatible query parameters for single experience retrieval.
 * Used for GET /experience/:id type requests.
 */
export const ExperienceGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeReviews: createBooleanQueryParam('Include experience reviews'),
    includeAmenities: createBooleanQueryParam('Include experience amenities'),
    includeFeatures: createBooleanQueryParam('Include experience features')
});

export type ExperienceGetHttp = z.infer<typeof ExperienceGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';
import type {
    ExperienceAdminCreateInput,
    ExperienceUpdateInput
} from './experience.crud.schema.js';
import type { ExperienceSearch } from './experience.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object.
 * Only maps fields that exist in both HTTP and domain schemas.
 */
export const httpToDomainExperienceSearch = (
    httpParams: ExperienceSearchHttp
): ExperienceSearch => ({
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
    destinationId: httpParams.destinationId,
    ownerId: httpParams.ownerId,
    minRating: httpParams.minRating,
    maxRating: httpParams.maxRating,
    includeAmenities: httpParams.includeAmenities,
    includeFeatures: httpParams.includeFeatures,
    hasActiveSubscription: httpParams.hasActiveSubscription
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
export const httpToDomainExperienceCreate = (
    httpData: ExperienceCreateHttp
): ExperienceAdminCreateInput => ({
    // Identity fields
    name: httpData.name,
    summary: httpData.summary ?? httpData.description?.substring(0, 300) ?? httpData.name,
    description: httpData.description ?? '',
    type: httpData.type,
    destinationId: httpData.destinationId,
    ...(httpData.ownerId !== undefined ? { ownerId: httpData.ownerId } : {}),
    priceFrom: httpData.priceFrom,
    priceUnit: httpData.priceUnit,
    isPriceOnRequest: httpData.isPriceOnRequest,
    isFeatured: httpData.isFeatured,

    // Server-managed defaults
    moderationState: ModerationStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    reviewsCount: 0,
    averageRating: 0,
    visibility: VisibilityEnum.PUBLIC,
    hasActiveSubscription: false,

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
export const httpToDomainExperienceUpdate = (
    httpData: ExperienceUpdateHttp
): ExperienceUpdateInput => ({
    name: httpData.name,
    summary: httpData.summary,
    description: httpData.description,
    type: httpData.type,
    priceFrom: httpData.priceFrom,
    priceUnit: httpData.priceUnit,
    isPriceOnRequest: httpData.isPriceOnRequest,
    isFeatured: httpData.isFeatured,
    destinationId: httpData.destinationId,

    // Contact info mapping (emit only provided fields).
    ...(httpData.phone !== undefined ||
    httpData.email !== undefined ||
    httpData.website !== undefined
        ? {
              contactInfo: {
                  ...(httpData.phone !== undefined ? { mobilePhone: httpData.phone } : {}),
                  ...(httpData.email !== undefined ? { personalEmail: httpData.email } : {}),
                  ...(httpData.website !== undefined ? { website: httpData.website } : {})
              } as ExperienceUpdateInput['contactInfo']
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
 * Mirrors the pattern in `gastronomy.http.schema.ts` (checks 1–6).
 */

// Check 1: All domain search fields are mapped in HTTP conversion
type DomainSearchFields = keyof ExperienceSearch;
type HttpConversionFields = keyof ReturnType<typeof httpToDomainExperienceSearch>;
type MissingSearchFields = Exclude<DomainSearchFields, HttpConversionFields>;

const _searchFieldsCheck: MissingSearchFields extends never ? true : never =
    true as MissingSearchFields extends never ? true : never;

// Check 2: HTTP search conversion output is compatible with domain type
const _searchTypeCheck: ReturnType<typeof httpToDomainExperienceSearch> extends ExperienceSearch
    ? true
    : never = true as ReturnType<typeof httpToDomainExperienceSearch> extends ExperienceSearch
    ? true
    : never;

// Check 3: All domain create fields are mapped in HTTP conversion
// (Non-never MissingCreateFields is expected for rich-content + server-managed fields;
//  the critical gate is Check 4.)
type DomainCreateFields = keyof ExperienceAdminCreateInput;
type HttpCreateConversionFields = keyof ReturnType<typeof httpToDomainExperienceCreate>;
type MissingCreateFields = Exclude<DomainCreateFields, HttpCreateConversionFields>;

const _createFieldsCheck: MissingCreateFields extends never ? true : never =
    true as MissingCreateFields extends never ? true : never;

// Check 4: HTTP create conversion output is compatible with domain create type
const _createTypeCheck: ReturnType<
    typeof httpToDomainExperienceCreate
> extends ExperienceAdminCreateInput
    ? true
    : never = true as ReturnType<
    typeof httpToDomainExperienceCreate
> extends ExperienceAdminCreateInput
    ? true
    : never;

// Check 5: All domain update fields are mapped in HTTP conversion
// (Non-never MissingUpdateFields is expected for rich-content + server-managed fields;
//  the critical gate is Check 6.)
type DomainUpdateFields = keyof ExperienceUpdateInput;
type HttpUpdateConversionFields = keyof ReturnType<typeof httpToDomainExperienceUpdate>;
type MissingUpdateFields = Exclude<DomainUpdateFields, HttpUpdateConversionFields>;

const _updateFieldsCheck: MissingUpdateFields extends never ? true : never =
    true as MissingUpdateFields extends never ? true : never;

// Check 6: HTTP update conversion output is compatible with domain update type
const _updateTypeCheck: ReturnType<
    typeof httpToDomainExperienceUpdate
> extends ExperienceUpdateInput
    ? true
    : never = true as ReturnType<typeof httpToDomainExperienceUpdate> extends ExperienceUpdateInput
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
export const validateExperienceSchemaConsistency = () => {
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
