/**
 * Centralized date, number, and currency formatting utilities for the Hospeda platform.
 *
 * All functions accept a `locale` parameter so they work correctly across all
 * supported locales (es, en, pt) instead of hardcoding 'es-AR'.
 *
 * Currency defaults per locale family:
 * - es / es-AR  -> ARS (Argentine Peso)
 * - en / en-US  -> USD (US Dollar)
 * - pt / pt-BR  -> BRL (Brazilian Real)
 */

// ---------------------------------------------------------------------------
// BCP 47 locale mapping
// ---------------------------------------------------------------------------

/**
 * Maps used internally to resolve short locale codes to their full BCP 47 equivalents.
 */
const LOCALE_BCP47_MAP: Readonly<Record<string, string>> = {
    es: 'es-AR',
    en: 'en-US',
    pt: 'pt-BR'
} as const;

/**
 * Converts a short locale code (e.g. `'es'`, `'en'`, `'pt'`) to its full
 * BCP 47 equivalent used for `Intl` formatting.
 *
 * If the locale is already a full BCP 47 tag or is unknown, it is returned as-is.
 *
 * @param locale - Short or full locale string
 * @returns Full BCP 47 locale string
 *
 * @example
 * ```ts
 * toBcp47Locale('es')    // 'es-AR'
 * toBcp47Locale('en')    // 'en-US'
 * toBcp47Locale('pt')    // 'pt-BR'
 * toBcp47Locale('es-AR') // 'es-AR' (already full)
 * toBcp47Locale('fr')    // 'fr' (unknown, returned as-is)
 * ```
 */
export function toBcp47Locale(locale: string): string {
    return LOCALE_BCP47_MAP[locale] ?? locale;
}

/**
 * Maps locale prefixes to their default ISO 4217 currency codes.
 * The lookup checks the full BCP 47 tag first, then falls back to the
 * two-letter language subtag.
 */
const LOCALE_CURRENCY_MAP: Readonly<Record<string, string>> = {
    'es-AR': 'ARS',
    'es-UY': 'UYU',
    'es-CL': 'CLP',
    es: 'ARS',
    'en-US': 'USD',
    'en-GB': 'GBP',
    en: 'USD',
    'pt-BR': 'BRL',
    pt: 'BRL'
} as const;

/**
 * Resolves the default currency code for a given BCP 47 locale string.
 *
 * The resolution order is:
 * 1. Exact match on the full locale tag (e.g. `'es-AR'`).
 * 2. Match on the two-letter language subtag (e.g. `'es'`).
 * 3. Falls back to `'USD'` when no mapping is found.
 *
 * @param locale - BCP 47 locale string (e.g. `'es-AR'`, `'en-US'`, `'pt-BR'`)
 * @returns ISO 4217 currency code
 *
 * @example
 * ```ts
 * resolveDefaultCurrency('es-AR') // 'ARS'
 * resolveDefaultCurrency('en')    // 'USD'
 * resolveDefaultCurrency('pt-BR') // 'BRL'
 * resolveDefaultCurrency('ja-JP') // 'USD' (fallback)
 * ```
 */
export function resolveDefaultCurrency(locale: string): string {
    const exact = LOCALE_CURRENCY_MAP[locale];
    if (exact !== undefined) return exact;

    const lang = locale.split('-')[0] ?? locale;
    return LOCALE_CURRENCY_MAP[lang] ?? 'USD';
}

// ---------------------------------------------------------------------------
// Input interfaces
// ---------------------------------------------------------------------------

/**
 * Input for {@link formatDate}.
 */
export interface FormatDateInput {
    /** The date value to format. Accepts a `Date` object, a Unix timestamp (ms), or an ISO string. */
    readonly date: Date | string | number;
    /** BCP 47 locale string used for formatting (e.g. `'es-AR'`, `'en-US'`, `'pt-BR'`). */
    readonly locale: string;
    /**
     * Optional `Intl.DateTimeFormatOptions` to override the default long-form date style.
     *
     * Default options produce outputs like:
     * - `es-AR`: "15 de marzo de 2026"
     * - `en-US`: "March 15, 2026"
     * - `pt-BR`: "15 de março de 2026"
     */
    readonly options?: Intl.DateTimeFormatOptions;
}

/**
 * Input for {@link formatNumber}.
 */
export interface FormatNumberInput {
    /** The numeric value to format. */
    readonly value: number;
    /** BCP 47 locale string used for formatting (e.g. `'es-AR'`, `'en-US'`, `'pt-BR'`). */
    readonly locale: string;
    /** Optional `Intl.NumberFormatOptions` to customize the output. */
    readonly options?: Intl.NumberFormatOptions;
}

/**
 * Input for {@link formatCurrency}.
 */
export interface FormatCurrencyInput {
    /** The monetary value to format. */
    readonly value: number;
    /** BCP 47 locale string used for formatting (e.g. `'es-AR'`, `'en-US'`, `'pt-BR'`). */
    readonly locale: string;
    /**
     * ISO 4217 currency code (e.g. `'ARS'`, `'USD'`, `'BRL'`).
     *
     * When omitted, a sensible default is inferred from `locale`:
     * - `es` / `es-AR` -> `'ARS'`
     * - `en` / `en-US` -> `'USD'`
     * - `pt` / `pt-BR` -> `'BRL'`
     */
    readonly currency?: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Converts a `Date | string | number` value to a `Date` instance.
 *
 * @param value - The raw date value.
 * @returns A valid `Date` object.
 * @throws {TypeError} When `value` cannot be converted to a valid date.
 *
 * @internal
 */
function toDate(value: Date | string | number): Date {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new TypeError('Invalid Date object provided to formatDate');
        }
        return value;
    }

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        throw new TypeError(`Cannot convert value to a valid Date: ${String(value)}`);
    }
    return d;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Formats a date value into a human-readable string using the given locale.
 *
 * The default format style is `{ dateStyle: 'long' }` which produces outputs
 * like "15 de marzo de 2026" (es-AR), "March 15, 2026" (en-US), or
 * "15 de março de 2026" (pt-BR). Pass custom `options` to override.
 *
 * @param input - {@link FormatDateInput} containing `date`, `locale`, and optional `options`
 * @returns Locale-aware formatted date string
 *
 * @throws {TypeError} When `date` is not a valid date value
 *
 * @example
 * ```ts
 * // Default long-form date
 * formatDate({ date: new Date('2026-03-15'), locale: 'es-AR' })
 * // => "15 de marzo de 2026"
 *
 * formatDate({ date: new Date('2026-03-15'), locale: 'en-US' })
 * // => "March 15, 2026"
 *
 * // Custom options: short date + time
 * formatDate({
 *   date: '2026-03-15T10:30:00Z',
 *   locale: 'es-AR',
 *   options: { dateStyle: 'short', timeStyle: 'short' }
 * })
 * // => "15/3/26 7:30 AM"
 *
 * // Unix timestamp
 * formatDate({ date: 1742000000000, locale: 'pt-BR' })
 * // => "11 de março de 2025"
 * ```
 */
export function formatDate({ date, locale, options }: FormatDateInput): string {
    const dateObj = toDate(date);
    const effectiveOptions: Intl.DateTimeFormatOptions = options ?? { dateStyle: 'long' };
    return new Intl.DateTimeFormat(locale, effectiveOptions).format(dateObj);
}

/**
 * Formats a number using locale-specific conventions (decimal separators,
 * grouping separators, etc.).
 *
 * @param input - {@link FormatNumberInput} containing `value`, `locale`, and optional `options`
 * @returns Locale-aware formatted number string
 *
 * @example
 * ```ts
 * formatNumber({ value: 1234567.89, locale: 'es-AR' })
 * // => "1.234.567,89"
 *
 * formatNumber({ value: 1234567.89, locale: 'en-US' })
 * // => "1,234,567.89"
 *
 * formatNumber({ value: 0.5, locale: 'pt-BR', options: { style: 'percent' } })
 * // => "50%"
 *
 * // Negative number
 * formatNumber({ value: -42.5, locale: 'es-AR' })
 * // => "-42,5"
 *
 * // Zero
 * formatNumber({ value: 0, locale: 'en-US' })
 * // => "0"
 * ```
 */
export function formatNumber({ value, locale, options }: FormatNumberInput): string {
    return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Formats a monetary value using locale-specific currency conventions.
 *
 * When `currency` is omitted the function infers a sensible default from
 * `locale`:
 * - `es` / `es-AR`  -> `ARS`
 * - `en` / `en-US`  -> `USD`
 * - `pt` / `pt-BR`  -> `BRL`
 *
 * @param input - {@link FormatCurrencyInput} containing `value`, `locale`, and optional `currency`
 * @returns Locale-aware formatted currency string
 *
 * @example
 * ```ts
 * // Default currency inferred from locale
 * formatCurrency({ value: 1500, locale: 'es-AR' })
 * // => "$ 1.500,00"
 *
 * formatCurrency({ value: 29.99, locale: 'en-US' })
 * // => "$29.99"
 *
 * formatCurrency({ value: 49.9, locale: 'pt-BR' })
 * // => "R$\u00a049,90"
 *
 * // Explicit currency override
 * formatCurrency({ value: 100, locale: 'es-AR', currency: 'USD' })
 * // => "US$ 100,00"
 *
 * // Negative amount
 * formatCurrency({ value: -250, locale: 'en-US' })
 * // => "-$250.00"
 *
 * // Zero
 * formatCurrency({ value: 0, locale: 'es-AR' })
 * // => "$ 0,00"
 * ```
 */
export function formatCurrency({ value, locale, currency }: FormatCurrencyInput): string {
    const resolvedCurrency = currency ?? resolveDefaultCurrency(locale);
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: resolvedCurrency
    }).format(value);
}
