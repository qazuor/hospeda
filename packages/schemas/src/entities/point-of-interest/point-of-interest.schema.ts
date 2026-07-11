import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { PointOfInterestIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { PointOfInterestTypeEnumSchema } from '../../enums/point-of-interest-type.schema.js';

/**
 * Point Of Interest Schema - Main entity schema for points of interest (POIs)
 *
 * Represents a coordinate-bearing landmark (HOS-113) associated with one or
 * more destinations via the `r_destination_point_of_interest` join table
 * (many-to-many — HOS-113 OQ-1). Unlike `attractions`, POIs carry **no
 * `name` column** (HOS-113 OQ-2): display names resolve via `@repo/i18n`
 * keyed by `slug` (`destinations.poiNames.<slug>`), mirroring the
 * amenities/features i18n-by-slug pattern (SPEC-266).
 */
export const PointOfInterestSchema = z.object({
    // Base fields
    id: PointOfInterestIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Point of interest-specific fields

    /**
     * The i18n key used to resolve the POI's display name via `@repo/i18n`
     * (`destinations.poiNames.<slug>`). Always provided by seed — there is
     * NO `name` column (HOS-113 OQ-2). Regex allows underscores, mirroring
     * the SPEC-266 amenity/feature slug discipline.
     */
    slug: z
        .string({
            message: 'zodError.pointOfInterest.slug.required'
        })
        .min(3, { message: 'zodError.pointOfInterest.slug.min' })
        .max(100, { message: 'zodError.pointOfInterest.slug.max' })
        .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
            message: 'zodError.pointOfInterest.slug.pattern'
        }),

    /**
     * Latitude in decimal degrees (WGS84). Plain numeric field — no
     * string/JSONB coordinate baggage (HOS-113 R-3), matching the
     * `double precision` DB column.
     */
    lat: z
        .number({ message: 'zodError.pointOfInterest.lat.required' })
        .min(-90, { message: 'zodError.pointOfInterest.lat.min' })
        .max(90, { message: 'zodError.pointOfInterest.lat.max' }),

    /**
     * Longitude in decimal degrees (WGS84). Plain numeric field, key named
     * `long` for consistency with `@repo/db`'s `geo.ts` helpers.
     */
    long: z
        .number({ message: 'zodError.pointOfInterest.long.required' })
        .min(-180, { message: 'zodError.pointOfInterest.long.min' })
        .max(180, { message: 'zodError.pointOfInterest.long.max' }),

    /** Closed landmark taxonomy (HOS-113 OQ-3). */
    type: PointOfInterestTypeEnumSchema,

    description: z
        .string({
            message: 'zodError.pointOfInterest.description.required'
        })
        .min(10, { message: 'zodError.pointOfInterest.description.min' })
        .max(500, { message: 'zodError.pointOfInterest.description.max' })
        .nullish(),

    icon: z
        .string({
            message: 'zodError.pointOfInterest.icon.required'
        })
        .min(1, { message: 'zodError.pointOfInterest.icon.min' })
        .max(100, { message: 'zodError.pointOfInterest.icon.max' })
        .nullish(),

    isFeatured: z.boolean().default(false),

    isBuiltin: z.boolean().default(false),

    displayWeight: z
        .number({ message: 'zodError.pointOfInterest.displayWeight.required' })
        .int({ message: 'zodError.pointOfInterest.displayWeight.int' })
        .min(1, { message: 'zodError.pointOfInterest.displayWeight.min' })
        .max(100, { message: 'zodError.pointOfInterest.displayWeight.max' })
        .default(50)
});

/**
 * Point Of Interest Summary Schema - Lightweight version for lists and relations
 * Contains only essential fields for display purposes
 */
export const PointOfInterestSummarySchema = PointOfInterestSchema.pick({
    id: true,
    slug: true,
    lat: true,
    long: true,
    type: true,
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: true
});

/**
 * Point Of Interest Mini Schema - Minimal version for dropdowns and references
 * Contains only the most basic identifying information
 */
export const PointOfInterestMiniSchema = PointOfInterestSchema.pick({
    id: true,
    slug: true,
    lat: true,
    long: true,
    type: true,
    icon: true
});

/**
 * Type exports
 */
export type PointOfInterest = z.infer<typeof PointOfInterestSchema>;
export type PointOfInterestSummary = z.infer<typeof PointOfInterestSummarySchema>;
export type PointOfInterestMini = z.infer<typeof PointOfInterestMiniSchema>;
