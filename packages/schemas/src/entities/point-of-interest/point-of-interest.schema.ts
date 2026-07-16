import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { PartialI18nTextSchema, TranslationMetaSchema } from '../../common/i18n.schema.js';
import { PointOfInterestIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { PointOfInterestTypeEnumSchema } from '../../enums/point-of-interest-type.schema.js';
import { PoiCategoryPrimarySchema } from '../poi-category/poi-category.schema.js';

/**
 * Point Of Interest Schema - Main entity schema for points of interest (POIs)
 *
 * Represents a landmark (HOS-113) associated with one or more destinations
 * via the `r_destination_point_of_interest` join table (many-to-many —
 * HOS-113 OQ-1).
 *
 * HOS-138 (POI v2): display names/descriptions moved to admin-editable
 * multilang content (`nameI18n`/`descriptionI18n`, SPEC-212 `I18nText`) as the
 * single source — the legacy `@repo/i18n` `destinations.poiNames.<slug>` keys
 * were removed in HOS-138 (spec §6.1). Coordinates (`lat`/`long`) are nullable
 * — a coordinate-less POI is valid (§6.2). `type` is deprecated-transitional
 * pending the HOS-139 category model.
 */
export const PointOfInterestSchema = z.object({
    // Base fields
    id: PointOfInterestIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Point of interest-specific fields

    /**
     * Stable identifier for the POI (also the source of the humanized-slug
     * fallback for a display name when `nameI18n` is absent). There is NO
     * `name` column (HOS-113 OQ-2); display names come from `nameI18n`
     * (HOS-138 removed the legacy `destinations.poiNames.<slug>` i18n keys).
     * Regex allows underscores, mirroring the SPEC-266 amenity/feature slug
     * discipline.
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
     * `double precision` DB column. HOS-138: nullable — 78% of the v2 dataset
     * has no coordinates yet (spec §6.2). Consumers must treat null as "no
     * coordinate, not an error".
     */
    lat: z
        .number({ message: 'zodError.pointOfInterest.lat.required' })
        .min(-90, { message: 'zodError.pointOfInterest.lat.min' })
        .max(90, { message: 'zodError.pointOfInterest.lat.max' })
        .nullable(),

    /**
     * Longitude in decimal degrees (WGS84). Plain numeric field, key named
     * `long` for consistency with `@repo/db`'s `geo.ts` helpers. HOS-138:
     * nullable (see `lat`).
     */
    long: z
        .number({ message: 'zodError.pointOfInterest.long.required' })
        .min(-180, { message: 'zodError.pointOfInterest.long.min' })
        .max(180, { message: 'zodError.pointOfInterest.long.max' })
        .nullable(),

    /**
     * @deprecated HOS-138 marks `type` deprecated-transitional. The source of
     * truth for a POI's category moves to the M2M category model in HOS-139;
     * this field stays fully functional until every consumer migrates. Do not
     * build new logic on `type` — use the category relation once HOS-139 lands.
     */
    type: PointOfInterestTypeEnumSchema,

    /**
     * Legacy plain-text description. HOS-138: superseded by `descriptionI18n`
     * where present (spec §6.1); kept as the pre-migration fallback.
     */
    description: z
        .string({
            message: 'zodError.pointOfInterest.description.required'
        })
        .min(10, { message: 'zodError.pointOfInterest.description.min' })
        .max(500, { message: 'zodError.pointOfInterest.description.max' })
        .nullish(),

    // HOS-138 / SPEC-212: multilang content. Nullish: DB columns are nullable
    // jsonb. HOS-142: uses PartialI18nTextSchema (NOT the shared I18nTextSchema
    // `destinations` uses) — POIs come from a bulk, Spanish-sourced import
    // (the 914-POI catalog) where `en`/`pt` are intentionally left `null`
    // rather than invented at import time (NG-6); a future translation pass
    // is a separate follow-up. `es` stays required either way.
    nameI18n: PartialI18nTextSchema.nullish(),
    descriptionI18n: PartialI18nTextSchema.nullish(),

    /**
     * Per-field, per-locale translation curation metadata (SPEC-212).
     * Internal: exposed on admin responses only, never on public payloads.
     */
    translationMeta: TranslationMetaSchema.nullish(),

    /** HOS-138: free-text street address as provided by the dataset. */
    address: z
        .string({ message: 'zodError.pointOfInterest.address.required' })
        .min(3, { message: 'zodError.pointOfInterest.address.min' })
        .max(300, { message: 'zodError.pointOfInterest.address.max' })
        .nullish(),

    /** HOS-138: search keywords, feeds the future AI-search allowlist. */
    keywords: z
        .array(
            z
                .string()
                .min(1, { message: 'zodError.pointOfInterest.keywords.item.min' })
                .max(50, { message: 'zodError.pointOfInterest.keywords.item.max' })
        )
        .max(30, { message: 'zodError.pointOfInterest.keywords.max' })
        .nullish(),

    /** HOS-138: marks POIs that get a dedicated detail page (future feature). */
    hasOwnPage: z.boolean().default(false),

    /** HOS-138: editorial curation — verified flag (indexed DB column). */
    verified: z.boolean().default(false),

    /** HOS-138: timestamp the POI was last verified by a curator. */
    verifiedAt: z.date().nullish(),

    /** HOS-138: free-text provenance label, e.g. `"chatgpt-dataset-2026-07"`. */
    source: z.string().max(200, { message: 'zodError.pointOfInterest.source.max' }).nullish(),

    /** HOS-138: free-text curator notes. */
    notes: z.string().max(1000, { message: 'zodError.pointOfInterest.notes.max' }).nullish(),

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
 *
 * HOS-182: extended (not picked) with `primaryCategory` — the POI's single
 * `isPrimary` row from the `r_poi_category` M2M join (HOS-139), projected to
 * its `{ slug, nameI18n }` display shape. `null` when the POI has no category
 * rows at all, or has category rows but none marked primary (POI data is
 * known-dirty — see HOS-177); this is an expected, non-error state. The
 * frontend resolves icon/marker-color from `primaryCategory.slug` and falls
 * back to the legacy `type`→icon mapping when it is `null`.
 *
 * `.nullish()`, not `.nullable()`, for the same additive-only reason
 * documented on `DestinationPointOfInterestSummarySchema`'s `relation` field
 * (`point-of-interest.relations.schema.ts`): only the destination
 * points-of-interest endpoint (HOS-182) currently populates this field via a
 * JOIN. Every other reader of this schema (the generic public POI
 * list/getById/getBySlug routes, backed by `BaseCrudService`'s plain
 * `findAll`/`findById` reads) never sets the key at all — a `.nullable()`
 * (required) field would fail `stripWithSchema`'s `safeParse` and 500 those
 * routes. `.nullish()` lets an absent key parse as `undefined` while the
 * populating endpoints still emit an explicit object-or-`null` value.
 */
export const PointOfInterestSummarySchema = PointOfInterestSchema.pick({
    id: true,
    slug: true,
    lat: true,
    long: true,
    type: true,
    nameI18n: true,
    description: true,
    descriptionI18n: true,
    icon: true,
    hasOwnPage: true,
    isFeatured: true,
    isBuiltin: true,
    displayWeight: true
}).extend({
    primaryCategory: PoiCategoryPrimarySchema.nullish()
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
    nameI18n: true,
    icon: true
});

/**
 * Type exports
 */
export type PointOfInterest = z.infer<typeof PointOfInterestSchema>;
export type PointOfInterestSummary = z.infer<typeof PointOfInterestSummarySchema>;
export type PointOfInterestMini = z.infer<typeof PointOfInterestMiniSchema>;
