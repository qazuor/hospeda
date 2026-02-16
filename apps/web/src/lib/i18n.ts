/**
 * Internationalization utilities for route-based locale management.
 * Provides constants and helpers for validating and parsing supported locales,
 * as well as translation utilities integrated with @repo/i18n.
 */

import type { Namespace } from '@repo/i18n';
import { namespaces, trans } from '@repo/i18n';

/**
 * Array of supported locales for the application.
 * Spanish is the default locale.
 */
export const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;

/**
 * Type representing a valid supported locale.
 */
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Default application locale (Spanish).
 */
export const DEFAULT_LOCALE: SupportedLocale = 'es';

/**
 * Type representing translation records (string values or nested objects).
 */
export type TranslationRecord = Record<string, string | Record<string, unknown>>;

/**
 * Type guard to check if a string is a valid supported locale.
 *
 * @param locale - The locale string to validate.
 * @returns True if the locale is supported, false otherwise.
 *
 * @example
 * ```ts
 * isValidLocale('es'); // true
 * isValidLocale('fr'); // false
 * ```
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Parses the Accept-Language HTTP header and returns the first matching supported locale.
 * Falls back to the default locale if no match is found.
 *
 * @param header - The Accept-Language header value (or null).
 * @returns The matched supported locale or the default locale.
 *
 * @example
 * ```ts
 * parseAcceptLanguage('es-AR,es;q=0.9,en;q=0.8'); // 'es'
 * parseAcceptLanguage('en-US,en;q=0.9'); // 'en'
 * parseAcceptLanguage('fr-FR'); // 'es' (default)
 * parseAcceptLanguage(null); // 'es' (default)
 * ```
 */
export function parseAcceptLanguage(header: string | null): SupportedLocale {
    if (!header) {
        return DEFAULT_LOCALE;
    }

    // Parse Accept-Language header
    // Format: "es-AR,es;q=0.9,en;q=0.8,pt;q=0.7"
    const languages = header
        .split(',')
        .map((lang) => {
            const [code] = lang.trim().split(';');
            if (!code) {
                return null;
            }
            // Extract the primary language code (before the dash)
            const primaryCodeParts = code.split('-');
            const primaryCode = primaryCodeParts[0]?.toLowerCase();
            return primaryCode || null;
        })
        .filter((code): code is string => Boolean(code));

    // Find first matching supported locale
    for (const lang of languages) {
        if (isValidLocale(lang)) {
            return lang;
        }
    }

    return DEFAULT_LOCALE;
}

/**
 * Gets all translations for a given locale and namespace from @repo/i18n.
 * Returns a record with dot-notation keys and their translated values.
 *
 * @param params - Object with locale and namespace.
 * @param params.locale - The locale to retrieve translations for.
 * @param params.namespace - The namespace to retrieve translations from.
 * @returns A record of translation keys and values for the namespace.
 *
 * @example
 * ```ts
 * const commonTranslations = getTranslations({ locale: 'es', namespace: 'common' });
 * // Returns: { 'search': 'Buscar', 'loading': 'Cargando...', ... }
 *
 * const navTranslations = getTranslations({ locale: 'en', namespace: 'nav' });
 * // Returns: { 'home': 'Home', 'accommodations': 'Accommodations', ... }
 * ```
 */
export function getTranslations({
    locale,
    namespace
}: {
    locale: SupportedLocale;
    namespace: Namespace;
}): TranslationRecord {
    // Get translations for the locale (fallback to default locale if not found)
    // @repo/i18n currently only supports 'es', so we use type assertion
    const allTranslations = trans as Record<string, Record<string, string>>;
    const localeTranslations = allTranslations[locale] ?? allTranslations[DEFAULT_LOCALE] ?? {};

    // Filter translations by namespace prefix
    const namespacePrefix = `${namespace}.`;
    const result: TranslationRecord = {};

    for (const [key, value] of Object.entries(localeTranslations)) {
        if (key.startsWith(namespacePrefix)) {
            // Remove namespace prefix from key
            const localKey = key.slice(namespacePrefix.length);
            result[localKey] = value as string;
        }
    }

    return result;
}

/**
 * Retrieves a single translation by key from @repo/i18n.
 * Supports dot-notation keys and parameter interpolation.
 *
 * @param params - Object with translation parameters.
 * @param params.locale - The locale to retrieve the translation for.
 * @param params.namespace - The namespace where the translation key exists.
 * @param params.key - The translation key (without namespace prefix).
 * @param params.fallback - Optional fallback text if translation is missing.
 * @param params.params - Optional parameters for string interpolation.
 * @returns The translated string, fallback, or a missing key indicator.
 *
 * @example
 * ```ts
 * t({ locale: 'es', namespace: 'common', key: 'search' });
 * // Returns: 'Buscar'
 *
 * t({ locale: 'es', namespace: 'common', key: 'missing', fallback: 'Not found' });
 * // Returns: 'Not found'
 *
 * t({ locale: 'es', namespace: 'common', key: 'welcome', params: { name: 'Juan' } });
 * // Returns: 'Bienvenido, Juan' (if translation has {{name}} placeholder)
 * ```
 */
export function t({
    locale,
    namespace,
    key,
    fallback,
    params
}: {
    locale: SupportedLocale;
    namespace: Namespace;
    key: string;
    fallback?: string;
    params?: Record<string, unknown>;
}): string {
    // Get translations for the locale (fallback to default locale if not found)
    // @repo/i18n currently only supports 'es', so we use type assertion
    const allTranslations = trans as Record<string, Record<string, string>>;
    const localeTranslations = allTranslations[locale] ?? allTranslations[DEFAULT_LOCALE] ?? {};

    // Construct full key with namespace
    const fullKey = `${namespace}.${key}`;

    // Get translation value
    let raw: string | undefined = localeTranslations[fullKey];

    // If not found, use fallback or missing indicator
    if (!raw) {
        if (fallback) {
            raw = fallback;
        } else {
            // In development, show missing key indicator
            if (import.meta.env.DEV) {
                return `[missing: ${fullKey}]`;
            }
            return key;
        }
    }

    // If no params, return raw translation
    if (!params) {
        return raw;
    }

    // Replace {{key}} and {key} patterns with parameter values
    // IMPORTANT: Must replace double braces FIRST to avoid partial matches
    return Object.keys(params).reduce((acc, k) => {
        const v = params[k];
        return acc
            .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
            .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }, raw);
}

/**
 * Re-export namespaces from @repo/i18n for convenience.
 */
export { namespaces };
