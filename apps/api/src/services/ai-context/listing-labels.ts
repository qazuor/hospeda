/**
 * Human labels for the closed values the AI-chat context blocks render (HOS-2095).
 *
 * The context builders used to interpolate enum values and catalog slugs as-is
 * (`MID`, `CABIN`, `BAR`, `pet_friendly`), and the model relayed them verbatim
 * to the visitor ("El rango de precios es MID"). Every label here comes from the
 * same `@repo/i18n` keys the public pages use, resolved for the page locale with
 * an `es` fallback (the pattern `venue-night-context.ts` already follows). When
 * neither locale has the key, the value degrades to a humanized form of the code
 * (`infinity_pool_xl` → `Infinity pool xl`), never to the raw code.
 *
 * Nothing in this module is owner free text: the inputs are closed enums and
 * catalog slugs, so the outputs are rendered UNFENCED, exactly like the raw
 * values they replace.
 *
 * @module apps/api/services/ai-context/listing-labels
 */

import { formatNumber, type Locale, trans } from '@repo/i18n';

/**
 * Resolves one flattened translation key for `locale`, falling back to `es`.
 *
 * @param input.key - Flattened translation key.
 * @param input.locale - Page locale.
 * @returns `{ label }`, `null` when neither locale has a non-empty value.
 */
export function translateCatalogKey({
    key,
    locale
}: {
    readonly key: string;
    readonly locale: Locale;
}): { readonly label: string | null } {
    for (const candidate of [trans[locale]?.[key], trans.es?.[key]]) {
        const value = (candidate ?? '').trim();
        if (value.length > 0) return { label: value };
    }
    return { label: null };
}

/**
 * Turns a code into readable words: `COUNTRY_HOUSE` → `Country house`,
 * `pet-friendly` → `Pet friendly`. The last-resort fallback for a code that has
 * no catalog label, so the visitor never sees the raw code.
 *
 * @param input.code - The enum value or slug.
 * @returns `{ label }`, the humanized string (empty for empty input).
 */
export function humanizeCode({ code }: { readonly code: string }): { readonly label: string } {
    const words = code.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    return { label: words.length > 0 ? words.charAt(0).toUpperCase() + words.slice(1) : '' };
}

/**
 * Returns true when `value` looks like a code (slug or enum) rather than prose:
 * no spaces and only letters, digits, `_` or `-`, with at least one separator
 * or an all-caps shape. Used so a value that is ALREADY a label (tests and
 * legacy callers pass `"WiFi"`) is rendered untouched.
 */
function looksLikeCode(value: string): boolean {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) return false;
    return /[_-]/.test(value) || value === value.toUpperCase() || value === value.toLowerCase();
}

/**
 * Resolves a code to its catalog label, or to a humanized form of it.
 *
 * @param input.code - The enum value or slug.
 * @param input.keys - Candidate translation keys, tried in order.
 * @param input.locale - Page locale.
 * @returns `{ label }`, never the raw code when the code looks like one.
 */
function labelFor({
    code,
    keys,
    locale
}: {
    readonly code: string;
    readonly keys: readonly string[];
    readonly locale: Locale;
}): { readonly label: string } {
    for (const key of keys) {
        const { label } = translateCatalogKey({ key, locale });
        if (label) return { label };
    }
    return looksLikeCode(code) ? humanizeCode({ code }) : { label: code };
}

/** Label of an `AccommodationTypeEnum` value (`accommodations.types.<lowercase>`). */
export function accommodationTypeLabel({
    type,
    locale
}: {
    readonly type: string;
    readonly locale: Locale;
}): { readonly label: string } {
    return labelFor({ code: type, keys: [`accommodations.types.${type.toLowerCase()}`], locale });
}

/** Label of an amenity slug (`accommodations.amenityNames.<slug>`). */
export function amenityLabel({
    slug,
    locale
}: {
    readonly slug: string;
    readonly locale: Locale;
}): { readonly label: string } {
    return labelFor({ code: slug, keys: [`accommodations.amenityNames.${slug}`], locale });
}

/** Label of a feature slug (`accommodations.featureNames.<slug>`). */
export function featureLabel({
    slug,
    locale
}: {
    readonly slug: string;
    readonly locale: Locale;
}): { readonly label: string } {
    return labelFor({ code: slug, keys: [`accommodations.featureNames.${slug}`], locale });
}

/** Label of a `VenueTypeEnum` value (`venue.types.<TYPE>`). */
export function venueTypeLabel({
    type,
    locale
}: {
    readonly type: string;
    readonly locale: Locale;
}): { readonly label: string } {
    return labelFor({ code: type, keys: [`venue.types.${type}`], locale });
}

/** Label of a `PriceRangeEnum` value (`venue.card.priceRange.<VALUE>`). */
export function priceRangeLabel({
    priceRange,
    locale
}: {
    readonly priceRange: string;
    readonly locale: Locale;
}): { readonly label: string } {
    return labelFor({ code: priceRange, keys: [`venue.card.priceRange.${priceRange}`], locale });
}

/** Label of an `ExperienceTypeEnum` value (`experience.type.<TYPE>`). */
export function experienceTypeLabel({
    type,
    locale
}: {
    readonly type: string;
    readonly locale: Locale;
}): { readonly label: string } {
    return labelFor({ code: type, keys: [`experience.type.${type}`], locale });
}

/** Label of an `ExperiencePriceUnitEnum` value (`experience.priceUnit.<unit>`). */
export function experiencePriceUnitLabel({
    unit,
    locale
}: {
    readonly unit: string;
    readonly locale: Locale;
}): { readonly label: string } {
    return labelFor({ code: unit, keys: [`experience.priceUnit.${unit}`], locale });
}

/**
 * Formats a money amount for the context block, e.g. `$ 4.500` (es-AR).
 *
 * Whole amounts drop the decimals (`$ 4.500`, not `$ 4.500,00`) because the
 * model relays the string as-is; a fractional amount keeps two decimals.
 *
 * @param input.amount - The amount in currency units (pesos, NOT centavos).
 * @param input.locale - Page locale (drives grouping and decimal separators).
 * @param input.currency - ISO currency code; defaults to `ARS`.
 * @returns `{ text }`, the formatted amount.
 */
export function formatContextMoney({
    amount,
    locale,
    currency = 'ARS'
}: {
    readonly amount: number;
    readonly locale: Locale;
    readonly currency?: string;
}): { readonly text: string } {
    const fractionDigits = Number.isInteger(amount) ? 0 : 2;
    return {
        text: formatNumber({
            value: amount,
            locale,
            options: {
                style: 'currency',
                currency,
                currencyDisplay: 'symbol',
                minimumFractionDigits: fractionDigits,
                maximumFractionDigits: fractionDigits
            }
        })
    };
}
