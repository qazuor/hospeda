/**
 * Main orchestrator for the accommodation listing summary builder.
 *
 * Transforms filters, counts, and sort options into a single human-readable
 * summary sentence such as:
 *
 * - "Mostrando 18 de 42 hoteles en Colón."
 * - "Mostrando 31 de 67 hoteles y cabañas en Colón o Concordia, con precio de hasta $20.000."
 * - "Mostrando 124 de 124 hospedajes, sin filtros activos, ordenados por nombre, A a Z."
 */

import { toBcp47Locale } from '@repo/i18n';
import { DEFAULT_SORT_KEYS, DEFAULT_TYPE_GRAMMAR, getPhrase } from './summary.catalogs';
import { FILTER_DESCRIPTORS, FLOW_MODIFIER_KEYS } from './summary.descriptors';
import { buildSortPhrase } from './summary.sort';
import { resolveSubject } from './summary.subject';
import type {
    BuildAccommodationListingSummaryInput,
    FilterDescriptorContext,
    MatchMode,
    QuantityMode,
    SummaryLocale,
    SummaryOptions
} from './summary.types';

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_LOCALE: SummaryLocale = 'es';
const DEFAULT_MAX_TYPES = 3;

const DEFAULT_MATCH_MODE: Required<NonNullable<SummaryOptions['matchMode']>> = {
    services: 'any' as MatchMode,
    amenities: 'any' as MatchMode,
    destinations: 'any' as MatchMode
};

const DEFAULT_QUANTITY_MODE: Required<NonNullable<SummaryOptions['quantityMode']>> = {
    guests: 'atLeast' as QuantityMode,
    bedrooms: 'atLeast' as QuantityMode,
    bathrooms: 'atLeast' as QuantityMode
};

// ---------------------------------------------------------------------------
// Joining logic helpers
// ---------------------------------------------------------------------------

/**
 * Assembles modifier fragments into the full modifiers string that gets
 * appended after the subject phrase.
 *
 * Joining rules:
 * - `destination` → space-joined directly after subject: " en Colón"
 * - `text` → space-joined when it is the only flow modifier, comma-joined
 *   when `destination` is also active: ", que contienen..."
 * - All other modifiers → comma-joined: ", con precio..."
 *
 * The returned string starts with the appropriate separator so it can be
 * concatenated directly with the subject phrase.
 */
function assembleModifiers(
    fragments: ReadonlyArray<{ key: string; text: string; isFlow: boolean }>,
    destinationActive: boolean
): string {
    let result = '';

    for (const fragment of fragments) {
        if (fragment.key === 'destination') {
            // Flow: space only
            result += ` ${fragment.text}`;
        } else if (fragment.key === 'text') {
            // Flow when destination is NOT active, comma when it IS active
            if (destinationActive) {
                result += `, ${fragment.text}`;
            } else {
                result += ` ${fragment.text}`;
            }
        } else {
            // Comma modifier — always prefixed with ", "
            result += `, ${fragment.text}`;
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Builds a human-readable summary sentence for an accommodation listing result.
 *
 * ### Pipeline
 *
 * 1. Normalise input (apply defaults for locale, options, catalogs).
 * 2. Resolve subject via `resolveSubject()` — handles type filter as sentence subject.
 * 3. Build the count fragment: "Mostrando {shown} de {total}".
 * 4. Evaluate active filter descriptors.
 * 5. If no active filters: append "sin filtros activos" and optional sort phrase.
 * 6. If filters active: assemble modifier fragments using flow/comma joining rules.
 * 7. Append sort phrase (always after a comma).
 * 8. Ensure sentence ends with a single period.
 *
 * ### Joining rules
 *
 * - `destination` attaches to the subject with a space: "hoteles en Colón"
 * - `text` attaches with a space when it is the only flow modifier, or with a
 *   comma when `destination` is also active: "hoteles en Colón, que contienen..."
 * - All other modifiers (price, guests, bedrooms, …) are joined with ", ".
 * - The sort phrase is always separated by ", ".
 *
 * @param input - {@link BuildAccommodationListingSummaryInput}
 * @returns Complete summary sentence ending with a period
 *
 * @example
 * ```ts
 * buildAccommodationListingSummary({
 *   locale: 'es',
 *   filters: { types: ['HOTEL'], destinations: ['colon'] },
 *   counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
 *   catalogs: { destinations: [{ key: 'colon', label: { es: 'Colón', en: 'Colón' } }] },
 * })
 * // => 'Mostrando 18 de 42 hoteles en Colón.'
 * ```
 */
export function buildAccommodationListingSummary({
    locale: rawLocale,
    filters,
    counts,
    sort,
    catalogs: rawCatalogs,
    options: rawOptions
}: BuildAccommodationListingSummaryInput): string {
    // 1. Normalise
    const locale: SummaryLocale = rawLocale ?? DEFAULT_LOCALE;
    const intlLocale = toBcp47Locale(locale);

    const catalogs = {
        types: rawCatalogs?.types ?? DEFAULT_TYPE_GRAMMAR,
        destinations: rawCatalogs?.destinations,
        services: rawCatalogs?.services,
        amenities: rawCatalogs?.amenities,
        sortKeys: rawCatalogs?.sortKeys ?? DEFAULT_SORT_KEYS
    };

    const options = {
        ...rawOptions,
        maxTypesInSubjectList: rawOptions?.maxTypesInSubjectList ?? DEFAULT_MAX_TYPES,
        matchMode: {
            ...DEFAULT_MATCH_MODE,
            ...rawOptions?.matchMode
        },
        quantityMode: {
            ...DEFAULT_QUANTITY_MODE,
            ...rawOptions?.quantityMode
        }
    };

    // 2. Resolve subject
    const { subjectPhrase, total } = resolveSubject({
        filters,
        counts,
        catalogs,
        locale,
        options
    });

    // 3. Zero-results early return
    if (total === 0) {
        const noResultsFound = getPhrase({ locale, key: 'noResultsFound' });
        const context: FilterDescriptorContext = {
            locale,
            intlLocale,
            filters,
            catalogs,
            options
        };
        const activeDescriptors = FILTER_DESCRIPTORS.filter((d) => d.isActive({ filters }));
        const fragments = activeDescriptors.map((d) => ({
            key: d.key,
            text: d.build({ context }),
            isFlow: FLOW_MODIFIER_KEYS.has(d.key)
        }));
        const destinationActive = activeDescriptors.some((d) => d.key === 'destination');
        const modifierStr = assembleModifiers(fragments, destinationActive);
        return `${noResultsFound} ${subjectPhrase}${modifierStr}.`.replace(/ {2,}/g, ' ');
    }

    // 4. Count fragment: "Mostrando 18 de 42"
    const showing = getPhrase({ locale, key: 'showing' });
    const of = getPhrase({ locale, key: 'of' });
    const countFragment = `${showing} ${counts.shown} ${of} ${total}`;

    // 5. Build descriptor context
    const context: FilterDescriptorContext = {
        locale,
        intlLocale,
        filters,
        catalogs,
        options
    };

    // 5. Evaluate active descriptors
    const activeDescriptors = FILTER_DESCRIPTORS.filter((d) => d.isActive({ filters }));

    // 6. No active non-type filters
    if (activeDescriptors.length === 0) {
        const sortPhrase = buildSortPhrase({ sort, catalogs, locale });
        const sortPart = sortPhrase ? `, ${sortPhrase}` : '';
        // Only show "sin filtros activos" when types are also absent.
        // If the user selected types, the subject phrase already reflects the
        // filter ("hoteles", "cabañas y hoteles", etc.) — no extra clause needed.
        if ((filters.types?.length ?? 0) === 0) {
            const noFilters = getPhrase({ locale, key: 'noFiltersActive' });
            return `${countFragment} ${subjectPhrase}, ${noFilters}${sortPart}.`;
        }
        return `${countFragment} ${subjectPhrase}${sortPart}.`;
    }

    // 7. Build modifier fragments
    const fragments = activeDescriptors.map((d) => ({
        key: d.key,
        text: d.build({ context }),
        isFlow: FLOW_MODIFIER_KEYS.has(d.key)
    }));

    const destinationActive = activeDescriptors.some((d) => d.key === 'destination');
    const modifierStr = assembleModifiers(fragments, destinationActive);

    // 8. Build sort phrase
    const sortPhrase = buildSortPhrase({ sort, catalogs, locale });
    const sortPart = sortPhrase ? `, ${sortPhrase}` : '';

    // 9. Assemble: "Mostrando 18 de 42 hoteles en Colón, con precio de hasta $20.000."
    const sentence = `${countFragment} ${subjectPhrase}${modifierStr}${sortPart}.`;

    // 10. Post-process: collapse any double spaces that might have crept in
    return sentence.replace(/ {2,}/g, ' ');
}
