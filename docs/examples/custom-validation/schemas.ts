/**
 * Custom Validation Schemas
 *
 * This file demonstrates how to use custom validators from validators.ts
 * to create complex, reusable validation schemas for entities.
 *
 * Shows:
 * - Composing custom validators
 * - Schema refinements
 * - Custom error messages
 * - Type inference from schemas
 */

import { z } from 'zod';
import {
    ageValidator,
    argentinaCoordinatesValidator,
    coordinatesValidator,
    createDateRangeValidator,
    emailDomainValidator,
    futureDateValidator,
    generateSlug,
    httpsUrlValidator,
    optionalHttpsUrlValidator,
    percentageValidator,
    phoneNumberSchema,
    priceRangeValidator,
    priceValidator,
    slugValidator
} from './validators';

/**
 * Accommodation Location Schema
 *
 * Demonstrates:
 * - Using coordinates validator
 * - Refining coordinates to Argentina bounds
 * - Address validation
 */
export const AccommodationLocationSchema = z.object({
    address: z
        .string()
        .min(5, 'Address must be at least 5 characters')
        .max(500, 'Address cannot exceed 500 characters'),

    city: z.string().min(2, 'City name is required'),

    state: z.string().min(2, 'State name is required'),

    country: z.string().default('Argentina'),

    zipCode: z
        .string()
        .regex(/^\d{4}$/, 'Argentina zip code must be 4 digits')
        .optional(),

    coordinates: argentinaCoordinatesValidator
});

/**
 * Inferred type from schema
 */
export type AccommodationLocation = z.infer<typeof AccommodationLocationSchema>;

/**
 * Event Date Schema
 *
 * Demonstrates:
 * - Date range validation
 * - Future date validation
 * - Custom refinements
 */
export const EventDateSchema = z
    .object({
        startDate: futureDateValidator,

        endDate: futureDateValidator,

        registrationDeadline: futureDateValidator.optional(),

        isFreeEvent: z.boolean().default(false)
    })
    .refine(createDateRangeValidator('startDate', 'endDate'), {
        message: 'Event end date must be after start date',
        path: ['endDate']
    })
    .refine(
        (data) => {
            if (!data.registrationDeadline) return true;
            return data.registrationDeadline < data.startDate;
        },
        {
            message: 'Registration deadline must be before event start',
            path: ['registrationDeadline']
        }
    );

export type EventDate = z.infer<typeof EventDateSchema>;

/**
 * Contact Information Schema
 *
 * Demonstrates:
 * - Phone number validation
 * - Email domain validation (optional)
 * - HTTPS URL validation
 * - Social media validation
 */
export const ContactInfoSchema = z.object({
    phone: phoneNumberSchema,

    email: z.string().email('Invalid email format'),

    // Corporate email (optional - for business accounts)
    corporateEmail: z
        .string()
        .email()
        .refine(emailDomainValidator(['hospeda.com', 'turismo.gob.ar']), {
            message: 'Corporate email must be from approved domain'
        })
        .optional(),

    website: optionalHttpsUrlValidator,

    socialMedia: z
        .object({
            facebook: z
                .string()
                .regex(/^https:\/\/(www\.)?facebook\.com\/[\w.-]+$/, 'Invalid Facebook URL')
                .optional(),

            instagram: z
                .string()
                .regex(/^https:\/\/(www\.)?instagram\.com\/[\w.-]+$/, 'Invalid Instagram URL')
                .optional(),

            twitter: z
                .string()
                .regex(/^https:\/\/(www\.)?twitter\.com\/[\w.-]+$/, 'Invalid Twitter URL')
                .optional()
        })
        .optional()
});

export type ContactInfo = z.infer<typeof ContactInfoSchema>;

/**
 * Pricing Schema
 *
 * Demonstrates:
 * - Price validation
 * - Price range validation
 * - Discount percentage validation
 * - Conditional logic
 */
export const PricingSchema = z
    .object({
        basePrice: priceValidator,

        discountPercentage: percentageValidator.optional(),

        finalPrice: priceValidator.optional(),

        currency: z.enum(['ARS', 'USD']).default('ARS'),

        includesTaxes: z.boolean().default(true)
    })
    .refine(
        (data) => {
            // If discount is provided, final price must be less than base
            if (data.discountPercentage && data.finalPrice) {
                return data.finalPrice < data.basePrice;
            }
            return true;
        },
        {
            message: 'Final price must be less than base price when discount is applied',
            path: ['finalPrice']
        }
    )
    .refine(
        (data) => {
            // If discount is provided, verify final price calculation
            if (data.discountPercentage && data.finalPrice) {
                const expectedFinal = data.basePrice * (1 - data.discountPercentage / 100);
                const diff = Math.abs(expectedFinal - data.finalPrice);
                return diff < 0.01; // Allow 1 cent difference for rounding
            }
            return true;
        },
        {
            message: 'Final price does not match discount calculation',
            path: ['finalPrice']
        }
    );

export type Pricing = z.infer<typeof PricingSchema>;

/**
 * Search Filters Schema
 *
 * Demonstrates:
 * - Price range validation
 * - Date range validation
 * - Coordinates with radius
 */
export const AccommodationSearchSchema = z
    .object({
        // Text search
        query: z.string().min(2, 'Search query must be at least 2 characters').optional(),

        // Location filters
        city: z.string().optional(),

        coordinates: coordinatesValidator.optional(),

        radiusKm: z.number().min(1).max(100).optional(),

        // Capacity filters
        minGuests: z.number().int().min(1).optional(),

        maxGuests: z.number().int().min(1).optional()
    })
    .merge(priceRangeValidator)
    .refine(
        (data) => {
            // If coordinates provided, radius is required
            if (data.coordinates && !data.radiusKm) {
                return false;
            }
            return true;
        },
        {
            message: 'Radius is required when searching by coordinates',
            path: ['radiusKm']
        }
    )
    .refine(
        (data) => {
            // Min guests cannot exceed max guests
            if (data.minGuests && data.maxGuests) {
                return data.minGuests <= data.maxGuests;
            }
            return true;
        },
        {
            message: 'Minimum guests cannot exceed maximum guests',
            path: ['maxGuests']
        }
    );

export type AccommodationSearch = z.infer<typeof AccommodationSearchSchema>;

/**
 * User Profile Schema
 *
 * Demonstrates:
 * - Age validation
 * - Optional fields with constraints
 * - Slug generation
 */
export const UserProfileSchema = z
    .object({
        firstName: z.string().min(2, 'First name must be at least 2 characters'),

        lastName: z.string().min(2, 'Last name must be at least 2 characters'),

        birthdate: ageValidator(18, 120), // Must be 18-120 years old

        bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),

        username: slugValidator,

        avatar: httpsUrlValidator.optional(),

        verifiedHost: z.boolean().default(false)
    })
    .refine(
        (data) => {
            // Verified hosts must have a bio
            if (data.verifiedHost && !data.bio) {
                return false;
            }
            return true;
        },
        {
            message: 'Verified hosts must have a bio',
            path: ['bio']
        }
    );

export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Booking Schema
 *
 * Demonstrates:
 * - Complex date validation
 * - Multiple refinements
 * - Business logic validation
 */
export const BookingSchema = z
    .object({
        accommodationId: z.string().uuid(),

        userId: z.string().uuid(),

        checkIn: futureDateValidator,

        checkOut: futureDateValidator,

        guests: z.number().int().min(1, 'At least 1 guest required').max(20, 'Maximum 20 guests'),

        specialRequests: z.string().max(1000).optional(),

        totalPrice: priceValidator
    })
    .refine(createDateRangeValidator('checkIn', 'checkOut'), {
        message: 'Check-out must be after check-in',
        path: ['checkOut']
    })
    .refine(
        (data) => {
            // Minimum stay: 1 night
            const nights = Math.floor(
                (data.checkOut.getTime() - data.checkIn.getTime()) / (1000 * 60 * 60 * 24)
            );
            return nights >= 1;
        },
        {
            message: 'Minimum stay is 1 night',
            path: ['checkOut']
        }
    )
    .refine(
        (data) => {
            // Cannot book more than 1 year in advance
            const oneYearFromNow = new Date();
            oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
            return data.checkIn <= oneYearFromNow;
        },
        {
            message: 'Cannot book more than 1 year in advance',
            path: ['checkIn']
        }
    );

export type Booking = z.infer<typeof BookingSchema>;

/**
 * Slug Creation Schema with Transform
 *
 * Demonstrates:
 * - Using transform to auto-generate slug
 * - Conditional field generation
 */
export const CreateEntityWithSlugSchema = z
    .object({
        name: z.string().min(3, 'Name must be at least 3 characters'),

        slug: slugValidator.optional()
    })
    .transform((data) => ({
        ...data,
        // Auto-generate slug from name if not provided
        slug: data.slug || generateSlug(data.name)
    }));

export type CreateEntityWithSlug = z.infer<typeof CreateEntityWithSlugSchema>;

/**
 * Example usage in API route:
 *
 * import { zValidator } from '@hono/zod-validator';
 * import { BookingSchema } from './schemas';
 *
 * app.post('/bookings', zValidator('json', BookingSchema), async (c) => {
 *   const booking = c.req.valid('json'); // Type-safe!
 *   // Process booking...
 * });
 */

/**
 * Example usage in service:
 *
 * export class BookingService {
 *   async create(input: unknown) {
 *     // Validate with safe parse
 *     const result = BookingSchema.safeParse(input);
 *
 *     if (!result.success) {
 *       return {
 *         success: false,
 *         error: {
 *           code: 'VALIDATION_ERROR',
 *           message: 'Invalid booking data',
 *           details: result.error.format()
 *         }
 *       };
 *     }
 *
 *     // Use validated data
 *     const booking = result.data;
 *   }
 * }
 */
