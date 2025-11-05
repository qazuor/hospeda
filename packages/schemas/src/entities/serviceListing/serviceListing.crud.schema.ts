import { z } from 'zod';
import { ServiceListingIdSchema } from '../../common/id.schema.js';
import { ServiceListingSchema } from './serviceListing.schema.js';

/**
 * ServiceListingCreateInputSchema
 * For creating new service listings
 * Excludes: id, audit fields (createdAt, updatedAt, etc.)
 */
export const ServiceListingCreateInputSchema = ServiceListingSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
});
export type ServiceListingCreateInput = z.infer<typeof ServiceListingCreateInputSchema>;

/**
 * ServiceListingUpdateInputSchema
 * For updating service listings (PUT - full replacement)
 * Excludes: id, createdAt, createdById
 */
export const ServiceListingUpdateInputSchema = ServiceListingSchema.omit({
    id: true,
    createdAt: true,
    createdById: true
});
export type ServiceListingUpdateInput = z.infer<typeof ServiceListingUpdateInputSchema>;

/**
 * ServiceListingPatchInputSchema
 * For patching service listings (PATCH - partial update)
 * All fields optional except id
 */
export const ServiceListingPatchInputSchema = ServiceListingSchema.omit({
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
})
    .partial()
    .extend({
        id: ServiceListingIdSchema.optional()
    });
export type ServiceListingPatchInput = z.infer<typeof ServiceListingPatchInputSchema>;

/**
 * ServiceListingDeleteInputSchema
 * For soft deleting service listings
 */
export const ServiceListingDeleteInputSchema = z.object({
    id: ServiceListingIdSchema
});
export type ServiceListingDeleteInput = z.infer<typeof ServiceListingDeleteInputSchema>;

/**
 * ServiceListingRestoreInputSchema
 * For restoring soft-deleted service listings
 */
export const ServiceListingRestoreInputSchema = z.object({
    id: ServiceListingIdSchema
});
export type ServiceListingRestoreInput = z.infer<typeof ServiceListingRestoreInputSchema>;
