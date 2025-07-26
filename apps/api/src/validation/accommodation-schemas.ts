import {
    AccommodationFilterInputSchema,
    AccommodationIdSchema,
    BaseSearchSchema,
    PriceSchema
} from '@repo/schemas';
import { AccommodationTypeEnum } from '@repo/types';
/**
 * Accommodation-specific validation schemas
 * Validation schemas for accommodation-related endpoints using @repo packages
 */
import { z } from 'zod';
import { CommonSchemas } from '../middlewares/validation';

/**
 * Accommodation property types - using enum from @repo/types
 */
export const AccommodationTypes = Object.values(AccommodationTypeEnum);

/**
 * Accommodation amenities
 */
export const AccommodationAmenities = [
    'wifi',
    'parking',
    'pool',
    'gym',
    'spa',
    'restaurant',
    'bar',
    'pet-friendly',
    'family-friendly',
    'accessible',
    'business-center',
    'concierge',
    'room-service',
    'laundry',
    'kitchen',
    'balcony',
    'air-conditioning',
    'heating',
    'fireplace',
    'hot-tub',
    'garden'
] as const;

/**
 * Accommodation validation schemas
 */
export const AccommodationSchemas = {
    /**
     * Schema for listing accommodations with filters
     * Extends existing filter schema from @repo/schemas
     */
    list: AccommodationFilterInputSchema.omit({ tags: true, visibility: true }) // Remove fields not needed for public API
        .extend({
            // Pagination using consistent naming with @repo/schemas
            limit: CommonSchemas.paginationLimit,
            offset: CommonSchemas.paginationOffset,

            // Sorting compatible with existing schemas
            sort: z
                .enum(['price', 'rating', 'distance', 'name', 'created_at'])
                .default('created_at'),
            order: z.enum(['asc', 'desc']).default('desc'),

            // Additional filters for public API
            destination: CommonSchemas.slug.optional(),

            // Price filtering using PriceSchema from @repo/schemas
            minPrice: z.coerce.number().optional(),
            maxPrice: z.coerce.number().optional(),
            amenities: z
                .string()
                .transform((str) => str.split(',').map((s) => s.trim()))
                .pipe(z.array(z.enum(AccommodationAmenities)))
                .optional(),

            // Guest requirements
            guests: CommonSchemas.positiveInt.max(20).optional(),
            rooms: CommonSchemas.positiveInt.max(10).optional(),

            // Location-based search
            lat: CommonSchemas.latitude.optional(),
            lng: CommonSchemas.longitude.optional(),
            radius: z.coerce.number().min(0.1).max(100).default(10).optional(),

            // Date range (for availability)
            checkIn: CommonSchemas.date.optional(),
            checkOut: CommonSchemas.date.optional(),

            // Language preference
            lang: CommonSchemas.languageCode.default('en')
        })
        .refine(
            (data) => {
                // If both lat and lng are provided, both must be present
                if ((data.lat !== undefined) !== (data.lng !== undefined)) {
                    return false;
                }
                return true;
            },
            { message: 'Both latitude and longitude must be provided together' }
        )
        .refine(
            (data) => {
                // If checkIn and checkOut are provided, validate the range
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
                // Validate price range
                if (data.minPrice !== undefined && data.maxPrice !== undefined) {
                    return data.minPrice <= data.maxPrice;
                }
                return true;
            },
            { message: 'Minimum price must be less than or equal to maximum price' }
        ),

    /**
     * Schema for getting a single accommodation by ID
     */
    /**
     * Get accommodation by ID parameters
     */
    getById: z.object({
        id: AccommodationIdSchema
    }),

    /**
     * Schema for creating a new accommodation (for future admin endpoints)
     * Reuses base accommodation structure with public API additions
     */
    create: z.object({
        name: z.string().min(3).max(200),
        description: z.string().min(10).max(2000),
        type: z.enum(AccommodationTypes),
        destination: CommonSchemas.slug,

        // Location
        address: z.string().min(5).max(200),
        latitude: CommonSchemas.latitude,
        longitude: CommonSchemas.longitude,

        // Pricing - using PriceSchema from @repo/schemas
        basePrice: PriceSchema.shape.price,
        currency: PriceSchema.shape.currency,

        // Capacity
        maxGuests: CommonSchemas.positiveInt.max(20),
        bedrooms: CommonSchemas.positiveInt.max(10),
        bathrooms: CommonSchemas.positiveInt.max(10),

        // Amenities
        amenities: z.array(z.enum(AccommodationAmenities)),

        // Images
        images: z
            .array(
                z.object({
                    url: CommonSchemas.url,
                    alt: z.string().max(200),
                    order: CommonSchemas.nonNegativeInt
                })
            )
            .min(1)
            .max(20),

        // Contact
        contactEmail: CommonSchemas.email,
        contactPhone: CommonSchemas.phone.optional(),

        // Status
        isActive: z.boolean().default(true),
        isVerified: z.boolean().default(false)
    }),

    /**
     * Schema for updating an accommodation
     */
    update: z.object({
        id: AccommodationIdSchema,
        name: z.string().min(3).max(200).optional(),
        description: z.string().min(10).max(2000).optional(),
        basePrice: PriceSchema.shape.price.optional(),
        amenities: z.array(z.enum(AccommodationAmenities)).optional(),
        isActive: z.boolean().optional()
    }),

    /**
     * Schema for accommodation search with full-text search
     * Extends BaseSearchSchema from @repo/schemas
     */
    search: BaseSearchSchema.extend({
        q: CommonSchemas.searchQuery,
        type: z.enum(['accommodation', 'destination', 'all']).default('all'),

        // Override pagination to use offset/limit instead of page/pageSize
        limit: CommonSchemas.paginationLimit,
        offset: CommonSchemas.paginationOffset,

        // Location filters for search results
        destination: CommonSchemas.slug.optional(),
        accommodationType: z.enum(AccommodationTypes).optional(),

        // Language
        lang: CommonSchemas.languageCode.default('en')
    }).omit({ pagination: true }), // Remove the nested pagination object

    /**
     * Schema for getting accommodation availability
     */
    availability: z
        .object({
            id: AccommodationIdSchema,
            checkIn: CommonSchemas.date,
            checkOut: CommonSchemas.date,
            guests: CommonSchemas.positiveInt.max(20).default(2)
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
     * Schema for accommodation reviews (for future implementation)
     */
    review: z.object({
        accommodationId: AccommodationIdSchema,
        rating: CommonSchemas.rating,
        title: z.string().min(5).max(100),
        comment: z.string().min(10).max(1000),
        guestName: z.string().min(2).max(100),
        guestEmail: CommonSchemas.email,
        stayDate: CommonSchemas.date
    }),

    /**
     * Schema for accommodation booking (for future implementation)
     */
    booking: z.object({
        accommodationId: AccommodationIdSchema,
        checkIn: CommonSchemas.date,
        checkOut: CommonSchemas.date,
        guests: CommonSchemas.positiveInt.max(20),

        // Guest information
        guestName: z.string().min(2).max(100),
        guestEmail: CommonSchemas.email,
        guestPhone: CommonSchemas.phone,

        // Special requests
        specialRequests: z.string().max(500).optional(),

        // Pricing using PriceSchema from @repo/schemas
        totalPrice: PriceSchema.shape.price,
        currency: PriceSchema.shape.currency
    })
} as const;

// Export individual schemas for easier importing
export const { list, getById, search, create, update, availability } = AccommodationSchemas;

export default {
    AccommodationSchemas,
    AccommodationTypes,
    AccommodationAmenities
};
