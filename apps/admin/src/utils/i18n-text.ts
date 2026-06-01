import type { I18nText } from '@repo/schemas';

/**
 * Resolves a localized text value to a displayable string.
 *
 * Used in list/table contexts where a single string is needed from an
 * `I18nText` object (`{ es, en, pt }`). Resolution order: es → en → pt → ''.
 *
 * @param value - An `I18nText` object, a partial shape, null, or undefined.
 * @returns The first non-empty locale string found, or an empty string.
 *
 * @example
 * resolveI18nText({ es: 'Wi-Fi', en: 'Wi-Fi', pt: '' }) // → 'Wi-Fi'
 * resolveI18nText({ es: '', en: 'Pool', pt: 'Piscina' }) // → 'Pool'
 * resolveI18nText(null)                                   // → ''
 */
export function resolveI18nText(value: Partial<I18nText> | null | undefined): string {
    if (!value) return '';
    return value.es || value.en || value.pt || '';
}
