/**
 * @file poi-labels.ts
 * @description Resolves destination point-of-interest (POI) display strings
 * from i18n (HOS-113 Phase 4) or, when available, admin-editable multilang
 * content (HOS-138).
 *
 * HOS-113 shipped POIs with NO `name` column — their display name was
 * resolved via `@repo/i18n` keyed by `slug` (`destinations.poiNames.<slug>`),
 * mirroring `translateAmenityName` in `catalog-names.ts`. HOS-138 replaced
 * that with a nullable `nameI18n` (SPEC-212 `I18nText`) column as the single
 * source of POI display names (`resolveI18nText(nameI18n, locale)`) and
 * removed the legacy `destinations.poiNames.<slug>` i18n keys entirely — see
 * spec HOS-138 §6.1/§6.4. A POI without `nameI18n` degrades to a humanized
 * slug (never crashes).
 *
 * The `type` enum value resolves via `destinations.poiTypeLabels.<TYPE>`
 * (T-029's seeded i18n strings, covered by the i18n coverage guard test in
 * `packages/i18n/test/point-of-interest-coverage.test.ts`) — unaffected by
 * HOS-138 (see spec §6.6, `type` stays deprecated-transitional).
 *
 * All fallback paths resolve safely (humanized slug / raw enum value)
 * instead of crashing or rendering the raw `[MISSING: ...]` i18n
 * placeholder, since a missing translation must never break the destination
 * detail page.
 */

import type { I18nTextLike } from '@/lib/resolve-i18n-text';
import { resolveI18nText } from '@/lib/resolve-i18n-text';

/** Translator shape compatible with `createTranslations().t`. */
type Translate = (key: string, fallback?: string) => string;

/**
 * Humanizes a raw slug/enum value: `flag_checkered` → `Flag Checkered`,
 * `NOT_A_REAL_TYPE` → `Not A Real Type`. Lowercases before title-casing so
 * SCREAMING_SNAKE_CASE enum values (e.g. `PointOfInterestTypeEnum`) humanize
 * the same way lowercase slugs do.
 */
function humanizeKey(key: string): string {
    return key
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Translates a point-of-interest's display name from its admin-editable
 * multilang content (HOS-138 `nameI18n`), falling back to a humanized slug
 * when the content is absent (R-6 mitigation — a POI shipped without
 * multilang content must still render something readable, not a raw slug).
 *
 * The legacy `destinations.poiNames.<slug>` i18n-by-slug lookup was removed in
 * HOS-138: `nameI18n` is now the single source of POI display names (every
 * seeded POI ships it, enforced by the i18n coverage guard test; the 914-POI
 * import writes it directly). A POI reaching this function with a null
 * `nameI18n` (e.g. during the deploy window before its data-migration runs)
 * degrades to a humanized slug rather than a stale i18n-file lookup.
 *
 * Resolution order:
 *  1. `resolveI18nText(nameI18n, locale)` when `nameI18n` is non-null.
 *  2. A humanized version of `slug` (last resort, never crashes).
 *
 * @param params.slug - The POI's `slug`, used for the humanized fallback
 * @param params.nameI18n - The POI's multilang name content (HOS-138);
 *   `null`/`undefined` for a POI not yet carrying multilang content
 * @param params.locale - The active locale, required to resolve `nameI18n`
 * @returns The localized POI display name, or a humanized fallback
 */
export function translatePoiName({
    slug,
    nameI18n,
    locale
}: {
    readonly slug: string;
    readonly nameI18n?: I18nTextLike | null;
    readonly locale?: string;
}): string {
    if (nameI18n && locale) {
        return resolveI18nText(nameI18n, locale) || humanizeKey(slug);
    }

    return humanizeKey(slug);
}

/**
 * Translates a `PointOfInterestTypeEnum` value into its locale-resolved
 * label, falling back to a humanized enum value when no translation exists.
 *
 * @param params.t - Active locale translator (`createTranslations().t`)
 * @param params.type - The POI's `type` enum value (e.g. `"BEACH"`)
 * @returns The localized type label, or a humanized fallback
 */
export function translatePoiTypeLabel({
    t,
    type
}: {
    readonly t: Translate;
    readonly type: string;
}): string {
    const translated = t(`destinations.poiTypeLabels.${type}`);
    return translated.startsWith('[MISSING:') ? humanizeKey(type) : translated;
}

/**
 * Resolves the label shown on a POI's badge: its primary CATEGORY name when it
 * has one, falling back to the legacy `type` label when it does not.
 *
 * HOS-182: the badge used to read `type` unconditionally, but `type` is the
 * deprecated 9-value enum in which most POIs are `OTHER` — on a real destination
 * two thirds of the cards read "Otro" while their icon (now category-driven)
 * showed something specific. Preferring the category keeps the badge and the
 * glyph telling the same story.
 *
 * Category names are data-driven (`poi_categories.nameI18n`, resolved per
 * locale), NOT i18n-by-slug — unlike `type`, whose labels are static keys. See
 * `poi-category.dbschema.ts` for why HOS-139 chose that.
 *
 * @param params.t - Active locale translator, for the `type` fallback
 * @param params.type - The POI's `type` enum value, used when no category
 * @param params.primaryCategory - The POI's primary category, `null` when it has
 *   none (POI data is known-dirty — see HOS-177)
 * @param params.locale - The active locale, required to resolve `nameI18n`
 * @returns The localized category name, or the localized type label
 */
export function translatePoiCategoryLabel({
    t,
    type,
    primaryCategory,
    locale
}: {
    readonly t: Translate;
    readonly type: string;
    readonly primaryCategory?: { readonly nameI18n?: I18nTextLike | null } | null;
    readonly locale?: string;
}): string {
    if (primaryCategory?.nameI18n && locale) {
        const resolved = resolveI18nText(primaryCategory.nameI18n, locale);
        if (resolved) return resolved;
    }

    return translatePoiTypeLabel({ t, type });
}
