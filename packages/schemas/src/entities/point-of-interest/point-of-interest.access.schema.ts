import type { z } from 'zod';
import { PoiCategoryPrimarySchema } from '../poi-category/poi-category.schema.js';
import { PointOfInterestSchema } from './point-of-interest.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public listing and detail pages.
 *
 * Picks specific fields from the full schema to ensure only public data is
 * exposed. `lat`/`long`/`type` are included in every tier — coordinates and
 * the landmark type are not sensitive data (HOS-113).
 */
export const PointOfInterestPublicSchema = PointOfInterestSchema.pick({
    // Identification
    id: true,
    slug: true,

    // Coordinates + taxonomy
    lat: true,
    long: true,
    type: true,

    // Content
    // HOS-142 G-6: `nameI18n` (HOS-138) is the canonical display-name source
    // (the legacy `destinations.poiNames.<slug>` i18n keys were removed) — not
    // sensitive data, same rationale as `lat`/`long`/`type` already being
    // public. Needed by the proximity-search POI-picker autocomplete, which
    // has nothing else to label its options with.
    nameI18n: true,
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: true
}).extend({
    /**
     * HOS-182: the POI's primary category (`{ slug, nameI18n }`), or `null`
     * when it has none — see `PointOfInterestSummarySchema`'s doc comment for
     * the full rationale. Public data, same tier as `type`.
     *
     * `.nullish()`, not `.nullable()`: only the nearby-POI endpoint
     * (`NearbyPoiSchema`, backed by `findWithinRadius`) populates this field.
     * The generic public list/getById/getBySlug routes also respond with
     * this exact schema but read via `BaseCrudService`'s plain queries, which
     * never set the key — a required `.nullable()` field would fail
     * `stripWithSchema`'s `safeParse` and 500 those routes.
     */
    primaryCategory: PoiCategoryPrimarySchema.nullish()
});

export type PointOfInterestPublic = z.infer<typeof PointOfInterestPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users.
 * Used for user dashboards and authenticated interactions.
 *
 * Extends public schema with additional fields.
 */
export const PointOfInterestProtectedSchema = PointOfInterestSchema.pick({
    // All public fields
    id: true,
    slug: true,
    lat: true,
    long: true,
    type: true,
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: true,

    // Lifecycle (for authenticated users)
    lifecycleState: true,

    // Basic audit (created/updated dates)
    createdAt: true,
    updatedAt: true
});

export type PointOfInterestProtected = z.infer<typeof PointOfInterestProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const PointOfInterestAdminSchema = PointOfInterestSchema;

export type PointOfInterestAdmin = z.infer<typeof PointOfInterestAdminSchema>;
