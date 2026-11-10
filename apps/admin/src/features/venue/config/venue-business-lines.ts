/**
 * @file venue-business-lines.ts
 * Business-line options for the venue admin surfaces (HOS-1873).
 *
 * The catalog decides the options; every consumer here only renders what
 * `resolveBusinessLineOptions` returns. Nothing in this file compares, indexes
 * or searches business-line values (G-FAC-03).
 */

import type { TranslationKey } from '@repo/i18n';
import type { BusinessLineValue } from '@repo/schemas';
import { resolveBusinessLineOptions } from '@repo/schemas';

/** One rendered business-line option for the admin form / list. */
export interface VenueBusinessLineOption {
    /** Catalog value, used as the form value and filter value. */
    readonly value: BusinessLineValue<'venue'>;
    /** Translated label. */
    readonly label: string;
}

/** One filter option: the list resolves its own labels from the key. */
export interface VenueBusinessLineFilterOption {
    /** Catalog value, sent as the `businessLine` query parameter. */
    readonly value: BusinessLineValue<'venue'>;
    /** i18n key for the label. */
    readonly labelKey: string;
}

/** Vertical whose catalog feeds every option in this module. */
const VENUE_VERTICAL = 'venue' as const;

/**
 * Reads every venue business-line value from the catalog.
 *
 * An empty type marks each option `NOT_ALLOWED_FOR_TYPE`; only `value` is used
 * here, because the filters and the list render every line regardless of type.
 *
 * @returns The catalog values in catalog order.
 */
function resolveVenueBusinessLineValues(): { readonly value: BusinessLineValue<'venue'> }[] {
    return resolveBusinessLineOptions({
        vertical: VENUE_VERTICAL,
        type: '',
        selected: []
    }).map(({ value }) => ({ value }));
}

/**
 * Builds the translated options for the venue form's business-line field.
 *
 * @param input - Translation function from `useTranslations()`.
 * @param input.t - Translation function.
 * @returns The catalog options with their approved labels (DEC-FAC-068).
 */
export function getVenueBusinessLineOptions({
    t
}: {
    readonly t: (key: TranslationKey) => string;
}): VenueBusinessLineOption[] {
    return resolveVenueBusinessLineValues().map(({ value }) => ({
        value,
        label: t(`venue.owner.businessLines.${value}.label`)
    }));
}

/**
 * Builds the options for the venue list filter.
 *
 * The filter bar resolves label keys at render time, so the label is returned
 * as a key instead of a translated string.
 *
 * @returns The catalog options with their label keys.
 */
export function getVenueBusinessLineFilterOptions(): VenueBusinessLineFilterOption[] {
    return resolveVenueBusinessLineValues().map(({ value }) => ({
        value,
        labelKey: `venue.owner.businessLines.${value}.label`
    }));
}

/**
 * Whether the venue vertical offers a business-line choice at all.
 *
 * The catalog decides the count: a vertical with a single line gets no field,
 * column or filter.
 *
 * @param input - Options resolved from the venue catalog.
 * @param input.options - The resolved options.
 * @returns `true` when more than one line is available.
 */
export function hasBusinessLineChoice({
    options
}: {
    readonly options: readonly { readonly value: string }[];
}): boolean {
    return options.length > 1;
}
