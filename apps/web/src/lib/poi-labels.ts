/**
 * @file poi-labels.ts
 * @description Resolves destination point-of-interest (POI) display strings
 * from i18n (HOS-113 Phase 4).
 *
 * POIs carry NO `name` column (HOS-113 OQ-2) — their display name is
 * resolved via `@repo/i18n` keyed by `slug` (`destinations.poiNames.<slug>`),
 * mirroring `translateAmenityName` in `catalog-names.ts`. The `type` enum
 * value resolves the same way via `destinations.poiTypeLabels.<TYPE>`
 * (T-029's seeded i18n strings, covered by the i18n coverage guard test in
 * `packages/i18n/test/point-of-interest-coverage.test.ts`).
 *
 * Both helpers fall back safely (humanized slug / raw enum value) instead of
 * crashing or rendering the raw `[MISSING: ...]` i18n placeholder, since a
 * missing translation must never break the destination detail page.
 */

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
 * Translates a point-of-interest's `slug` into its locale-resolved display
 * name, falling back to a humanized slug when no translation exists (R-6
 * mitigation — a POI shipped without its i18n string must still render
 * something readable, not a raw slug or a `[MISSING: ...]` placeholder).
 *
 * @param params.t - Active locale translator (`createTranslations().t`)
 * @param params.slug - The POI's `slug` (also its i18n key)
 * @returns The localized POI display name, or a humanized fallback
 */
export function translatePoiName({
    t,
    slug
}: {
    readonly t: Translate;
    readonly slug: string;
}): string {
    const translated = t(`destinations.poiNames.${slug}`);
    return translated.startsWith('[MISSING:') ? humanizeKey(slug) : translated;
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
