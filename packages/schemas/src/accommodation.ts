/**
 * Accommodation schemas
 * @module schemas/accommodation
 */

import { AccommodationType } from '@repo/types';
import { z } from 'zod';
import {
    baseEntitySchema,
    contactInfoSchema,
    coordinatesSchema,
    dateRangeSchema,
    priceSchema,
    socialNetworksSchema,
    statusSchema
} from './common';

/**
 * Accommodation type schema
 */
export const accommodationTypeSchema = z.nativeEnum(AccommodationType);

/**
 * Price schema
 */
export const accommodationPriceSchema = priceSchema.extend({
    additionalFees: z
        .object({
            cleaning: z.number().nonnegative().optional(),
            service: z.number().nonnegative().optional(),
            taxPercentage: z.number().nonnegative().optional()
        })
        .optional(),
    discounts: z
        .object({
            weekly: z.number().nonnegative().max(100).optional(),
            monthly: z.number().nonnegative().max(100).optional(),
            lastMinute: z.number().nonnegative().max(100).optional()
        })
        .optional()
});

/**
 * Availability schema
 */
export const availabilitySchema = z.object({
    availableDates: z.array(dateRangeSchema),
    minimumStay: z.number().int().positive().optional(),
    maximumStay: z.number().int().positive().optional(),
    checkInTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .optional(),
    checkOutTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .optional()
});

/**
 * Accommodation schema
 */
export const accommodationSchema = baseEntitySchema.extend({
    type: accommodationTypeSchema,
    status: statusSchema,
    description: z.string().min(10).max(5000),
    contactInfo: contactInfoSchema,
    socialNetworks: socialNetworksSchema.optional(),
    price: priceSchema,
    availability: availabilitySchema,
    ownerId: z.string().uuid(),
    location: coordinatesSchema,
    amenities: z.array(z.string()),
    images: z.array(z.string().url())
});

/**
 * Accommodation creation schema
 */
export const accommodationCreateSchema = accommodationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Accommodation update schema
 */
export const accommodationUpdateSchema = accommodationSchema
    .omit({
        id: true,
        createdAt: true,
        updatedAt: true,
        ownerId: true
    })
    .partial();

/**
 * Accommodation search schema
 */
export const accommodationSearchSchema = z.object({
    type: accommodationTypeSchema.optional(),
    location: z
        .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            radius: z.number().positive()
        })
        .optional(),
    dateRange: dateRangeSchema.optional(),
    priceRange: z
        .object({
            min: z.number().nonnegative(),
            max: z.number().positive()
        })
        .optional(),
    amenities: z.array(z.string()).optional(),
    guests: z.number().int().positive().optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().positive().optional(),
    sortBy: z.enum(['price', 'rating', 'distance']).optional(),
    sortDirection: z.enum(['asc', 'desc']).optional()
});
