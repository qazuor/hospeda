/**
 * Low-level formatting and text utilities for the accommodation summary builder.
 *
 * These helpers are intentionally pure functions with no side effects so they
 * can be unit-tested in isolation.
 */

import { toBcp47Locale } from '@repo/i18n';
import type { SummaryLocale } from './summary.types';

// ---------------------------------------------------------------------------
// Price formatting
// ---------------------------------------------------------------------------

/** Input for {@link formatPrice}. */
export interface FormatPriceInput {
    /** Monetary value to format. */
    readonly value: number;
    /** Summary locale used to resolve the default currency and BCP 47 tag. */
    readonly locale: SummaryLocale;
    /**
     * ISO 4217 currency code override.
     * Defaults to ARS for 'es' and USD for 'en'.
     */
    readonly currency?: string;
}

/** Maps summary locales to their default ISO 4217 currency codes. */
const DEFAULT_CURRENCY: Readonly<Record<SummaryLocale, string>> = {
    es: 'ARS',
    en: 'USD'
} as const;

/**
 * Formats a monetary value as a compact currency string without decimal places.
 *
 * Unlike `formatCurrency` from `@repo/i18n` (which outputs "$ 8.000,00"),
 * this function omits decimals and strips the space between the currency symbol
 * and the number so the output matches the expected summary format
 * (e.g. "$8.000" in es-AR instead of "$ 8.000").
 *
 * The space stripping is achieved by using `formatToParts` and omitting
 * `literal` parts that appear between `currency` and `integer` parts — which
 * is exactly the separator space that es-AR inserts after the `$` symbol.
 *
 * @param input - {@link FormatPriceInput}
 * @returns Compact currency string without space after symbol, e.g. "$8.000" or "$20,000"
 *
 * @example
 * ```ts
 * formatPrice({ value: 8000, locale: 'es' })          // '$8.000'
 * formatPrice({ value: 20000, locale: 'es' })         // '$20.000'
 * formatPrice({ value: 500, locale: 'en' })           // '$500'
 * formatPrice({ value: 1500, locale: 'en', currency: 'EUR' }) // '€1,500'
 * ```
 */
export function formatPrice({ value, locale, currency }: FormatPriceInput): string {
    const resolvedCurrency = currency ?? DEFAULT_CURRENCY[locale];
    const intlLocale = toBcp47Locale(locale);
    const formatter = new Intl.NumberFormat(intlLocale, {
        style: 'currency',
        currency: resolvedCurrency,
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
    });

    // Use formatToParts to strip the literal space between currency symbol and
    // number (present in es-AR: "$ 20.000" → "$20.000").
    const parts = formatter.formatToParts(value);
    let skipNextLiteral = false;
    let result = '';

    for (const part of parts) {
        if (part.type === 'currency') {
            skipNextLiteral = true;
            result += part.value;
        } else if (part.type === 'literal' && skipNextLiteral) {
            // Skip the space after currency symbol
            skipNextLiteral = false;
        } else {
            skipNextLiteral = false;
            result += part.value;
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Rating formatting
// ---------------------------------------------------------------------------

/** Input for {@link formatRating}. */
export interface FormatRatingInput {
    /** Numeric rating value. */
    readonly value: number;
    /** Output locale for decimal separator conventions. */
    readonly locale: SummaryLocale;
}

/**
 * Formats a decimal rating using locale-appropriate decimal separators.
 * Whole numbers are shown without decimals (e.g. "4" not "4,0").
 *
 * @param input - {@link FormatRatingInput}
 * @returns Formatted rating string
 *
 * @example
 * ```ts
 * formatRating({ value: 4, locale: 'es' })    // '4'
 * formatRating({ value: 4.5, locale: 'es' })  // '4,5'
 * formatRating({ value: 4.5, locale: 'en' })  // '4.5'
 * ```
 */
export function formatRating({ value, locale }: FormatRatingInput): string {
    const intlLocale = toBcp47Locale(locale);
    const isWhole = Number.isInteger(value);
    return new Intl.NumberFormat(intlLocale, {
        maximumFractionDigits: isWhole ? 0 : 1,
        minimumFractionDigits: 0
    }).format(value);
}

// ---------------------------------------------------------------------------
// Natural list joining
// ---------------------------------------------------------------------------

/** Input for {@link formatNaturalList}. */
export interface FormatNaturalListInput {
    /** Items to join. */
    readonly items: readonly string[];
    /** Conjunction word used before the last item (e.g. "y", "or"). */
    readonly conjunction: string;
}

/**
 * Joins an array of strings into a natural-language list.
 *
 * - 1 item  → "a"
 * - 2 items → "a y b"
 * - 3+ items → "a, b y c"
 *
 * @param input - {@link FormatNaturalListInput}
 * @returns Natural-language list string
 *
 * @example
 * ```ts
 * formatNaturalList({ items: ['a'], conjunction: 'y' })          // 'a'
 * formatNaturalList({ items: ['a', 'b'], conjunction: 'y' })     // 'a y b'
 * formatNaturalList({ items: ['a', 'b', 'c'], conjunction: 'y' }) // 'a, b y c'
 * formatNaturalList({ items: ['a', 'b', 'c'], conjunction: 'or' }) // 'a, b or c'
 * ```
 */
export function formatNaturalList({ items, conjunction }: FormatNaturalListInput): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0] ?? '';
    const last = items[items.length - 1] ?? '';
    const rest = items.slice(0, -1);
    return `${rest.join(', ')} ${conjunction} ${last}`;
}

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

/** Input for {@link cleanText}. */
export interface CleanTextInput {
    /** Raw text to clean. */
    readonly text: string;
}

/**
 * Strips leading and trailing `%` wildcard characters, trims whitespace,
 * and collapses multiple consecutive spaces into a single space.
 *
 * This is used to sanitise free-text filter values before embedding them
 * in the summary phrase.
 *
 * @param input - {@link CleanTextInput}
 * @returns Cleaned string
 *
 * @example
 * ```ts
 * cleanText({ text: '%centro%' })         // 'centro'
 * cleanText({ text: '  foo   bar  ' })    // 'foo bar'
 * cleanText({ text: '%  hotel  norte%' }) // 'hotel  norte' => 'hotel norte'
 * ```
 */
export function cleanText({ text }: CleanTextInput): string {
    return text
        .replace(/^%+|%+$/g, '')
        .trim()
        .replace(/\s{2,}/g, ' ');
}

// ---------------------------------------------------------------------------
// Pluralisation
// ---------------------------------------------------------------------------

/** Input for {@link pluralizeWord}. */
export interface PluralizeWordInput {
    /** Count that determines singular vs plural. */
    readonly count: number;
    /** Singular form of the word. */
    readonly singular: string;
    /** Plural form of the word. */
    readonly plural: string;
}

/**
 * Returns the singular form when `count` is exactly 1, and the plural form
 * for all other values (including 0).
 *
 * @param input - {@link PluralizeWordInput}
 * @returns Singular or plural word
 *
 * @example
 * ```ts
 * pluralizeWord({ count: 1, singular: 'hotel', plural: 'hoteles' })  // 'hotel'
 * pluralizeWord({ count: 2, singular: 'hotel', plural: 'hoteles' })  // 'hoteles'
 * pluralizeWord({ count: 0, singular: 'hotel', plural: 'hoteles' })  // 'hoteles'
 * ```
 */
export function pluralizeWord({ count, singular, plural }: PluralizeWordInput): string {
    return count === 1 ? singular : plural;
}

// ---------------------------------------------------------------------------
// Safe number conversion
// ---------------------------------------------------------------------------

/** Input for {@link toSafeNumber}. */
export interface ToSafeNumberInput {
    /** Value to convert. May be a number, numeric string, null, or undefined. */
    readonly value: number | string | null | undefined;
}

/**
 * Converts a string or number value to a finite number, returning `null` when
 * the conversion fails or the result is `NaN` / `Infinity`.
 *
 * @param input - {@link ToSafeNumberInput}
 * @returns Finite number or `null`
 *
 * @example
 * ```ts
 * toSafeNumber({ value: 42 })        // 42
 * toSafeNumber({ value: '42' })      // 42
 * toSafeNumber({ value: '42.5' })    // 42.5
 * toSafeNumber({ value: null })      // null
 * toSafeNumber({ value: undefined }) // null
 * toSafeNumber({ value: 'abc' })     // null
 * toSafeNumber({ value: NaN })       // null
 * ```
 */
export function toSafeNumber({ value }: ToSafeNumberInput): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(n) ? n : null;
}
