/**
 * @file catalog-names.ts
 * @description Resolves catalog amenity display names from i18n.
 *
 * Amenity catalog rows store their i18n lookup KEY in `name` (e.g. `"wifi"`,
 * `"air_conditioning"`), not human-readable display text. The canonical display
 * strings live in `accommodations.amenityNames.<key>` across all locales. This
 * mirrors the resolution already done by `AmenitiesGrid.astro` so the host and
 * commerce editors render translated amenity labels instead of the raw key.
 *
 * Falls back to a humanized key (underscores → spaces, title-cased) when no
 * translation exists, matching the grid's behavior.
 *
 * NOTE: the `name` column is slated for removal in favor of i18n as the single
 * source of truth — see Linear BETA-90.
 */

/** Translator shape compatible with `createTranslations().t`. */
type Translate = (key: string, fallback?: string) => string;

/** Humanizes a raw catalog key: `air_conditioning` → `Air Conditioning`. */
function humanizeKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Translates an amenity catalog name (an i18n key stored in `name`) into the
 * locale-resolved display string, falling back to a humanized key.
 *
 * @param params.t - Active locale translator (`createTranslations().t`)
 * @param params.name - Raw amenity name from the catalog (acts as the i18n key)
 * @returns The localized amenity label, or a humanized fallback
 */
export function translateAmenityName({
    t,
    name
}: {
    readonly t: Translate;
    readonly name: string;
}): string {
    const translated = t(`accommodations.amenityNames.${name}`);
    return translated.startsWith('[MISSING:') ? humanizeKey(name) : translated;
}
