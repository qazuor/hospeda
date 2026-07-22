/**
 * @file addon-labels.ts
 * @description Resolves add-on display name/description from i18n by slug.
 *
 * Add-on definitions in `@repo/billing` (`addons.config.ts`) carry English
 * `name`/`description` literals used as internal defaults. The localized copy
 * shown to users lives under `account.addons.catalog.<slug>.name` /
 * `.description` across all locales. This mirrors `translateAmenityName` in
 * `catalog-names.ts` (SPEC-266's display-by-slug pattern), fixing addon
 * name/description rendering in English on the Spanish site (BETA-198).
 *
 * Falls back to the definition's raw string when no translation exists, so a
 * newly-added addon never renders blank before its keys are translated.
 */

/** Translator shape compatible with `createT(locale)` / `createTranslations().t`. */
type Translate = (key: string, fallback?: string) => string;

/**
 * Localized add-on display name for a slug, falling back to the definition's
 * raw `name` when no translation exists.
 *
 * @param params.t - Active locale translator
 * @param params.slug - Add-on slug (e.g. `visibility-boost-7d`)
 * @param params.fallback - Raw `name` from the addon definition (default)
 * @returns The localized name, or the fallback
 */
export function translateAddonName({
    t,
    slug,
    fallback
}: {
    readonly t: Translate;
    readonly slug: string;
    readonly fallback: string;
}): string {
    return t(`account.addons.catalog.${slug}.name`, fallback);
}

/**
 * Localized add-on description for a slug, falling back to the definition's
 * raw `description` when no translation exists.
 *
 * @param params.t - Active locale translator
 * @param params.slug - Add-on slug (e.g. `visibility-boost-7d`)
 * @param params.fallback - Raw `description` from the addon definition (default)
 * @returns The localized description, or the fallback
 */
export function translateAddonDescription({
    t,
    slug,
    fallback
}: {
    readonly t: Translate;
    readonly slug: string;
    readonly fallback: string;
}): string {
    return t(`account.addons.catalog.${slug}.description`, fallback);
}
