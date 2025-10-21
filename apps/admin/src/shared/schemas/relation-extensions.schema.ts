import { z } from 'zod';

/**
 * Relation Extensions Schema
 *
 * Common relation extensions used across admin entities.
 * These represent expanded relation objects that include essential fields
 * for admin UI display and management.
 */

/**
 * Owner Extension Schema
 *
 * Used when admin needs to show owner information in entity lists/details.
 * Provides essential user information without loading full user entity.
 */
export const OwnerExtensionSchema = z.object({
    owner: z
        .object({
            id: z.string(),
            displayName: z.string(),
            role: z.string().optional()
        })
        .nullable()
        .optional()
});

/**
 * Destination Extension Schema
 *
 * Used when admin needs to show destination information in entity lists.
 * Provides essential destination fields for navigation and display.
 */
export const DestinationExtensionSchema = z.object({
    destination: z
        .object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
            country: z.string().optional()
        })
        .nullable()
        .optional()
});

/**
 * Event Extension Schema
 *
 * Used when admin needs to show event information in related entities.
 * Provides essential event fields for display purposes.
 */
export const EventExtensionSchema = z.object({
    event: z
        .object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
            startDate: z.string().optional(),
            endDate: z.string().optional()
        })
        .nullable()
        .optional()
});

/**
 * Category Extension Schema
 *
 * Generic category relation used by features, amenities, etc.
 */
export const CategoryExtensionSchema = z.object({
    category: z
        .object({
            id: z.string(),
            name: z.string(),
            slug: z.string()
        })
        .nullable()
        .optional()
});

// Type exports
export type OwnerExtension = z.infer<typeof OwnerExtensionSchema>;
export type DestinationExtension = z.infer<typeof DestinationExtensionSchema>;
export type EventExtension = z.infer<typeof EventExtensionSchema>;
export type CategoryExtension = z.infer<typeof CategoryExtensionSchema>;
