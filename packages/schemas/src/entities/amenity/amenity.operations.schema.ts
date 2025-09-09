import { z } from 'zod';
import { AmenitiesTypeEnumSchema } from '../../enums/amenity-type.enum.schema.js';
import { AmenitySchema } from './amenity.schema.js';

/**
 * Amenity Operations Schemas
 *
 * This file contains all CRUD and operational schemas derived from
 * the main AmenitySchema for different use cases.
 */

/**
 * Schema for creating a new amenity
 * Omits server-generated fields
 */
export const AmenityCreateSchema = AmenitySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    // Slug is optional on create (auto-generated from name)
    slug: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional()
});

/**
 * Schema for updating an existing amenity
 * All fields are optional for partial updates
 */
export const AmenityUpdateSchema = AmenityCreateSchema.partial();

/**
 * Schema for viewing amenity details
 * Same as the main schema, used for clarity in API responses
 */
export const AmenityViewSchema = AmenitySchema;

/**
 * Schema for amenity list items
 * Contains only essential fields for list displays
 */
export const AmenityListItemSchema = AmenitySchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    type: true,
    isBuiltin: true,
    isFeatured: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for amenity search and filtering
 * Contains search criteria and filter options
 */
export const AmenitySearchSchema = z.object({
    filters: z
        .object({
            name: z.string().optional(),
            slug: z.string().optional(),
            type: AmenitiesTypeEnumSchema.optional(),
            isFeatured: z.boolean().optional(),
            isBuiltin: z.boolean().optional(),
            lifecycleState: z.string().optional()
        })
        .optional(),
    pagination: z
        .object({
            page: z.number().int().min(1).default(1),
            pageSize: z.number().int().min(1).max(100).default(20)
        })
        .optional()
});

/**
 * Schema for amenity summary
 * Lightweight version for cards and previews
 */
export const AmenitySummarySchema = AmenitySchema.pick({
    id: true,
    slug: true,
    name: true,
    icon: true,
    type: true,
    isFeatured: true
});

/**
 * Type exports for all operation schemas
 */
export type AmenityCreate = z.infer<typeof AmenityCreateSchema>;
export type AmenityUpdate = z.infer<typeof AmenityUpdateSchema>;
export type AmenityView = z.infer<typeof AmenityViewSchema>;
export type AmenityListItem = z.infer<typeof AmenityListItemSchema>;
export type AmenitySearch = z.infer<typeof AmenitySearchSchema>;
export type AmenitySummary = z.infer<typeof AmenitySummarySchema>;
