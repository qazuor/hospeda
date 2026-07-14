/**
 * A localized-text-like shape accepted by {@link resolveI18nText}.
 *
 * Deliberately permissive: each locale may be a string, `null`, or absent.
 * This accepts both `@repo/schemas`' strict `I18nText` (`en`/`pt` required
 * strings) and its partial/nullish variant where every locale is
 * `string | null | undefined` (e.g. `PointOfInterest.nameI18n`, which uses
 * `PartialI18nTextSchema.nullish()` — HOS-142).
 */
type I18nTextLike = {
    readonly es?: string | null;
    readonly en?: string | null;
    readonly pt?: string | null;
};

/**
 * Resolves a localized text value to a displayable string.
 *
 * Used in list/table contexts where a single string is needed from an
 * `I18nText`-like object (`{ es, en, pt }`). Resolution order: es → en → pt → ''.
 * Any locale that is `null`/absent is skipped, falling through to the next.
 *
 * @param value - An `I18nText`-like object (locales optionally nullish), null, or undefined.
 * @returns The first non-empty locale string found, or an empty string.
 *
 * @example
 * resolveI18nText({ es: 'Wi-Fi', en: 'Wi-Fi', pt: '' }) // → 'Wi-Fi'
 * resolveI18nText({ es: '', en: 'Pool', pt: 'Piscina' }) // → 'Pool'
 * resolveI18nText({ es: 'Plaza', en: null, pt: null })   // → 'Plaza'
 * resolveI18nText(null)                                   // → ''
 */
export function resolveI18nText(value: I18nTextLike | null | undefined): string {
    if (!value) return '';
    return value.es || value.en || value.pt || '';
}
