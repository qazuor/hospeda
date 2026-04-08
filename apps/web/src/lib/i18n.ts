/**
 * Internationalization utilities for route-based locale management.
 * Provides constants and helpers for validating and parsing supported locales,
 * as well as translation utilities integrated with @repo/i18n.
 *
 * All translations are sourced from `@repo/i18n` which holds flat
 * `Record<Locale, Record<string, string>>` objects built from JSON locale files.
 * Keys use dot-notation: `"namespace.rest.of.key"`.
 */

import type { Namespace } from '@repo/i18n';
import { namespaces, pluralize, trans } from '@repo/i18n';

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
 */
export function parseAcceptLanguage(header: string | null): SupportedLocale {
    if (!header) {
        return DEFAULT_LOCALE;
    }

    const languages = header
        .split(',')
        .map((lang) => {
            const [code] = lang.trim().split(';');
            if (!code) {
                return null;
            }
            const primaryCodeParts = code.split('-');
            const primaryCode = primaryCodeParts[0]?.toLowerCase();
            return primaryCode || null;
        })
        .filter((code): code is string => Boolean(code));

    for (const lang of languages) {
        if (isValidLocale(lang)) {
            return lang;
        }
    }

    return DEFAULT_LOCALE;
}

/**
 * Gets all translations for a given locale and namespace from @repo/i18n.
 *
 * @param params - Object with locale and namespace.
 * @returns A record of translation keys and values for the namespace.
 */
export function getTranslations({
    locale,
    namespace
}: {
    locale: SupportedLocale;
    namespace: Namespace;
}): TranslationRecord {
    const allTranslations = trans as Record<string, Record<string, string>>;
    const localeTranslations = allTranslations[locale] ?? allTranslations[DEFAULT_LOCALE] ?? {};

    const namespacePrefix = `${namespace}.`;
    const result: TranslationRecord = {};

    for (const [key, value] of Object.entries(localeTranslations)) {
        if (key.startsWith(namespacePrefix)) {
            const localKey = key.slice(namespacePrefix.length);
            result[localKey] = value as string;
        }
    }

    return result;
}

/**
 * Resolves a single translation from @repo/i18n.
 * The full key uses dot-notation: "namespace.rest.of.key".
 * The first segment is the namespace, the rest is the key within that namespace.
 *
 * @param fullKey - Dot-notation key like "nav.iniciarSesion" or "home.hero.title"
 * @param fallback - Optional fallback string when the key is missing
 * @param params - Optional interpolation params for {{param}} and {param} placeholders
 * @returns The translated string
 */
function resolve({
    locale,
    fullKey,
    fallback,
    params
}: {
    locale: SupportedLocale;
    fullKey: string;
    fallback?: string;
    params?: Record<string, unknown>;
}): string {
    const allTranslations = trans as Record<string, Record<string, string>>;
    const localeTranslations = allTranslations[locale] ?? allTranslations[DEFAULT_LOCALE] ?? {};

    let raw: string | undefined = localeTranslations[fullKey];

    if (!raw) {
        if (fallback) {
            raw = fallback;
        } else {
            // Use uppercase [MISSING: ...] to match @repo/i18n convention.
            // This is required for `pluralize()` fallback detection to work.
            if (import.meta.env.DEV) {
                return `[MISSING: ${fullKey}]`;
            }
            return fullKey;
        }
    }

    if (!params) {
        return raw;
    }

    return Object.keys(params).reduce((acc, k) => {
        const v = params[k];
        return acc
            .replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
            .replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }, raw);
}

/**
 * Translation function type returned by createT.
 * Takes a dot-notation key, optional fallback, and optional interpolation params.
 *
 * @example
 * ```ts
 * const t = createT('es');
 * t('nav.iniciarSesion');
 * t('nav.iniciarSesion', 'Iniciar sesion');
 * t('home.hero.title', 'Hospeda', { name: 'World' });
 * ```
 */
export type TranslationFn = (
    fullKey: string,
    fallback?: string,
    params?: Record<string, unknown>
) => string;

/**
 * Plural translation function type returned by createTranslations.
 * Takes a dot-notation key, a count, and optional interpolation params.
 * Uses CLDR `_one` / `_other` convention via `@repo/i18n`'s `pluralize`.
 *
 * @example
 * ```ts
 * const { tPlural } = createTranslations('es');
 * tPlural('review.totalReviews', 1);  // "1 resena"
 * tPlural('review.totalReviews', 5);  // "5 resenas"
 * ```
 */
export type PluralTranslationFn = (
    fullKey: string,
    count: number,
    params?: Record<string, unknown>
) => string;

/**
 * Return type for createTranslations.
 */
export interface Translations {
    /** Standard translation function with fallback support. */
    readonly t: TranslationFn;
    /** Plural-aware translation using CLDR _one/_other keys. */
    readonly tPlural: PluralTranslationFn;
}

/**
 * Creates translation functions bound to a specific locale.
 * Returns `{ t, tPlural }` mirroring `@repo/i18n`'s `useTranslations` hook
 * but without React dependency (works in Astro components, .ts files, etc.).
 *
 * @param locale - The locale to bind translations to
 * @returns Object with `t` and `tPlural` functions
 *
 * @example
 * ```ts
 * // In Astro component frontmatter:
 * const { t, tPlural } = createTranslations(locale);
 * t('nav.iniciarSesion');                                  // simple lookup
 * t('home.hero.title', 'Hospeda');                         // with fallback
 * t('home.greeting', 'Hola {{name}}', { name: 'Juan' });  // with params
 * tPlural('review.totalReviews', 5);                       // "5 resenas"
 * ```
 */
export function createTranslations(locale: SupportedLocale): Translations {
    const t: TranslationFn = (fullKey, fallback?, params?) => {
        return resolve({ locale, fullKey, fallback, params });
    };

    // Internal t adapter compatible with @repo/i18n's pluralize signature: (key, params?) => string
    const pluralizeT = (key: string, params?: Record<string, unknown>): string => {
        return resolve({ locale, fullKey: key, params });
    };

    const tPlural: PluralTranslationFn = (fullKey, count, params?) => {
        return pluralize({ t: pluralizeT, key: fullKey, count, params });
    };

    return { t, tPlural };
}

/**
 * Creates a translation function bound to a specific locale.
 * Shorthand when you only need `t` without plural support.
 *
 * @param locale - The locale to bind translations to
 * @returns A translation function with signature (key, fallback?, params?) => string
 *
 * @example
 * ```ts
 * const t = createT('es');
 * t('nav.iniciarSesion');
 * ```
 */
export function createT(locale: SupportedLocale): TranslationFn {
    return (fullKey: string, fallback?: string, params?: Record<string, unknown>): string => {
        return resolve({ locale, fullKey, fallback, params });
    };
}

/**
 * Re-export namespaces from @repo/i18n for convenience.
 */
export { namespaces };
