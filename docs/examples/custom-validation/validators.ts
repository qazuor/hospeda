/**
 * Custom Zod Validators
 *
 * This file contains reusable custom Zod validators for common validation patterns
 * used throughout the Hospeda platform. These validators can be composed into schemas
 * to ensure data consistency and validation across the application.
 *
 * Usage:
 * import { dateRangeValidator, slugValidator } from './validators';
 *
 * const schema = z.object({
 *   startDate: z.date(),
 *   endDate: z.date(),
 *   slug: slugValidator
 * }).refine(dateRangeValidator);
 */

import { z } from 'zod';

/**
 * Date Range Validator
 *
 * Validates that a start date is before an end date.
 * Used for bookings, events, subscriptions, etc.
 *
 * @example
 * const schema = z.object({
 *   checkIn: z.date(),
 *   checkOut: z.date()
 * }).refine(
 *   (data) => dateRangeValidator(data.checkIn, data.checkOut),
 *   { message: 'Check-out must be after check-in', path: ['checkOut'] }
 * );
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @returns true if valid, false otherwise
 */
export const dateRangeValidator = (startDate: Date, endDate: Date): boolean => {
    return startDate < endDate;
};

/**
 * Date range validator factory
 * Returns a refinement function for use with Zod schemas
 */
export const createDateRangeValidator = (startField: string, endField: string) => {
    return (data: Record<string, any>) => {
        const start = data[startField];
        const end = data[endField];

        if (!start || !end) return true; // Skip if either is missing

        return dateRangeValidator(start, end);
    };
};

/**
 * Email Domain Validator
 *
 * Validates that an email belongs to specific allowed domains.
 * Useful for corporate email restrictions or partner integrations.
 *
 * @example
 * const corporateEmailSchema = z.string().email().refine(
 *   emailDomainValidator(['company.com', 'partner.com']),
 *   { message: 'Email must be from company.com or partner.com' }
 * );
 *
 * @param allowedDomains - Array of allowed email domains
 * @returns Validator function
 */
export const emailDomainValidator = (allowedDomains: string[]) => {
    return (email: string): boolean => {
        const domain = email.split('@')[1];
        return allowedDomains.includes(domain);
    };
};

/**
 * Argentina Phone Number Validator
 *
 * Validates phone numbers in Argentina format.
 * Accepts formats:
 * - +54 9 11 1234-5678 (with country code and area code)
 * - +54 9 11 12345678
 * - 11 1234-5678 (local format)
 * - 1112345678
 *
 * @example
 * const phoneSchema = z.string().refine(
 *   phoneNumberValidator,
 *   { message: 'Invalid Argentina phone number format' }
 * );
 */
export const phoneNumberValidator = (phone: string): boolean => {
    // Remove spaces and hyphens for validation
    const cleaned = phone.replace(/[\s-]/g, '');

    // Pattern 1: +54 9 XX XXXXXXXX (with country code)
    const withCountryCode = /^\+549\d{10}$/;

    // Pattern 2: 0XX XXXXXXXX (local format with area code)
    const localWithArea = /^0\d{10}$/;

    // Pattern 3: XX XXXXXXXX (area code + number)
    const areaAndNumber = /^\d{10}$/;

    return (
        withCountryCode.test(cleaned) || localWithArea.test(cleaned) || areaAndNumber.test(cleaned)
    );
};

/**
 * Phone number Zod schema with validation
 */
export const phoneNumberSchema = z
    .string()
    .min(10, 'Phone number is too short')
    .max(20, 'Phone number is too long')
    .refine(phoneNumberValidator, {
        message: 'Invalid Argentina phone number format. Use format: +54 9 11 1234-5678'
    });

/**
 * Slug Validator
 *
 * Validates URL-friendly slugs (lowercase letters, numbers, hyphens only).
 * Used for entity URLs like /destinations/concepcion-del-uruguay
 *
 * Rules:
 * - Lowercase letters and numbers only
 * - Hyphens allowed between words
 * - No consecutive hyphens
 * - Cannot start or end with hyphen
 * - Minimum 2 characters
 *
 * @example
 * const schema = z.object({
 *   slug: slugValidator
 * });
 *
 * // Valid: "buenos-aires", "hotel-5-stars", "playa-norte"
 * // Invalid: "Buenos-Aires", "hotel--5", "-playa", "hotel_5"
 */
export const slugValidator = z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(255, 'Slug cannot exceed 255 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message:
            'Slug must be lowercase letters and numbers, with hyphens between words (e.g., "buenos-aires")'
    })
    .refine((slug) => !slug.startsWith('-') && !slug.endsWith('-'), {
        message: 'Slug cannot start or end with a hyphen'
    })
    .refine((slug) => !slug.includes('--'), {
        message: 'Slug cannot contain consecutive hyphens'
    });

/**
 * Slug generator helper
 * Converts any string into a valid slug
 */
export const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD') // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s-]/g, '') // Remove invalid characters
        .trim()
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Price Validator
 *
 * Validates monetary values:
 * - Must be positive
 * - Maximum 2 decimal places
 * - Reasonable range (0.01 to 1,000,000)
 *
 * @example
 * const priceSchema = priceValidator;
 *
 * // Valid: 100, 99.99, 0.01
 * // Invalid: -10, 99.999, 0, 1000001
 */
export const priceValidator = z
    .number({
        required_error: 'Price is required',
        invalid_type_error: 'Price must be a number'
    })
    .positive('Price must be greater than 0')
    .min(0.01, 'Price must be at least 0.01')
    .max(1_000_000, 'Price cannot exceed 1,000,000')
    .refine((price) => {
        // Check for max 2 decimal places
        const decimals = (price.toString().split('.')[1] || '').length;
        return decimals <= 2;
    }, 'Price cannot have more than 2 decimal places');

/**
 * Price range validator for min/max price filters
 */
export const priceRangeValidator = z
    .object({
        minPrice: priceValidator.optional(),
        maxPrice: priceValidator.optional()
    })
    .refine(
        (data) => {
            if (!data.minPrice || !data.maxPrice) return true;
            return data.minPrice < data.maxPrice;
        },
        {
            message: 'Minimum price must be less than maximum price',
            path: ['maxPrice']
        }
    );

/**
 * Geographic Coordinates Validator
 *
 * Validates latitude and longitude coordinates.
 * - Latitude: -90 to 90
 * - Longitude: -180 to 180
 * - Precision: up to 6 decimal places (accurate to ~0.1m)
 *
 * @example
 * const locationSchema = coordinatesValidator;
 *
 * // Valid: { lat: -32.4827, lng: -58.2388 } (Concepción del Uruguay)
 * // Invalid: { lat: 91, lng: 0 } (out of range)
 */
export const coordinatesValidator = z.object({
    lat: z
        .number({
            required_error: 'Latitude is required',
            invalid_type_error: 'Latitude must be a number'
        })
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .refine((lat) => {
            const decimals = (lat.toString().split('.')[1] || '').length;
            return decimals <= 6;
        }, 'Latitude cannot have more than 6 decimal places'),

    lng: z
        .number({
            required_error: 'Longitude is required',
            invalid_type_error: 'Longitude must be a number'
        })
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .refine((lng) => {
            const decimals = (lng.toString().split('.')[1] || '').length;
            return decimals <= 6;
        }, 'Longitude cannot have more than 6 decimal places')
});

/**
 * Argentina coordinates validator
 * Validates that coordinates are within Argentina's bounds
 */
export const argentinaCoordinatesValidator = coordinatesValidator.refine(
    (coords) => {
        // Argentina rough bounding box
        const bounds = {
            minLat: -55.0,
            maxLat: -21.0,
            minLng: -73.0,
            maxLng: -53.0
        };

        return (
            coords.lat >= bounds.minLat &&
            coords.lat <= bounds.maxLat &&
            coords.lng >= bounds.minLng &&
            coords.lng <= bounds.maxLng
        );
    },
    {
        message: 'Coordinates must be within Argentina'
    }
);

/**
 * URL Validator with protocol
 *
 * Validates URLs and ensures they use HTTPS (for security)
 *
 * @example
 * const websiteSchema = httpsUrlValidator;
 *
 * // Valid: "https://example.com", "https://hospeda.com/about"
 * // Invalid: "http://example.com", "example.com", "ftp://example.com"
 */
export const httpsUrlValidator = z
    .string()
    .url('Must be a valid URL')
    .refine((url) => url.startsWith('https://'), {
        message: 'URL must use HTTPS protocol for security'
    });

/**
 * Optional URL validator (allows https or empty)
 */
export const optionalHttpsUrlValidator = z
    .string()
    .optional()
    .refine(
        (url) => {
            if (!url) return true;
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'https:';
            } catch {
                return false;
            }
        },
        {
            message: 'URL must use HTTPS protocol'
        }
    );

/**
 * Future Date Validator
 *
 * Validates that a date is in the future.
 * Useful for event dates, booking dates, etc.
 *
 * @example
 * const eventSchema = z.object({
 *   eventDate: futureDateValidator
 * });
 */
export const futureDateValidator = z.date().refine(
    (date) => date > new Date(),
    {
        message: 'Date must be in the future'
    }
);

/**
 * Past Date Validator
 *
 * Validates that a date is in the past.
 * Useful for birthdates, historical events, etc.
 */
export const pastDateValidator = z.date().refine(
    (date) => date < new Date(),
    {
        message: 'Date must be in the past'
    }
);

/**
 * Age Validator
 *
 * Validates that a birthdate corresponds to a specific age range
 *
 * @param minAge - Minimum age required
 * @param maxAge - Maximum age allowed (optional)
 */
export const ageValidator = (minAge: number, maxAge?: number) => {
    return z.date().refine(
        (birthdate) => {
            const today = new Date();
            const age = Math.floor((today.getTime() - birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

            if (maxAge !== undefined) {
                return age >= minAge && age <= maxAge;
            }

            return age >= minAge;
        },
        {
            message: maxAge
                ? `Age must be between ${minAge} and ${maxAge} years`
                : `Must be at least ${minAge} years old`
        }
    );
};

/**
 * Percentage Validator
 *
 * Validates percentage values (0-100)
 *
 * @example
 * const discountSchema = z.object({
 *   discount: percentageValidator
 * });
 */
export const percentageValidator = z
    .number()
    .min(0, 'Percentage cannot be negative')
    .max(100, 'Percentage cannot exceed 100')
    .refine((pct) => {
        const decimals = (pct.toString().split('.')[1] || '').length;
        return decimals <= 2;
    }, 'Percentage cannot have more than 2 decimal places');
