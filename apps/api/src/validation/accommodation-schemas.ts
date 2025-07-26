import {
    AccommodationFilterInputSchema,
    AccommodationIdSchema,
    AccommodationRatingSchema,
    AccommodationSchema,
    AccommodationTypeEnumSchema,
    InternationalPhoneRegex,
    PriceSchema,
    SortDirectionSchema
} from '@repo/schemas';
import {
    GetAccommodationSchema,
    SearchAccommodationSchema
} from '@repo/service-core/services/accommodation/accommodation.schemas';
import { AccommodationTypeEnum, AmenitiesTypeEnum } from '@repo/types';

/**
 * Accommodation validation schemas optimized for public API
 * Leverages @repo/schemas and @repo/service-core with minimal API-specific adaptations
 */
import { z } from 'zod';
import { APIValidationSchemas } from '../middlewares/validation';

/**
 * Re-export accommodation types and amenity types from centralized packages
 * No need to redefine these constants
 */
export const AccommodationTypes = Object.values(AccommodationTypeEnum);
export const AccommodationAmenityTypes = Object.values(AmenitiesTypeEnum);

/**
 * Common validation patterns extracted from centralized schemas
 */
const CommonValidationPatterns = {
    // Extract name validation pattern from AccommodationSchema
    name: AccommodationSchema.shape.name,
    // Create a more relaxed name pattern for guest names (min 2 instead of 3)
    guestName: z.string().min(2).max(100)
} as const;

/**
 * Accommodation validation schemas optimized for public API
 * Leverages existing schemas from @repo packages with API-specific adaptations
 */
export const AccommodationSchemas = {
    /**
     * Schema for listing accommodations with filters
     * Reuses AccommodationFilterInputSchema and extends with API-specific pagination
     */
    list: AccommodationFilterInputSchema.extend({
        // Override pagination to use offset/limit for public API
        limit: APIValidationSchemas.paginationLimit,
        offset: APIValidationSchemas.paginationOffset,

        // Use centralized accommodation type enum schema
        type: AccommodationTypeEnumSchema.optional(),

        // Price filtering using centralized PriceSchema concepts
        minPrice: PriceSchema.shape.price.optional(),
        maxPrice: PriceSchema.shape.price.optional(),

        // Use existing rating validation from centralized schemas
        minRating: APIValidationSchemas.rating.optional(),

        // Guest requirements
        guests: APIValidationSchemas.positiveInt.max(20).optional(),
        rooms: APIValidationSchemas.positiveInt.max(10).optional(),

        // Location-based search (simplified from LocationSchema)
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        radius: z.coerce.number().min(0.1).max(100).default(10).optional(),

        // Date range
        checkIn: APIValidationSchemas.date.optional(),
        checkOut: APIValidationSchemas.date.optional(),

        // Search and language
        q: APIValidationSchemas.searchQuery.optional(),
        lang: APIValidationSchemas.languageCode.default('en'),

        // Sorting using centralized sort schemas
        sort: z.enum(['price', 'rating', 'distance', 'name', 'created_at']).default('created_at'),
        order: SortDirectionSchema.default('DESC')
    })
        .refine(
            (data) => {
                if ((data.lat !== undefined) !== (data.lng !== undefined)) {
                    return false;
                }
                return true;
            },
            { message: 'Both latitude and longitude must be provided together' }
        )
        .refine(
            (data) => {
                if (data.checkIn && data.checkOut) {
                    const checkInDate = new Date(data.checkIn);
                    const checkOutDate = new Date(data.checkOut);
                    return checkInDate < checkOutDate;
                }
                return true;
            },
            { message: 'Check-in date must be before check-out date' }
        )
        .refine(
            (data) => {
                if (data.minPrice !== undefined && data.maxPrice !== undefined) {
                    return data.minPrice <= data.maxPrice;
                }
                return true;
            },
            { message: 'Minimum price must be less than or equal to maximum price' }
        ),

    /**
     * Re-export GetAccommodationSchema from service-core
     * No need to redefine this logic
     */
    getById: GetAccommodationSchema,

    /**
     * Schema for search - adapts SearchAccommodationSchema for public API
     * Uses service-core schema with pagination override
     */
    search: SearchAccommodationSchema.extend({
        // Override pagination for public API
        limit: APIValidationSchemas.paginationLimit,
        offset: APIValidationSchemas.paginationOffset,
        lang: APIValidationSchemas.languageCode.default('en')
    }).omit({ pagination: true }),

    /**
     * Availability check schema - minimal API-specific schema
     */
    availability: z
        .object({
            id: AccommodationIdSchema,
            checkIn: APIValidationSchemas.date,
            checkOut: APIValidationSchemas.date,
            guests: APIValidationSchemas.positiveInt.max(20).default(2)
        })
        .refine(
            (data) => {
                const checkInDate = new Date(data.checkIn);
                const checkOutDate = new Date(data.checkOut);
                return checkInDate < checkOutDate;
            },
            { message: 'Check-in date must be before check-out date' }
        )
        .refine(
            (data) => {
                const checkInDate = new Date(data.checkIn);
                const now = new Date();
                return checkInDate >= now;
            },
            { message: 'Check-in date must be in the future' }
        ),

    /**
     * Review schema - uses centralized rating validation from AccommodationRatingSchema
     */
    review: z.object({
        accommodationId: AccommodationIdSchema,
        // Extract rating validation pattern from AccommodationRatingSchema
        rating: AccommodationRatingSchema.shape.cleanliness, // Same 1-5 validation pattern
        title: z.string().min(5).max(100),
        comment: z.string().min(10).max(1000),
        guestName: CommonValidationPatterns.guestName,
        guestEmail: z.string().email(),
        stayDate: APIValidationSchemas.date
    }),

    /**
     * Booking schema - leverages centralized PriceSchema completely
     */
    booking: z.object({
        accommodationId: AccommodationIdSchema,
        checkIn: APIValidationSchemas.date,
        checkOut: APIValidationSchemas.date,
        guests: APIValidationSchemas.positiveInt.max(20),

        // Guest information using centralized patterns
        guestName: CommonValidationPatterns.guestName,
        guestEmail: z.string().email(),
        guestPhone: z.string().regex(InternationalPhoneRegex),

        // Special requests
        specialRequests: z.string().max(500).optional(),

        // Pricing using complete centralized PriceSchema
        pricing: PriceSchema
    })
} as const;

// Export individual schemas for easier importing
export const { list, getById, search, availability, review, booking } = AccommodationSchemas;

export default {
    AccommodationSchemas,
    AccommodationTypes,
    AccommodationAmenityTypes
};
