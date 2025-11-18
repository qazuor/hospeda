import { z } from 'zod';
import { TouristServiceSchema } from './touristService.schema.js';

/**
 * Create Tourist Service Schema
 *
 * Schema for creating new tourist service entries. Excludes auto-generated fields
 * and provides sensible defaults for certain fields.
 */
export const CreateTouristServiceSchema = TouristServiceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});

/**
 * Update Tourist Service Schema
 *
 * Schema for updating existing tourist service entries. All fields are optional
 * to support partial updates, except clientId which cannot be changed.
 */
export const UpdateTouristServiceSchema = TouristServiceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    clientId: true // Cannot update client association
}).partial();

/**
 * Delete Tourist Service Schema
 *
 * Schema for soft-deleting tourist service entries with optional reason and metadata.
 */
export const DeleteTouristServiceSchema = z.object({
    reason: z
        .string()
        .min(1, { message: 'zodError.touristService.deleteReason.min' })
        .max(500, { message: 'zodError.touristService.deleteReason.max' })
        .optional(),

    metadata: z.record(z.string(), z.unknown()).optional()
});

/**
 * Type exports for Tourist Service CRUD operations
 */
export type CreateTouristService = z.infer<typeof CreateTouristServiceSchema>;
export type UpdateTouristService = z.infer<typeof UpdateTouristServiceSchema>;
export type DeleteTouristService = z.infer<typeof DeleteTouristServiceSchema>;
