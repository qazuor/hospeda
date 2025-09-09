import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AccommodationIdSchema, AmenityIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { AmenitiesTypeEnumSchema } from '../../enums/amenity-type.enum.schema.js';

/**
 * Amenity Schema - Main Entity Schema
 *
 * This schema represents an amenity entity that can be associated with accommodations.
 * Amenities are stored in a separate table and linked via r_accommodation_amenity.
 */
export const AmenitySchema = z.object({
    // Base fields
    id: AmenityIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Amenity-specific fields
    slug: z
        .string({
            message: 'zodError.amenity.slug.required'
        })
        .min(3, { message: 'zodError.amenity.slug.min' })
        .max(100, { message: 'zodError.amenity.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.amenity.slug.pattern'
        }),

    name: z
        .string({
            message: 'zodError.amenity.name.required'
        })
        .min(2, { message: 'zodError.amenity.name.min' })
        .max(100, { message: 'zodError.amenity.name.max' }),

    description: z
        .string({
            message: 'zodError.amenity.description.required'
        })
        .min(10, { message: 'zodError.amenity.description.min' })
        .max(500, { message: 'zodError.amenity.description.max' })
        .optional(),

    icon: z
        .string({
            message: 'zodError.amenity.icon.required'
        })
        .min(2, { message: 'zodError.amenity.icon.min' })
        .max(100, { message: 'zodError.amenity.icon.max' })
        .optional(),

    type: AmenitiesTypeEnumSchema,
    isBuiltin: z.boolean({ message: 'zodError.amenity.isBuiltin.required' }).default(false),
    isFeatured: z.boolean({ message: 'zodError.amenity.isFeatured.required' }).default(false)
});

/**
 * Accommodation-Amenity Relation Schema
 * Represents the many-to-many relationship between accommodations and amenities
 */
export const AccommodationAmenityRelationSchema = z.object({
    accommodationId: AccommodationIdSchema,
    amenityId: AmenityIdSchema,
    isOptional: z
        .boolean({ message: 'zodError.accommodationAmenity.isOptional.required' })
        .default(false),
    additionalCost: z
        .object({
            amount: z.number().positive({
                message: 'zodError.accommodationAmenity.additionalCost.amount.positive'
            }),
            currency: z
                .string({
                    message: 'zodError.accommodationAmenity.additionalCost.currency.required'
                })
                .min(3)
                .max(3) // ISO currency code
        })
        .optional(),
    additionalCostPercent: z
        .number({
            message: 'zodError.accommodationAmenity.additionalCostPercent.required'
        })
        .min(0, { message: 'zodError.accommodationAmenity.additionalCostPercent.min' })
        .max(100, { message: 'zodError.accommodationAmenity.additionalCostPercent.max' })
        .optional()
});

/**
 * Type exports for the main Amenity entity
 */
export type Amenity = z.infer<typeof AmenitySchema>;
export type AccommodationAmenityRelation = z.infer<typeof AccommodationAmenityRelationSchema>;
