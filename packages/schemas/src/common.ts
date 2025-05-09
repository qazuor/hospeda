/**
 * Common schemas
 * @module schemas/common
 */

import { Status } from '@repo/types';
import { isValidEmail, isValidPhone, isValidUrl } from '@repo/utils';
import { z } from 'zod';

/**
 * Base entity schema
 */
export const baseEntitySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    displayName: z.string().min(1).max(200),
    createdAt: z.date(),
    updatedAt: z.date()
});

/**
 * Status schema
 */
export const statusSchema = z.nativeEnum(Status);

/**
 * Email schema
 */
export const emailSchema = z
    .string()
    .email()
    .refine((email) => isValidEmail(email), {
        message: 'Invalid email format'
    });

/**
 * Phone schema
 */
export const phoneSchema = z
    .string()
    .optional()
    .refine((phone) => !phone || isValidPhone(phone), {
        message: 'Invalid phone number format'
    });

/**
 * URL schema
 */
export const urlSchema = z
    .string()
    .optional()
    .refine((url) => !url || isValidUrl(url), {
        message: 'Invalid URL format'
    });

/**
 * Address schema
 */
export const addressSchema = z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(1).max(100)
});

/**
 * Contact info schema
 */
export const contactInfoSchema = z.object({
    email: emailSchema,
    phone: phoneSchema,
    address: addressSchema.optional()
});

/**
 * Social networks schema
 */
export const socialNetworksSchema = z.object({
    facebook: urlSchema,
    twitter: urlSchema,
    instagram: urlSchema,
    linkedin: urlSchema,
    website: urlSchema
});

/**
 * Coordinates schema
 */
export const coordinatesSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
});

/**
 * Price schema
 */
export const priceSchema = z.object({
    amount: z.number().positive(),
    currency: z.string().length(3)
});

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
    from: z.date(),
    to: z.date()
});
