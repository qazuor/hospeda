/**
 * Accommodation HTTP Schemas
 *
 * HTTP-compatible schemas for accommodation operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { PriceCurrencyEnum } from '../../enums/currency.enum.js';
import { AccommodationTypeEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * HTTP-compatible accommodation search schema with automatic coercion
 * Extracted from inline definition and enhanced with proper HTTP patterns
 */
export const AccommodationSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Location filters with HTTP coercion
    destinationId: z.string().uuid().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().optional(),
    // SPEC-097 — Viewport bbox for listing maps
    bboxNorth: z.coerce.number().min(-90).max(90).optional(),
    bboxSouth: z.coerce.number().min(-90).max(90).optional(),
    bboxEast: z.coerce.number().min(-180).max(180).optional(),
    bboxWest: z.coerce.number().min(-180).max(180).optional(),

    // Price filters with HTTP coercion
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),

    // Capacity filters with HTTP coercion
    minGuests: z.coerce.number().int().min(1).optional(),
    maxGuests: z.coerce.number().int().min(1).optional(),
    minBedrooms: z.coerce.number().int().min(0).optional(),
    maxBedrooms: z.coerce.number().int().min(0).optional(),
    minBathrooms: z.coerce.number().int().min(0).optional(),
    maxBathrooms: z.coerce.number().int().min(0).optional(),

    // Rating filters with HTTP coercion
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),

    // Boolean filters with HTTP coercion
    isFeatured: createBooleanQueryParam('Filter featured accommodations'),
    isAvailable: createBooleanQueryParam('Filter available accommodations'),
    hasPool: createBooleanQueryParam('Filter accommodations with pools'),
    hasWifi: createBooleanQueryParam('Filter accommodations with WiFi'),
    allowsPets: createBooleanQueryParam('Filter pet-friendly accommodations'),
    hasParking: createBooleanQueryParam('Filter accommodations with parking'),

    // Type filters
    type: AccommodationTypeEnumSchema.optional(),

    // Date filters with HTTP coercion
    checkIn: z.coerce.date().optional(),
    checkOut: z.coerce.date().optional(),
    availableFrom: z.coerce.date().optional(),
    availableTo: z.coerce.date().optional(),

    // Text search filters
    name: z.string().optional(),
    description: z.string().optional(),
    address: z.string().optional(),

    // Array filters with HTTP coercion
    types: createArrayQueryParam('Filter by multiple accommodation types'),
    /**
     * Filter by required amenity UUIDs.
     * Accepts repeated query params (?amenities=uuid1&amenities=uuid2) or
     * comma-separated values (?amenities=uuid1,uuid2).
     * Each value must be a valid UUID v4; invalid UUIDs cause a 400 error.
     */
    amenities: z
        .union([
            // repeated param: Hono passes array directly
            z.array(z.string().uuid()),
            // comma-separated string: coerce to array then validate each element
            z
                .string()
                .transform((val) =>
                    val
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                )
                .pipe(z.array(z.string().uuid()))
        ])
        .optional(),
    /**
     * Filter by required feature UUIDs.
     * Accepts repeated query params (?features=uuid1&features=uuid2) or
     * comma-separated values (?features=uuid1,uuid2).
     * Each value must be a valid UUID v4; invalid UUIDs cause a 400 error.
     */
    features: z
        .union([
            z.array(z.string().uuid()),
            z
                .string()
                .transform((val) =>
                    val
                        .split(',')
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0)
                )
                .pipe(z.array(z.string().uuid()))
        ])
        .optional(),
    destinationIds: createArrayQueryParam('Filter by multiple destination IDs'),

    // Include relation flags (opt-in for heavier queries)
    includeAmenities: createBooleanQueryParam('Include accommodation amenities in response'),
    includeFeatures: createBooleanQueryParam('Include accommodation features in response')
});

export type AccommodationSearchHttp = z.infer<typeof AccommodationSearchHttpSchema>;

/**
 * HTTP-compatible image shape accepted from web clients.
 *
 * Client uploads return `{ url, publicId, width, height, moderationState }` but
 * only `url` is required. The converter applies `moderationState: 'APPROVED'`
 * when the client omits it (SPEC-208). Extra fields (publicId, width, height)
 * are stripped during domain conversion via the media normaliser.
 */
const HttpImageSchema = z.object({
    url: z.string().url({ message: 'zodError.common.media.image.url.invalid' }),
    caption: z
        .string()
        .min(3, { message: 'zodError.common.media.image.caption.min' })
        .max(100, { message: 'zodError.common.media.image.caption.max' })
        .optional(),
    description: z
        .string()
        .min(10, { message: 'zodError.common.media.image.description.min' })
        .max(300, { message: 'zodError.common.media.image.description.max' })
        .optional(),
    alt: z
        .string()
        .min(1, { message: 'zodError.common.media.image.alt.min' })
        .max(200, { message: 'zodError.common.media.image.alt.max' })
        .optional(),
    /** Optional — converter defaults to APPROVED when absent (SPEC-208). */
    moderationState: z.string().optional(),
    /** Cloudinary public_id — stripped during domain conversion. */
    publicId: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional()
});

/**
 * HTTP-compatible media shape accepted from web clients (SPEC-208).
 *
 * Matches the domain `BaseMediaObjectSchema` structurally but accepts images
 * without `moderationState` — the converter supplies `APPROVED` by default.
 */
const HttpMediaSchema = z
    .object({
        featuredImage: HttpImageSchema.optional().nullable(),
        gallery: z.array(HttpImageSchema).optional(),
        videos: z
            .array(
                z.object({
                    url: z.string().url({ message: 'zodError.common.media.video.url.invalid' }),
                    caption: z.string().optional(),
                    description: z.string().optional(),
                    moderationState: z.string().optional()
                })
            )
            .optional()
    })
    .nullable();

/**
 * HTTP-compatible accommodation creation schema
 * Handles form data and JSON input for creating accommodations via HTTP
 */
export const AccommodationCreateHttpSchema = z.object({
    name: z.string().min(1, { message: 'zodError.accommodation.name.required' }).max(200),
    /**
     * Summary — optional short description (SPEC-208 additive).
     * Aligned with `AccommodationSchema.summary` bounds (10–300 chars).
     */
    summary: z
        .string()
        .min(10, { message: 'zodError.accommodation.summary.min' })
        .max(300, { message: 'zodError.accommodation.summary.max' })
        .optional(),
    /**
     * Description — bilateral validation aligned with `AccommodationCreateDraftHttpSchema`
     * and the base `AccommodationSchema.description.min(30)`. When provided, it must
     * be at least 30 chars. Stays `.optional()` so callers can omit it on partial
     * payloads; the service layer either keeps the existing DB value (update) or
     * seeds a placeholder (draft create). See SPEC-143 Finding #9.
     */
    description: z
        .string()
        .min(30, { message: 'zodError.accommodation.description.min' })
        .max(5000, { message: 'zodError.accommodation.description.max' })
        .optional(),
    type: AccommodationTypeEnumSchema,
    address: z.string().min(1, { message: 'zodError.accommodation.address.required' }).max(500),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),

    // Capacity
    // High technical ceilings so large accommodations (hotels, multi-unit
    // complexes) are accepted. The domain schema imposes no max; these caps are
    // anti-abuse guards, not product limits. Per-unit capacity modelling for
    // hotels/complexes is tracked as a dedicated follow-up spec.
    maxGuests: z.coerce.number().int().min(1).max(200),
    bedrooms: z.coerce.number().int().min(0).max(100),
    bathrooms: z.coerce.number().int().min(1).max(100),

    // Pricing
    basePrice: z.coerce.number().min(0),
    currency: PriceCurrencyEnumSchema.default(PriceCurrencyEnum.USD),

    // Boolean properties
    // isFeatured is intentionally omitted: owners cannot set featured status.
    // Featuring is derived automatically from the FEATURED_LISTING entitlement
    // (featuredByPlan column) — the admin-only path keeps manual isFeatured control
    // via AccommodationPatchInputSchema in accommodation.crud.schema.ts (SPEC-292).
    isAvailable: z.coerce.boolean().default(true),
    allowsPets: z.coerce.boolean().default(false),

    // Relations
    destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    ownerId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Junction sync fields (SPEC-172 / SPEC-208 additive)
    /** Optional amenity UUIDs to associate on create/update (SPEC-172 write-only). */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.accommodation.amenityIds.invalidUuid' }))
        .optional(),
    /** Optional feature UUIDs to associate on create/update (SPEC-172 write-only). */
    featureIds: z
        .array(z.string().uuid({ message: 'zodError.accommodation.featureIds.invalidUuid' }))
        .optional(),

    /**
     * Media (SPEC-208 additive).
     * Client supplies images with optional moderationState; converter defaults
     * missing moderationState to APPROVED for immediate host publication.
     */
    media: HttpMediaSchema.optional(),

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

export type AccommodationCreateHttp = z.infer<typeof AccommodationCreateHttpSchema>;

/**
 * HTTP-compatible minimal accommodation draft creation schema.
 *
 * Used by the public web "create draft" flow (host onboarding). The required
 * fields (name, summary, type, destinationId) are the bare minimum needed to
 * create a DRAFT. All other fields are OPTIONAL and carry import-provided data
 * when the host triggers an automated import (SPEC-258).
 *
 * Optional fields use the SAME flat field names and coercion rules as
 * `AccommodationCreateHttpSchema` so the existing flat→nested converter
 * (`httpToDomainAccommodationCreateDraft`) can reuse the same mapping logic
 * without reimplementing the nested transformations.
 *
 * The resulting record is always persisted with `lifecycleState: DRAFT`.
 */
export const AccommodationCreateDraftHttpSchema = z.object({
    // --- Required essentials ---
    name: z
        .string()
        .min(3, { message: 'zodError.accommodation.name.min' })
        .max(100, { message: 'zodError.accommodation.name.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.accommodation.summary.min' })
        .max(300, { message: 'zodError.accommodation.summary.max' }),
    type: AccommodationTypeEnumSchema,
    destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // --- Optional text fields ---
    /**
     * Long description. When provided must be at least 30 chars (matches the
     * base `AccommodationSchema.description.min(30)` constraint). Omitting it
     * causes the service to seed a placeholder so the DB constraint is satisfied.
     */
    description: z
        .string()
        .min(30, { message: 'zodError.accommodation.description.min' })
        .max(2000, { message: 'zodError.accommodation.description.max' })
        .optional(),

    // --- Optional capacity (→ extraInfo) ---
    /** Maximum number of guests. Maps to `extraInfo.capacity`. */
    maxGuests: z.coerce.number().int().min(1).max(200).optional(),
    /** Number of bedrooms. Maps to `extraInfo.bedrooms`. */
    bedrooms: z.coerce.number().int().min(0).max(100).optional(),
    /** Number of bathrooms. Maps to `extraInfo.bathrooms`. */
    bathrooms: z.coerce.number().int().min(1).max(100).optional(),
    /** Number of beds. Maps to `extraInfo.beds`. */
    beds: z.coerce.number().int().min(0).max(200).optional(),

    // --- Optional pricing (→ price) ---
    /** Base nightly price. Maps to `price.price`. */
    basePrice: z.coerce.number().min(0).optional(),
    /** Currency code. Maps to `price.currency`. Defaults to USD when basePrice is supplied without it. */
    currency: PriceCurrencyEnumSchema.optional(),

    // --- Optional location (→ location) ---
    /** Latitude in decimal degrees. Maps to `location.coordinates.lat`. */
    latitude: z.coerce.number().min(-90).max(90).optional(),
    /** Longitude in decimal degrees. Maps to `location.coordinates.long`. */
    longitude: z.coerce.number().min(-180).max(180).optional(),
    /** Street name. Maps to `location.street`. */
    street: z.string().min(2).max(50).optional(),
    /** Street number (string to support "123bis" etc.). Maps to `location.number`. */
    number: z.string().min(1).max(10).optional(),

    // --- Optional contact (→ contactInfo) ---
    /** Mobile phone. Maps to `contactInfo.mobilePhone`. */
    phone: z.string().optional(),
    /** Website URL. Maps to `contactInfo.website`. */
    website: z.string().url({ message: 'zodError.common.contact.website.invalid' }).optional(),

    // --- Optional amenity junction (SPEC-172) ---
    /**
     * UUID list of amenities to sync on creation. When provided, the service
     * inserts rows in `r_accommodation_amenity` transactionally.
     * Undefined → no junction rows written.
     */
    amenityIds: z
        .array(z.string().uuid({ message: 'zodError.accommodation.amenityIds.invalidUuid' }))
        .optional()
});

export type AccommodationCreateDraftHttp = z.infer<typeof AccommodationCreateDraftHttpSchema>;

/**
 * HTTP-compatible accommodation update schema
 * Handles partial updates via HTTP PATCH requests
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const AccommodationUpdateHttpSchema = z
    .object(stripShapeDefaults(AccommodationCreateHttpSchema.shape))
    .partial()
    .omit({
        ownerId: true // Owner cannot be changed after creation
    });

export type AccommodationUpdateHttp = z.infer<typeof AccommodationUpdateHttpSchema>;

/**
 * HTTP-compatible accommodation query parameters for single accommodation retrieval
 * Used for GET /accommodations/:id type requests
 */
export const AccommodationGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeReviews: createBooleanQueryParam('Include accommodation reviews'),
    includeAmenities: createBooleanQueryParam('Include accommodation amenities'),
    includeFeatures: createBooleanQueryParam('Include accommodation features'),
    includeHost: createBooleanQueryParam('Include host information'),
    includeAvailability: createBooleanQueryParam('Include availability calendar')
});

export type AccommodationGetHttp = z.infer<typeof AccommodationGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type {
    AccommodationCreateInput,
    AccommodationUpdateInput
} from './accommodation.crud.schema.js';
import type { AccommodationSearch } from './accommodation.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Only maps fields that exist in both HTTP and domain schemas
 */
export const httpToDomainAccommodationSearch = (
    httpParams: AccommodationSearchHttp
): AccommodationSearch => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    sorts: httpParams.sorts,
    featuredFirst: httpParams.featuredFirst,
    q: httpParams.q,

    // Entity-specific filters that exist in BOTH schemas
    type: httpParams.type,
    types: httpParams.types,
    isFeatured: httpParams.isFeatured,
    minPrice: httpParams.minPrice,
    maxPrice: httpParams.maxPrice,
    currency: httpParams.currency,
    destinationId: httpParams.destinationId,
    destinationIds: httpParams.destinationIds,
    latitude: httpParams.latitude,
    longitude: httpParams.longitude,
    radius: httpParams.radius,
    bboxNorth: httpParams.bboxNorth,
    bboxSouth: httpParams.bboxSouth,
    bboxEast: httpParams.bboxEast,
    bboxWest: httpParams.bboxWest,
    minGuests: httpParams.minGuests,
    maxGuests: httpParams.maxGuests,
    minBedrooms: httpParams.minBedrooms,
    maxBedrooms: httpParams.maxBedrooms,
    minBathrooms: httpParams.minBathrooms,
    maxBathrooms: httpParams.maxBathrooms,
    minRating: httpParams.minRating,
    maxRating: httpParams.maxRating,
    amenities: httpParams.amenities,
    features: httpParams.features,
    includeAmenities: httpParams.includeAmenities,
    includeFeatures: httpParams.includeFeatures,
    checkIn: httpParams.checkIn,
    checkOut: httpParams.checkOut,
    isAvailable: httpParams.isAvailable

    // Note: Fields like country, city, ownerId, createdAfter, createdBefore
    // exist in domain schema but not in HTTP schema, so they're not mapped
});

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';

// ---------------------------------------------------------------------------
// Media normalisation helper (SPEC-208)
// ---------------------------------------------------------------------------

type HttpImage = {
    url: string;
    caption?: string;
    description?: string;
    alt?: string;
    moderationState?: string;
    publicId?: string;
    width?: number;
    height?: number;
};

type HttpMedia = {
    featuredImage?: HttpImage | null;
    gallery?: HttpImage[];
    videos?: Array<{
        url: string;
        caption?: string;
        description?: string;
        moderationState?: string;
    }>;
} | null;

/**
 * Shape returned by `normaliseHttpMedia` for non-null inputs.
 *
 * Extends the domain's `BaseMediaObjectSchema` shape with `featuredImage: null`
 * to carry the explicit clear-signal from the HTTP layer to the service layer.
 * The service handles the null by setting the JSONB field to null in DB.
 */
type NormalisedMediaObject = {
    /** Normalised featured image. null = host explicitly cleared it. */
    featuredImage?: {
        url: string;
        moderationState: ModerationStatusEnum;
        caption?: string;
        description?: string;
        alt?: string;
    } | null;
    gallery?: {
        url: string;
        moderationState: ModerationStatusEnum;
        caption?: string;
        description?: string;
        alt?: string;
    }[];
    videos?: {
        url: string;
        moderationState: ModerationStatusEnum;
        caption?: string;
        description?: string;
    }[];
};

/**
 * Normalise an HTTP media payload to the domain shape.
 *
 * - Applies `moderationState: APPROVED` to any image that doesn't supply one
 *   (host uploads are immediately published per SPEC-208 policy).
 * - Strips client-only fields (publicId, width, height) that have no equivalent
 *   in the domain `BaseMediaObjectSchema`.
 * - Passes through null as-is so callers can express "clear media".
 * - Preserves `featuredImage: null` (explicit clear-signal) distinct from
 *   `featuredImage: undefined` (no change).
 */
function normaliseHttpMedia(httpMedia: HttpMedia): NormalisedMediaObject | null {
    if (httpMedia === null) return null;

    const normImage = (
        img: HttpImage
    ): NormalisedMediaObject['gallery'] extends Array<infer T> ? T : never =>
        ({
            url: img.url,
            ...(img.caption !== undefined ? { caption: img.caption } : {}),
            ...(img.description !== undefined ? { description: img.description } : {}),
            ...(img.alt !== undefined ? { alt: img.alt } : {}),
            // Cast is safe: the schema accepts the string enum value; the domain
            // type is ModerationStatusEnum which is a string enum with the same values.
            moderationState: (img.moderationState ??
                ModerationStatusEnum.APPROVED) as ModerationStatusEnum
        }) as NormalisedMediaObject['gallery'] extends Array<infer T> ? T : never;

    const normVideo = (v: {
        url: string;
        caption?: string;
        description?: string;
        moderationState?: string;
    }): NormalisedMediaObject['videos'] extends Array<infer T> ? T : never =>
        ({
            url: v.url,
            ...(v.caption !== undefined ? { caption: v.caption } : {}),
            ...(v.description !== undefined ? { description: v.description } : {}),
            moderationState: (v.moderationState ??
                ModerationStatusEnum.APPROVED) as ModerationStatusEnum
        }) as NormalisedMediaObject['videos'] extends Array<infer T> ? T : never;

    const result: NormalisedMediaObject = {};
    if (httpMedia.featuredImage != null) {
        result.featuredImage = normImage(httpMedia.featuredImage);
    } else if (httpMedia.featuredImage === null) {
        // Explicit null → signal the service to clear the field.
        result.featuredImage = null;
    }
    if (httpMedia.gallery !== undefined) {
        result.gallery = httpMedia.gallery.map(normImage);
    }
    if (httpMedia.videos !== undefined) {
        result.videos = httpMedia.videos.map(normVideo);
    }
    return result;
}

/**
 * Convert HTTP create data to domain create input
 * Transforms HTTP form/JSON data to domain object with proper nested structures
 */
export const httpToDomainAccommodationCreate = (
    httpData: AccommodationCreateHttp
): AccommodationCreateInput => ({
    // Basic required fields
    name: httpData.name,
    // Use explicit summary if supplied; otherwise generate from description or name
    summary: httpData.summary ?? (httpData.description?.substring(0, 300) || httpData.name),
    description: httpData.description ?? '', // Required field, provide default
    type: httpData.type,
    destinationId: httpData.destinationId,
    ownerId: httpData.ownerId,
    // isFeatured is always false on owner-created accommodations (SPEC-292).
    // Owners cannot set featured status — it is derived from the FEATURED_LISTING
    // entitlement (featuredByPlan). Admin keeps manual control via the admin path.
    isFeatured: false,

    // Required fields with sensible defaults using proper enums
    moderationState: ModerationStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    reviewsCount: 0,
    averageRating: 0,
    visibility: VisibilityEnum.PUBLIC,

    // ✅ COMPLETED: Proper nested object structures

    // Location mapping from flat HTTP fields to AccommodationLocationSchema (postal address only).
    // Geographic context (city, state, country) is derived from the destination relation.
    location: {
        coordinates: {
            lat: httpData.latitude.toString(),
            long: httpData.longitude.toString()
        }
    },

    // Price mapping from flat HTTP fields to nested domain structure
    price: {
        price: httpData.basePrice,
        currency: httpData.currency
    },

    // Contact info mapping from flat HTTP fields to nested ContactInfoSchema
    ...(httpData.phone !== undefined ||
    httpData.email !== undefined ||
    httpData.website !== undefined
        ? {
              contactInfo: {
                  mobilePhone: httpData.phone || '',
                  personalEmail: httpData.email,
                  website: httpData.website
              }
          }
        : {}),

    // Social networks mapping from flat HTTP fields to nested SocialNetworkSchema
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

    // Extra info mapping from flat HTTP fields to nested domain structure
    extraInfo: {
        capacity: httpData.maxGuests,
        minNights: 1, // Default minimum stay
        bedrooms: httpData.bedrooms,
        bathrooms: httpData.bathrooms,
        smokingAllowed: false, // Default no smoking
        extraInfo: [] // Default empty array
    },

    // Junction sync (SPEC-172 / SPEC-208 additive): pass through when provided
    ...(httpData.amenityIds !== undefined ? { amenityIds: httpData.amenityIds } : {}),
    ...(httpData.featureIds !== undefined ? { featureIds: httpData.featureIds } : {}),

    // Media (SPEC-208 additive): normalise images to domain shape with APPROVED default.
    // Cast is safe: the domain JSONB column accepts null for featuredImage at runtime;
    // `null` here is the clear-signal (host removed the image). The Zod type models
    // featuredImage as `Image | undefined` — the null-as-clear convention is a
    // service-layer protocol not reflected in the static schema type.
    ...(httpData.media !== undefined
        ? {
              media: normaliseHttpMedia(httpData.media) as AccommodationCreateInput['media']
          }
        : {})
});

/**
 * Placeholder description seeded on draft creation when the host did not
 * provide one in the onboarding form. Must be ≥ 30 chars to satisfy the
 * base `AccommodationSchema.description.min(30)` constraint used by the
 * full create/update paths. The host will overwrite it from the admin panel
 * before publishing. See SPEC-143 Finding #9 for the bilateral-validation
 * gap this avoids (read schema 500 vs blank-on-create).
 */
const DRAFT_DESCRIPTION_PLACEHOLDER =
    'Borrador en progreso. Completá la descripción del alojamiento desde el panel de administración antes de publicarlo.';

/**
 * Convert minimal HTTP draft input into a domain create input.
 *
 * Used by the protected "create draft" endpoint (host onboarding). The caller
 * (route handler) is responsible for injecting `ownerId` from the authenticated
 * actor before passing the result to the service layer.
 *
 * Required fields (name, summary, type, destinationId) are always mapped.
 * Optional import-provided fields (capacity, bedrooms, bathrooms, beds, price,
 * coordinates, street, number, phone, website, amenityIds) are mapped
 * conditionally — only when present — using the same flat→nested logic as
 * `httpToDomainAccommodationCreate` (SPEC-258 single source of truth).
 *
 * Forced server-side overrides:
 * - `lifecycleState`: always `DRAFT`
 * - `visibility`: always `PRIVATE`
 * - `isFeatured`: always `false`
 * - `moderationState`: always `PENDING`
 * - `ownerId`: always injected from the authenticated actor
 *
 * @param httpData - Validated HTTP draft input.
 * @param ownerId - Authenticated actor ID (injected by the route handler).
 * @returns Domain create input ready for the service layer.
 */
export const httpToDomainAccommodationCreateDraft = (
    httpData: AccommodationCreateDraftHttp,
    ownerId: string
): AccommodationCreateInput => ({
    // --- Required fields ---
    name: httpData.name,
    summary: httpData.summary,
    description: httpData.description ?? DRAFT_DESCRIPTION_PLACEHOLDER,
    type: httpData.type,
    destinationId: httpData.destinationId,
    ownerId,

    // --- Forced server-side overrides ---
    isFeatured: false,
    moderationState: ModerationStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.DRAFT,
    reviewsCount: 0,
    averageRating: 0,
    visibility: VisibilityEnum.PRIVATE,

    // --- Optional: location (→ location JSONB) ---
    // Emit the `location` block only when at least one location field is present.
    // Mirrors the flat→nested mapping of `httpToDomainAccommodationCreate`.
    ...(httpData.latitude !== undefined ||
    httpData.longitude !== undefined ||
    httpData.street !== undefined ||
    httpData.number !== undefined
        ? {
              location: {
                  ...(httpData.latitude !== undefined && httpData.longitude !== undefined
                      ? {
                            coordinates: {
                                lat: httpData.latitude.toString(),
                                long: httpData.longitude.toString()
                            }
                        }
                      : {}),
                  ...(httpData.street !== undefined ? { street: httpData.street } : {}),
                  ...(httpData.number !== undefined ? { number: httpData.number } : {})
              }
          }
        : {}),

    // --- Optional: pricing (→ price JSONB) ---
    ...(httpData.basePrice !== undefined || httpData.currency !== undefined
        ? {
              price: {
                  ...(httpData.basePrice !== undefined ? { price: httpData.basePrice } : {}),
                  ...(httpData.currency !== undefined ? { currency: httpData.currency } : {})
              }
          }
        : {}),

    // --- Optional: contact info (→ contactInfo JSONB) ---
    // ContactInfoSchema.mobilePhone is required in the full schema, but for a DRAFT
    // we may only have a website (no phone) or a phone without website. Cast to the
    // full ContactInfo type since the DB column is JSONB and the service normalises
    // at read time. Same pattern as the update path (ContactInfoSchema.partial()).
    ...(httpData.phone !== undefined || httpData.website !== undefined
        ? {
              contactInfo: {
                  ...(httpData.phone !== undefined ? { mobilePhone: httpData.phone } : {}),
                  ...(httpData.website !== undefined ? { website: httpData.website } : {})
              } as AccommodationCreateInput['contactInfo']
          }
        : {}),

    // --- Optional: capacity (→ extraInfo JSONB) ---
    // Only emits the `extraInfo` block when at least one capacity field is present.
    // The draft is intentionally partial — the host completes the full listing from
    // the admin panel. AccommodationCreateInput.extraInfo expects the FULL ExtraInfo
    // shape (capacity/minNights/bedrooms/bathrooms required), but for a DRAFT we
    // only persist whatever the import provided. The cast is safe because the DB
    // column is JSONB (any valid JSON) and the service normalises partial extraInfo
    // at read time. See also the `extraInfo: AccommodationExtraInfoSchema.partial().nullish()`
    // pattern on `AccommodationUpdateInputSchema` (SPEC-229).
    ...(httpData.maxGuests !== undefined ||
    httpData.bedrooms !== undefined ||
    httpData.bathrooms !== undefined ||
    httpData.beds !== undefined
        ? {
              extraInfo: {
                  ...(httpData.maxGuests !== undefined ? { capacity: httpData.maxGuests } : {}),
                  ...(httpData.bedrooms !== undefined ? { bedrooms: httpData.bedrooms } : {}),
                  ...(httpData.bathrooms !== undefined ? { bathrooms: httpData.bathrooms } : {}),
                  ...(httpData.beds !== undefined ? { beds: httpData.beds } : {})
              } as AccommodationCreateInput['extraInfo']
          }
        : {}),

    // --- Optional: amenity junction sync (SPEC-172 / SPEC-258) ---
    // Pass amenityIds through to the domain input so _beforeCreate captures them
    // in hookState and _afterCreate can run syncAmenityJunction transactionally.
    ...(httpData.amenityIds !== undefined ? { amenityIds: httpData.amenityIds } : {})
});

/**
 * Convert HTTP update data to domain update input
 * Transforms HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainAccommodationUpdate = (
    httpData: AccommodationUpdateHttp
): AccommodationUpdateInput => ({
    // Only map fields that exist in both schemas.
    // isFeatured is intentionally absent: owner PATCH must not carry it.
    // The field stays undefined (AccommodationUpdateInput is .partial()), so
    // the service layer sees no instruction to flip the featured flag (SPEC-292).
    name: httpData.name,
    summary: httpData.summary,
    description: httpData.description,
    type: httpData.type,
    destinationId: httpData.destinationId,

    // ✅ COMPLETED: Nested object mappings for location, price, extraInfo

    // Location mapping (only if coordinates are provided). Postal address only;
    // geographic context comes from the destination relation.
    ...(httpData.latitude !== undefined && httpData.longitude !== undefined
        ? {
              location: {
                  coordinates: {
                      lat: httpData.latitude?.toString() || '',
                      long: httpData.longitude?.toString() || ''
                  }
              }
          }
        : {}),

    // Price mapping (SPEC-229): emit a partial group from whatever is present.
    // A lone `currency` (or lone `basePrice`) is now preserved-merged onto the
    // stored JSONB instead of being dropped. No defaults are injected so omitted
    // siblings survive the shallow merge.
    ...(httpData.basePrice !== undefined || httpData.currency !== undefined
        ? {
              price: {
                  ...(httpData.basePrice !== undefined ? { price: httpData.basePrice } : {}),
                  ...(httpData.currency !== undefined ? { currency: httpData.currency } : {})
              }
          }
        : {}),

    // Contact info mapping (SPEC-229): emit only the fields actually provided.
    // Critically, do NOT inject `mobilePhone: ''` when `phone` is absent — that
    // empty-string default would clobber the stored phone via the JSONB merge.
    ...(httpData.phone !== undefined ||
    httpData.email !== undefined ||
    httpData.website !== undefined
        ? {
              contactInfo: {
                  ...(httpData.phone !== undefined ? { mobilePhone: httpData.phone } : {}),
                  ...(httpData.email !== undefined ? { personalEmail: httpData.email } : {}),
                  ...(httpData.website !== undefined ? { website: httpData.website } : {})
              }
          }
        : {}),

    // Social networks mapping (SPEC-229): emit only the provided handles so the
    // others are preserved by the shallow merge.
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

    // Extra info mapping (SPEC-229): emit a partial group from whatever is present.
    // Previously this required maxGuests AND bedrooms AND bathrooms together and
    // injected `minNights: 1` / `smokingAllowed: false` defaults — both of which
    // overwrote stored values on every edit. Now a lone field (e.g. `bedrooms`)
    // is merged and unsent siblings (capacity/minNights/bathrooms/...) are kept.
    ...(httpData.maxGuests !== undefined ||
    httpData.bedrooms !== undefined ||
    httpData.bathrooms !== undefined
        ? {
              extraInfo: {
                  ...(httpData.maxGuests !== undefined ? { capacity: httpData.maxGuests } : {}),
                  ...(httpData.bedrooms !== undefined ? { bedrooms: httpData.bedrooms } : {}),
                  ...(httpData.bathrooms !== undefined ? { bathrooms: httpData.bathrooms } : {})
              }
          }
        : {}),

    // Junction sync (SPEC-172 / SPEC-208 additive): pass through when provided
    ...(httpData.amenityIds !== undefined ? { amenityIds: httpData.amenityIds } : {}),
    ...(httpData.featureIds !== undefined ? { featureIds: httpData.featureIds } : {}),

    // Media (SPEC-208 additive): normalise images to domain shape with APPROVED default.
    // Cast is safe: see create converter comment above for the null-as-clear rationale.
    ...(httpData.media !== undefined
        ? {
              media: normaliseHttpMedia(httpData.media ?? null) as AccommodationUpdateInput['media']
          }
        : {})
});

// ============================================================================
// COMPILE-TIME VALIDATION
// ============================================================================

/**
 * Type-level validation to ensure HTTP→Domain conversion covers all fields
 * These checks will cause TypeScript compilation errors if schemas are inconsistent
 */

// Check 1: All domain search fields are mapped in HTTP conversion
type DomainSearchFields = keyof AccommodationSearch;
type HttpConversionFields = keyof ReturnType<typeof httpToDomainAccommodationSearch>;
type MissingSearchFields = Exclude<DomainSearchFields, HttpConversionFields>;

// This will be 'never' if all fields are mapped, otherwise TypeScript will show missing fields
const _searchFieldsCheck: MissingSearchFields extends never ? true : never =
    true as MissingSearchFields extends never ? true : never;

// Check 2: HTTP search conversion output is compatible with domain type
const _searchTypeCheck: ReturnType<
    typeof httpToDomainAccommodationSearch
> extends AccommodationSearch
    ? true
    : never = true as ReturnType<typeof httpToDomainAccommodationSearch> extends AccommodationSearch
    ? true
    : never;

// Check 3: All domain create fields are mapped in HTTP conversion
type DomainCreateFields = keyof AccommodationCreateInput;
type HttpCreateConversionFields = keyof ReturnType<typeof httpToDomainAccommodationCreate>;
type MissingCreateFields = Exclude<DomainCreateFields, HttpCreateConversionFields>;

const _createFieldsCheck: MissingCreateFields extends never ? true : never =
    true as MissingCreateFields extends never ? true : never;

// Check 4: HTTP create conversion output is compatible with domain type
const _createTypeCheck: ReturnType<
    typeof httpToDomainAccommodationCreate
> extends AccommodationCreateInput
    ? true
    : never = true as ReturnType<
    typeof httpToDomainAccommodationCreate
> extends AccommodationCreateInput
    ? true
    : never;

// Check 5: All domain update fields are mapped in HTTP conversion
type DomainUpdateFields = keyof AccommodationUpdateInput;
type HttpUpdateConversionFields = keyof ReturnType<typeof httpToDomainAccommodationUpdate>;
type MissingUpdateFields = Exclude<DomainUpdateFields, HttpUpdateConversionFields>;

const _updateFieldsCheck: MissingUpdateFields extends never ? true : never =
    true as MissingUpdateFields extends never ? true : never;

// Check 6: HTTP update conversion output is compatible with domain type
const _updateTypeCheck: ReturnType<
    typeof httpToDomainAccommodationUpdate
> extends AccommodationUpdateInput
    ? true
    : never = true as ReturnType<
    typeof httpToDomainAccommodationUpdate
> extends AccommodationUpdateInput
    ? true
    : never;

/**
 * Runtime validation function for development/testing
 * Validates that conversion functions work correctly
 */
export const validateAccommodationSchemaConsistency = () => {
    // These assignments will fail at compile time if schemas are inconsistent
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

// Suppress unused variable warnings for validation checks
void _searchFieldsCheck;
void _searchTypeCheck;
void _createFieldsCheck;
void _createTypeCheck;
void _updateFieldsCheck;
void _updateTypeCheck;
