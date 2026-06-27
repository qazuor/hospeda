import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { i18nText } from '../../common/i18n.schema.js';
import { AccommodationIdSchema, AmenityIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { PriceSchema } from '../../common/price.schema.js';
import { AmenitiesTypeEnumSchema } from '../../enums/amenity-type.schema.js';

/**
 * Verticals that an amenity or feature can be applicable to.
 * Drives catalog-by-vertical filtering (SPEC-266).
 */
export const APPLICABLE_VERTICALS = ['accommodation', 'gastronomy', 'experience'] as const;
export type ApplicableVertical = (typeof APPLICABLE_VERTICALS)[number];

/** Zod schema for a single applicable vertical. */
export const ApplicableVerticalSchema = z.enum(APPLICABLE_VERTICALS);

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
        .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
            message: 'zodError.amenity.slug.pattern'
        })
        .nullish(),

    description: i18nText({ min: 10, max: 500 }).nullish(),

    /**
     * Verticals this amenity is applicable to (SPEC-266).
     * At least one vertical required. NOT NULL in DB.
     */
    applicableVerticals: z
        .array(ApplicableVerticalSchema, {
            message: 'zodError.amenity.applicableVerticals.required'
        })
        .min(1, { message: 'zodError.amenity.applicableVerticals.min' }),

    icon: z
        .string({
            message: 'zodError.amenity.icon.required'
        })
        .min(2, { message: 'zodError.amenity.icon.min' })
        .max(100, { message: 'zodError.amenity.icon.max' })
        .nullish(),

    type: AmenitiesTypeEnumSchema,
    isBuiltin: z.boolean({ message: 'zodError.amenity.isBuiltin.required' }).default(false),
    isFeatured: z.boolean({ message: 'zodError.amenity.isFeatured.required' }).default(false),
    displayWeight: z
        .number({ message: 'zodError.amenity.displayWeight.required' })
        .int({ message: 'zodError.amenity.displayWeight.int' })
        .min(1, { message: 'zodError.amenity.displayWeight.min' })
        .max(100, { message: 'zodError.amenity.displayWeight.max' })
        .default(50)
});
export type Amenity = z.infer<typeof AmenitySchema>;

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
    additionalCost: PriceSchema.optional(),
    additionalCostPercent: z
        .number({
            message: 'zodError.accommodationAmenity.additionalCostPercent.required'
        })
        .min(0, { message: 'zodError.accommodationAmenity.additionalCostPercent.min' })
        .max(100, { message: 'zodError.accommodationAmenity.additionalCostPercent.max' })
        .optional()
});
export type AccommodationAmenityRelation = z.infer<typeof AccommodationAmenityRelationSchema>;

/**
 * Gastronomy-Amenity Relation Schema
 * Represents the many-to-many relationship between gastronomy listings and amenities.
 * Simpler than the accommodation variant: no pricing or optional-cost fields.
 */
export const GastronomyAmenityRelationSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    amenityId: AmenityIdSchema
});
export type GastronomyAmenityRelation = z.infer<typeof GastronomyAmenityRelationSchema>;

/**
 * Experience-Amenity Relation Schema (SPEC-240)
 * Represents the many-to-many relationship between experience listings and amenities.
 * Mirrors GastronomyAmenityRelationSchema: no pricing or optional-cost fields.
 */
export const ExperienceAmenityRelationSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    amenityId: AmenityIdSchema
});
export type ExperienceAmenityRelation = z.infer<typeof ExperienceAmenityRelationSchema>;
