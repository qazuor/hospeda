/**
 * HTTP Field Factory - Reduces boilerplate for common HTTP query parameters
 *
 * This factory creates standardized HTTP field definitions with consistent
 * validation, coercion, and OpenAPI metadata.
 */
import { z } from 'zod';

/**
 * Common numeric range validators
 */
export const HttpFieldFactories = {
    /**
     * Creates a standardized price field with coercion and validation
     */
    priceField: (
        options: { min?: number; max?: number; field: 'min' | 'max' } = { field: 'min' }
    ) =>
        z.coerce
            .number()
            .min(options.min ?? 0, { message: `zodError.common.${options.field}Price.tooLow` })
            .max(options.max ?? 1000000, {
                message: `zodError.common.${options.field}Price.tooHigh`
            })
            .optional(),

    /**
     * Creates a standardized guest count field
     */
    guestField: (
        options: { min?: number; max?: number; field: 'min' | 'max' } = { field: 'min' }
    ) =>
        z.coerce
            .number()
            .int()
            .min(options.min ?? 1, { message: `zodError.common.${options.field}Guests.tooLow` })
            .max(options.max ?? 50, { message: `zodError.common.${options.field}Guests.tooHigh` })
            .optional(),

    /**
     * Creates a standardized room count field (bedrooms, bathrooms)
     */
    roomField: (options: { min?: number; max?: number; field: string }) =>
        z.coerce
            .number()
            .int()
            .min(options.min ?? 0, { message: `zodError.common.${options.field}.tooLow` })
            .max(options.max ?? 20, { message: `zodError.common.${options.field}.tooHigh` })
            .optional(),

    /**
     * Creates a standardized rating field
     */
    ratingField: (
        options: { min?: number; max?: number; field: 'min' | 'max' } = { field: 'min' }
    ) =>
        z.coerce
            .number()
            .min(options.min ?? 0, { message: `zodError.common.${options.field}Rating.tooLow` })
            .max(options.max ?? 5, { message: `zodError.common.${options.field}Rating.tooHigh` })
            .optional(),

    /**
     * Creates a standardized coordinate field (latitude/longitude)
     */
    coordinateField: (type: 'latitude' | 'longitude') => {
        const bounds = type === 'latitude' ? { min: -90, max: 90 } : { min: -180, max: 180 };
        return z.coerce
            .number()
            .min(bounds.min, { message: `zodError.common.${type}.tooLow` })
            .max(bounds.max, { message: `zodError.common.${type}.tooHigh` })
            .optional();
    },

    /**
     * Creates a standardized distance field (radius in kilometers)
     */
    distanceField: (options: { max?: number } = {}) =>
        z.coerce
            .number()
            .positive({ message: 'zodError.common.distance.mustBePositive' })
            .max(options.max ?? 1000, { message: 'zodError.common.distance.tooHigh' })
            .optional(),

    /**
     * Creates a standardized date field with coercion
     */
    dateField: (fieldName: string) =>
        z.coerce.date({ message: `zodError.common.${fieldName}.invalidDate` }).optional(),

    /**
     * Creates a standardized boolean field with coercion
     */
    booleanField: (fieldName: string) =>
        z.coerce.boolean({ message: `zodError.common.${fieldName}.invalidBoolean` }).optional(),

    /**
     * Creates a standardized age field
     */
    ageField: (options: { min?: number; max?: number; field: 'min' | 'max' } = { field: 'min' }) =>
        z.coerce
            .number()
            .int()
            .min(options.min ?? 13, { message: `zodError.common.${options.field}Age.tooLow` })
            .max(options.max ?? 120, { message: `zodError.common.${options.field}Age.tooHigh` })
            .optional(),

    /**
     * Creates a standardized comma-separated array field
     */
    arrayField: () =>
        z
            .string()
            .transform((val) => val.split(',').filter(Boolean))
            .optional(),

    /**
     * Creates a UUID array field from comma-separated string
     */
    uuidArrayField: () =>
        z
            .string()
            .transform((val) => val.split(',').filter(Boolean))
            .pipe(z.array(z.string().uuid()))
            .optional()
};

/**
 * Convenience object with pre-configured common fields
 */
export const CommonHttpFields = {
    // Price fields
    minPrice: () => HttpFieldFactories.priceField({ field: 'min' }),
    maxPrice: () => HttpFieldFactories.priceField({ field: 'max' }),

    // Guest fields
    minGuests: () => HttpFieldFactories.guestField({ field: 'min' }),
    maxGuests: () => HttpFieldFactories.guestField({ field: 'max' }),

    // Room fields
    minBedrooms: () => HttpFieldFactories.roomField({ field: 'minBedrooms' }),
    maxBedrooms: () => HttpFieldFactories.roomField({ field: 'maxBedrooms' }),
    minBathrooms: () => HttpFieldFactories.roomField({ field: 'minBathrooms' }),
    maxBathrooms: () => HttpFieldFactories.roomField({ field: 'maxBathrooms' }),

    // Rating fields
    minRating: () => HttpFieldFactories.ratingField({ field: 'min' }),
    maxRating: () => HttpFieldFactories.ratingField({ field: 'max' }),

    // Location fields
    latitude: () => HttpFieldFactories.coordinateField('latitude'),
    longitude: () => HttpFieldFactories.coordinateField('longitude'),
    radius: () => HttpFieldFactories.distanceField(),

    // Date fields
    createdAfter: () => HttpFieldFactories.dateField('createdAfter'),
    createdBefore: () => HttpFieldFactories.dateField('createdBefore'),
    checkIn: () => HttpFieldFactories.dateField('checkIn'),
    checkOut: () => HttpFieldFactories.dateField('checkOut'),
    lastLoginAfter: () => HttpFieldFactories.dateField('lastLoginAfter'),
    lastLoginBefore: () => HttpFieldFactories.dateField('lastLoginBefore'),

    // Boolean fields
    isActive: () => HttpFieldFactories.booleanField('isActive'),
    isFeatured: () => HttpFieldFactories.booleanField('isFeatured'),
    isAvailable: () => HttpFieldFactories.booleanField('isAvailable'),
    isEmailVerified: () => HttpFieldFactories.booleanField('isEmailVerified'),
    hasActiveSubscription: () => HttpFieldFactories.booleanField('hasActiveSubscription'),
    hasAccommodations: () => HttpFieldFactories.booleanField('hasAccommodations'),

    // Age fields
    minAge: () => HttpFieldFactories.ageField({ field: 'min' }),
    maxAge: () => HttpFieldFactories.ageField({ field: 'max' }),

    // Array fields
    amenities: () => HttpFieldFactories.uuidArrayField(),
    tags: () => HttpFieldFactories.arrayField()
};
