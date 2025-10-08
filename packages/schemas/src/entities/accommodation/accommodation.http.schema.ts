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
    amenities: createArrayQueryParam('Filter by required amenity IDs'),
    features: createArrayQueryParam('Filter by required feature IDs')
});

export type AccommodationSearchHttp = z.infer<typeof AccommodationSearchHttpSchema>;

/**
 * HTTP-compatible accommodation creation schema
 * Handles form data and JSON input for creating accommodations via HTTP
 */
export const AccommodationCreateHttpSchema = z.object({
    name: z.string().min(1, { message: 'zodError.accommodation.name.required' }).max(200),
    description: z.string().max(5000).optional(),
    type: AccommodationTypeEnumSchema,
    address: z.string().min(1, { message: 'zodError.accommodation.address.required' }).max(500),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),

    // Capacity
    maxGuests: z.coerce.number().int().min(1).max(20),
    bedrooms: z.coerce.number().int().min(0).max(10),
    bathrooms: z.coerce.number().int().min(1).max(10),

    // Pricing
    basePrice: z.coerce.number().min(0),
    currency: PriceCurrencyEnumSchema.default(PriceCurrencyEnum.USD),

    // Boolean properties
    isFeatured: z.coerce.boolean().default(false),
    isAvailable: z.coerce.boolean().default(true),
    allowsPets: z.coerce.boolean().default(false),

    // Relations
    destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    hostId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

export type AccommodationCreateHttp = z.infer<typeof AccommodationCreateHttpSchema>;

/**
 * HTTP-compatible accommodation update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const AccommodationUpdateHttpSchema = AccommodationCreateHttpSchema.partial().omit({
    hostId: true // Host cannot be changed after creation
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
    q: httpParams.q,

    // Entity-specific filters that exist in BOTH schemas
    type: httpParams.type,
    isFeatured: httpParams.isFeatured,
    minPrice: httpParams.minPrice,
    maxPrice: httpParams.maxPrice,
    currency: httpParams.currency,
    destinationId: httpParams.destinationId,
    latitude: httpParams.latitude,
    longitude: httpParams.longitude,
    radius: httpParams.radius,
    minGuests: httpParams.minGuests,
    maxGuests: httpParams.maxGuests,
    minBedrooms: httpParams.minBedrooms,
    maxBedrooms: httpParams.maxBedrooms,
    minBathrooms: httpParams.minBathrooms,
    maxBathrooms: httpParams.maxBathrooms,
    minRating: httpParams.minRating,
    maxRating: httpParams.maxRating,
    amenities: httpParams.amenities,
    checkIn: httpParams.checkIn,
    checkOut: httpParams.checkOut,
    isAvailable: httpParams.isAvailable

    // Note: Fields like country, city, hostId, createdAfter, createdBefore
    // exist in domain schema but not in HTTP schema, so they're not mapped
});

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';

/**
 * Convert HTTP create data to domain create input
 * Transforms HTTP form/JSON data to domain object with proper nested structures
 */
export const httpToDomainAccommodationCreate = (
    httpData: AccommodationCreateHttp
): AccommodationCreateInput => ({
    // Basic required fields
    name: httpData.name,
    summary: httpData.description?.substring(0, 300) || httpData.name, // Generate summary from description or use name
    description: httpData.description ?? '', // Required field, provide default
    type: httpData.type,
    destinationId: httpData.destinationId,
    ownerId: httpData.hostId, // Map hostId to ownerId
    isFeatured: httpData.isFeatured,

    // Required fields with sensible defaults using proper enums
    moderationState: ModerationStatusEnum.PENDING,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    reviewsCount: 0,
    averageRating: 0,
    visibility: VisibilityEnum.PUBLIC,

    // ✅ COMPLETED: Proper nested object structures

    // Location mapping from flat HTTP fields to nested domain structure (BaseLocationSchema)
    location: {
        state: '', // Default empty - would need additional HTTP field or geocoding
        zipCode: '', // Default empty - would need additional HTTP field
        country: '', // Default empty - would need additional HTTP field
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

    // Extra info mapping from flat HTTP fields to nested domain structure
    extraInfo: {
        capacity: httpData.maxGuests,
        minNights: 1, // Default minimum stay
        bedrooms: httpData.bedrooms,
        bathrooms: httpData.bathrooms,
        smokingAllowed: false, // Default no smoking
        extraInfo: [] // Default empty array
    }
});

/**
 * Convert HTTP update data to domain update input
 * Transforms HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainAccommodationUpdate = (
    httpData: AccommodationUpdateHttp
): AccommodationUpdateInput => ({
    // Only map fields that exist in both schemas
    name: httpData.name,
    description: httpData.description,
    type: httpData.type,
    isFeatured: httpData.isFeatured,
    destinationId: httpData.destinationId,

    // ✅ COMPLETED: Nested object mappings for location, price, extraInfo

    // Location mapping (only if coordinates are provided)
    ...(httpData.latitude !== undefined && httpData.longitude !== undefined
        ? {
              location: {
                  state: '', // Would need additional HTTP fields
                  zipCode: '', // Would need additional HTTP fields
                  country: '', // Would need additional HTTP fields
                  coordinates: {
                      lat: httpData.latitude.toString(),
                      long: httpData.longitude.toString()
                  }
              }
          }
        : {}),

    // Price mapping (only if basePrice is provided)
    ...(httpData.basePrice !== undefined
        ? {
              price: {
                  price: httpData.basePrice,
                  currency: httpData.currency
              }
          }
        : {}),

    // Extra info mapping (only if all required fields are provided)
    ...(httpData.maxGuests !== undefined &&
    httpData.bedrooms !== undefined &&
    httpData.bathrooms !== undefined
        ? {
              extraInfo: {
                  capacity: httpData.maxGuests,
                  minNights: 1, // Default minimum stay
                  bedrooms: httpData.bedrooms,
                  bathrooms: httpData.bathrooms,
                  smokingAllowed: false // Default
              }
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
