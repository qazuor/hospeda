import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { i18nText } from '../../common/i18n.schema.js';
import { AccommodationIdSchema, AmenityIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { PriceSchema } from '../../common/price.schema.js';
import { AmenityAvailabilityEnumSchema } from '../../enums/amenity-availability.schema.js';
import { AmenityScopeEnumSchema } from '../../enums/amenity-scope.schema.js';
import { AmenitiesTypeEnumSchema } from '../../enums/amenity-type.schema.js';

/**
 * Verticals that an amenity or feature can be applicable to.
 * Drives catalog-by-vertical filtering (SPEC-266).
 */
export const APPLICABLE_VERTICALS = ['accommodation', 'venue', 'experience'] as const;
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
    /** HOS-2084: paid separately ("Con cargo extra"); a flag, no amount. */
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
        .optional(),
    /**
     * Whether the amenity is private to the guest or shared (HOS-2058).
     * NULL means "not declared" -- never infer a value.
     */
    scope: AmenityScopeEnumSchema.nullish(),
    /**
     * Whether the amenity is available all year or only in season (HOS-2058).
     * NULL means "not declared" -- never infer a value.
     */
    availability: AmenityAvailabilityEnumSchema.nullish()
});
export type AccommodationAmenityRelation = z.infer<typeof AccommodationAmenityRelationSchema>;

/**
 * One amenity's relation attributes, as a listing owner writes them. ONE
 * standard for every vertical (HOS-2058 for accommodation, HOS-2061 for venue
 * and experience): the editors send the same shape to all three write paths.
 * `scope` / `availability` absent or `null` both mean "not declared".
 */
export const AmenityRelationAttributesSchema = z.object({
    amenityId: AmenityIdSchema,
    /** Private to the guest/customer, or shared. NULL = not declared. */
    scope: AmenityScopeEnumSchema.nullish(),
    /** Available all year, or only in season. NULL = not declared. */
    availability: AmenityAvailabilityEnumSchema.nullish(),
    /**
     * HOS-2084: "Con cargo extra" -- the amenity is paid separately. Maps to the
     * boolean `is_optional` column of the relation row. Omitted keeps the stored
     * value (merged per key); no amount is captured.
     */
    extraCharge: z.boolean().optional()
});
export type AmenityRelationAttributes = z.infer<typeof AmenityRelationAttributesSchema>;

/**
 * Write-only list of per-amenity relation attributes on a listing update
 * (HOS-2058, generalized to every vertical in HOS-2061). Contract, enforced by
 * the junction sync of each vertical:
 *
 * - `undefined` -> attributes of existing rows are left untouched;
 * - provided -> every amenity linked after the update gets exactly the listed
 *   values, and a linked amenity that is NOT listed is reset to NULL (not
 *   declared). An entry for an amenity that is not linked is rejected.
 *
 * Each `amenityId` may appear at most once.
 */
export const AmenityRelationAttributesListSchema = z
    .array(AmenityRelationAttributesSchema)
    .refine((items) => new Set(items.map((item) => item.amenityId)).size === items.length, {
        message: 'zodError.accommodationAmenity.attributes.duplicate'
    });
export type AmenityRelationAttributesList = z.infer<typeof AmenityRelationAttributesListSchema>;

/**
 * Accommodation alias of {@link AmenityRelationAttributesSchema} (HOS-2058).
 * Kept so existing accommodation call sites read naturally; it IS the shared
 * schema, never a second definition.
 */
export const AccommodationAmenityAttributesSchema = AmenityRelationAttributesSchema;
export type AccommodationAmenityAttributes = AmenityRelationAttributes;

/** Accommodation alias of {@link AmenityRelationAttributesListSchema} (HOS-2058). */
export const AccommodationAmenityAttributesListSchema = AmenityRelationAttributesListSchema;
export type AccommodationAmenityAttributesList = AmenityRelationAttributesList;

/**
 * Relation attribute columns shared by every amenity junction table
 * (`r_accommodation_amenity`, `r_venue_amenity`, `r_experience_amenity`).
 * HOS-2061 brought venue and experience to parity with accommodation.
 */
const AmenityRelationColumnsSchema = AccommodationAmenityRelationSchema.pick({
    isOptional: true,
    additionalCost: true,
    additionalCostPercent: true,
    scope: true,
    availability: true
});

/**
 * Venue-Amenity Relation Schema
 * Represents the many-to-many relationship between venue listings and amenities.
 * Same relation attributes as the accommodation variant (HOS-2061).
 */
export const VenueAmenityRelationSchema = z
    .object({
        venueId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        amenityId: AmenityIdSchema
    })
    .extend(AmenityRelationColumnsSchema.shape);
export type VenueAmenityRelation = z.infer<typeof VenueAmenityRelationSchema>;

/**
 * Experience-Amenity Relation Schema (SPEC-240)
 * Represents the many-to-many relationship between experience listings and amenities.
 * Same relation attributes as the accommodation variant (HOS-2061).
 */
export const ExperienceAmenityRelationSchema = z
    .object({
        experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        amenityId: AmenityIdSchema
    })
    .extend(AmenityRelationColumnsSchema.shape);
export type ExperienceAmenityRelation = z.infer<typeof ExperienceAmenityRelationSchema>;
