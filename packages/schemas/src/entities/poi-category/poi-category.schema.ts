import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { I18nTextSchema, TranslationMetaSchema } from '../../common/i18n.schema.js';
import { PoiCategoryIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

/**
 * POI Category Schema - Main entity schema for the point-of-interest category
 * catalog (HOS-139).
 *
 * Replaces the single-value, closed `PointOfInterestTypeEnum` with a proper
 * many-to-many catalog: a POI may belong to several categories, exactly one
 * of which is marked `isPrimary` on the `r_poi_category` join
 * (`poi-category.relations.schema.ts`).
 *
 * Unlike `attractions`/`amenities` (i18n-by-slug, a closed set resolved
 * through `@repo/i18n`), `poi_categories` rows carry their own `nameI18n`
 * content directly, mirroring `destinations.nameI18n` — this catalog must be
 * editable by a content operator without an engineer touching an i18n string
 * file and redeploying (spec §6.1).
 */
export const PoiCategorySchema = z.object({
    // Base fields
    id: PoiCategoryIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // POI category-specific fields

    /**
     * Machine identifier — NOT an i18n key (unlike `type`'s enum values).
     * Used by the legacy `type` mapping (spec §7.4/§7.6) and by admin/API
     * lookups. Regex allows underscores, matching the dataset's slugs
     * (`sports_venue`, `natural_area`, `historic_site`, ...).
     */
    slug: z
        .string({
            message: 'zodError.poiCategory.slug.required'
        })
        .min(3, { message: 'zodError.poiCategory.slug.min' })
        .max(100, { message: 'zodError.poiCategory.slug.max' })
        .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
            message: 'zodError.poiCategory.slug.pattern'
        }),

    /**
     * Required localized display name (SPEC-212 `I18nText`). Every category
     * must have a display name in all three locales — this is a
     * data-driven catalog, not a closed enum with i18n-by-slug fallback.
     */
    nameI18n: I18nTextSchema,

    /**
     * Per-field, per-locale translation curation metadata (SPEC-212).
     * Internal: exposed on admin responses only, never on public payloads.
     */
    translationMeta: TranslationMetaSchema.nullish(),

    icon: z
        .string({
            message: 'zodError.poiCategory.icon.required'
        })
        .min(1, { message: 'zodError.poiCategory.icon.min' })
        .max(100, { message: 'zodError.poiCategory.icon.max' })
        .nullish(),

    /** Ordering within a POI's category badge list / a future filter UI. */
    displayWeight: z
        .number({ message: 'zodError.poiCategory.displayWeight.required' })
        .int({ message: 'zodError.poiCategory.displayWeight.int' })
        .min(1, { message: 'zodError.poiCategory.displayWeight.min' })
        .max(100, { message: 'zodError.poiCategory.displayWeight.max' })
        .default(50)
});

/**
 * POI Category Summary Schema - Lightweight version for lists and relations
 * Contains only essential fields for display purposes
 */
export const PoiCategorySummarySchema = PoiCategorySchema.pick({
    id: true,
    slug: true,
    nameI18n: true,
    icon: true,
    displayWeight: true
});

/**
 * POI Category Mini Schema - Minimal version for dropdowns and references
 * Contains only the most basic identifying information
 */
export const PoiCategoryMiniSchema = PoiCategorySchema.pick({
    id: true,
    slug: true,
    nameI18n: true,
    icon: true
});

/**
 * Type exports
 */
export type PoiCategory = z.infer<typeof PoiCategorySchema>;
export type PoiCategorySummary = z.infer<typeof PoiCategorySummarySchema>;
export type PoiCategoryMini = z.infer<typeof PoiCategoryMiniSchema>;
