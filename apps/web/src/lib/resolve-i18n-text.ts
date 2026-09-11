/**
 * @file resolve-i18n-text.ts
 * @description Helper to resolve a localized i18n text object to a plain string
 * for the current page locale.
 *
 * PR2 of SPEC-172 changed amenity and feature catalog `name` (and `description`)
 * from a plain `string` to a JSONB i18n object `{ es, en, pt }`. This helper
 * bridges the gap on the web side so transforms and components can always work
 * with plain strings while accepting either shape defensively.
 */

import type { I18nText } from '@repo/schemas';

/** Locale priority order used for fallback resolution. */
const LOCALE_FALLBACK_ORDER = ['es', 'en', 'pt'] as const;

/**
 * Partial i18n text shape accepted defensively when the raw API response
 * has not been parsed through a strict Zod schema (e.g. inside transforms.ts
 * where the raw value arrives as `unknown`), or when it comes from a schema
 * that intentionally allows `null` for untranslated locales (e.g.
 * `PartialI18nTextSchema` — HOS-138/HOS-145 `nameI18n`/`descriptionI18n`
 * fields for bulk, Spanish-sourced imports where `en`/`pt` are left `null`
 * rather than invented at import time).
 *
 * All three locales are optional and nullable here so the helper can still
 * extract a value from incomplete or partially-translated payloads without
 * throwing at the type level.
 */
export type I18nTextLike = { readonly [K in keyof I18nText]?: I18nText[K] | null };

/**
 * Resolves a localized text value to a displayable string for the given locale.
 *
 * Resolution order:
 *  1. The requested locale
 *  2. `es` (platform default)
 *  3. `en`
 *  4. `pt`
 *  5. Empty string as last resort
 *
 * Also accepts a plain `string` (defensive, for endpoints that have not yet
 * migrated to the i18n object shape) — in that case the string is returned
 * as-is.
 *
 * @param value - An `I18nText` object (or partial), a plain string, null, or undefined.
 * @param locale - The desired locale (`es`, `en`, or `pt`).
 * @returns The resolved display string (never null/undefined).
 *
 * @example
 * resolveI18nText({ es: 'Wifi', en: 'Wifi', pt: 'Wifi' }, 'en') // → 'Wifi'
 * resolveI18nText({ es: '', en: 'Pool', pt: 'Piscina' }, 'es')  // → 'Pool'
 * resolveI18nText('wifi', 'en')                                  // → 'wifi'
 * resolveI18nText(null, 'es')                                    // → ''
 */
export function resolveI18nText(
    value: I18nText | I18nTextLike | string | null | undefined,
    locale: string
): string {
    if (!value) return '';

    // Plain string — pass through (defensive: some endpoints may still return strings)
    if (typeof value === 'string') return value;

    const i18n = value as I18nTextLike;

    // Try the requested locale first
    const localeKey = locale as keyof I18nText;
    const localeValue = i18n[localeKey];
    if (localeValue) return localeValue;

    // Fallback through the priority order (es → en → pt)
    for (const fallbackLocale of LOCALE_FALLBACK_ORDER) {
        const fallbackValue = i18n[fallbackLocale];
        if (fallbackValue) return fallbackValue;
    }

    return '';
}

/**
 * Resolves a localized text value the same way {@link resolveI18nText} does,
 * but additionally falls back to a legacy plain-string field when the i18n
 * object resolves to an empty string.
 *
 * ## Why this exists (HOS-802)
 *
 * `resolveI18nText` treats an i18n object as present as soon as it is
 * truthy, so a nullish-coalescing chain like
 * `resolveI18nText(item.nameI18n ?? item.name, locale)` never falls through
 * to `item.name` when `nameI18n` exists but is populated with only empty
 * strings (`{ es: '', en: '', pt: '' }`). That shape is reachable in
 * production: `apps/api/src/services/ai-translate.service.ts` writes these
 * i18n columns via an automated translation job, and a partial/failed run
 * can leave the object present with every key empty. The caller's `??` never
 * fires (the object is truthy), `resolveI18nText` walks its own `es → en →
 * pt` fallback order and still finds nothing, and the field renders as an
 * empty string — most visibly as an empty `<title>` on the accommodation
 * detail page, which Google then indexes empty.
 *
 * This helper closes that gap by checking the RESULT of
 * `resolveI18nText`, not just the truthiness of the i18n object: if that
 * result is empty, it falls back to the stringified legacy value (and to
 * the empty string only if both are empty). Callers that already carry an
 * explicit last-resort literal (e.g. `'Sin nombre'`) can still layer it on
 * top of this helper's `??`/`||` chain — this helper does not swallow that
 * usage, it only fixes the truthy-but-empty-object case underneath it.
 *
 * ## Product decision — cross-locale fallback is UNCHANGED (HOS-802 AC-2)
 *
 * This helper delegates to `resolveI18nText`, which cross-falls through
 * `es → en → pt` regardless of the requested locale — e.g. an accommodation
 * whose `nameI18n` only has `en` populated will publish that English name
 * on `/es/...` pages. The alternative (matching the FAQ resolution pattern,
 * which never cross-falls) was raised as HOS-802's acceptance criterion 2
 * and deliberately deferred: `resolveI18nText` is a generic resolver with
 * many consumers, and changing its fallback policy is a broad behavior
 * change that deserves its own issue and its own measurement of impact.
 * Bundling it into this bug fix would turn a safe, narrow fix into an
 * unreviewed policy change. **The cross-fall behavior stays as-is in this
 * change** — this note exists so the decision is explicit and does not get
 * re-litigated by someone reading the code in isolation.
 *
 * @param params - The i18n value, the legacy plain value, and the locale.
 * @param params.i18n - An `I18nText` object (or partial), a plain string, null, or undefined.
 * @param params.legacy - The legacy plain value to fall back to when `i18n` resolves empty. Only used when it is itself a `string`; any other type (e.g. `0`, `false`, `NaN`, an array, or another i18n object) degrades to `''` instead of being coerced with `String()` — the same degradation the pre-fix `resolveI18nText(i18n ?? legacy, locale)` chain already applied to a non-string legacy value, since every legacy field these call sites read is `z.string()`-typed. `item` arrives as `Record<string, unknown>` though (these transforms are documented as defensive against raw, un-parsed API responses), so this keeps that defensiveness intact instead of introducing `"[object Object]"`/`"NaN"`/`"a,b"` for a shape Zod would normally reject.
 * @param params.locale - The desired locale (`es`, `en`, or `pt`).
 * @returns The resolved display string (never null/undefined).
 *
 * @example
 * resolveI18nTextWithLegacyFallback({
 *     i18n: { es: '', en: '', pt: '' },
 *     legacy: 'Casa del Sol',
 *     locale: 'es'
 * }); // → 'Casa del Sol'
 *
 * @example
 * resolveI18nTextWithLegacyFallback({
 *     i18n: { es: 'Wifi', en: 'Wifi', pt: 'Wifi' },
 *     legacy: 'wifi (legacy)',
 *     locale: 'es'
 * }); // → 'Wifi'
 *
 * @example
 * resolveI18nTextWithLegacyFallback({ i18n: null, legacy: null, locale: 'es' }); // → ''
 */
export function resolveI18nTextWithLegacyFallback({
    i18n,
    legacy,
    locale
}: {
    readonly i18n: I18nText | I18nTextLike | string | null | undefined;
    readonly legacy: unknown;
    readonly locale: string;
}): string {
    const resolved = resolveI18nText(i18n, locale);
    if (resolved) return resolved;

    return typeof legacy === 'string' ? legacy : '';
}
