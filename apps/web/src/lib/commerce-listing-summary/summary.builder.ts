/**
 * Main orchestrator for the commerce listing summary builder
 * (gastronomy + experience, BETA-119).
 *
 * Produces a single human-readable sentence describing the active filters,
 * shown / total counts, and sort. Examples:
 *
 * - "Mostrando 9 de 18 establecimientos gastronómicos, sin filtros activos, ordenados con los destacados primero."
 * - "Mostrando 3 de 4 experiencias en Concordia, ordenadas con las destacadas primero."
 * - "Mostrando 1 de 1 establecimiento gastronómico de restaurante en Colón, con precios económicos."
 * - "No se encontraron experiencias que contienen \"kayak\" en el nombre o la descripción."
 *
 * Mirrors `post-listing-summary/summary.builder` and
 * `event-listing-summary/summary.builder` in pipeline and joining rules, but
 * is parametrized by {@link CommerceEntityConfig} so a single builder serves
 * both entities (see `summary.types.ts` for the rationale).
 */

import { getGenderedPhrase, getPhrase, getSortPhraseFragment } from './summary.catalogs';
import { FILTER_DESCRIPTORS } from './summary.descriptors';
import type {
    BuildCommerceListingSummaryInput,
    EntityGender,
    FilterDescriptorContext,
    SummaryLocale
} from './summary.types';

const DEFAULT_LOCALE: SummaryLocale = 'es';

/**
 * Joins descriptor fragments. Flow modifiers (type, destination) attach to
 * the subject with a space; `text` flows when it is the only flow modifier
 * and comma-joins when destination is also active. All other modifiers are
 * comma-joined.
 *
 * Examples:
 *   - "establecimientos gastronómicos de restaurante"                    (type flow)
 *   - "establecimientos gastronómicos de restaurante en Colón"          (type + destination flow)
 *   - "experiencias en Concordia, que contienen \"kayak\"…"             (text gets a comma)
 */
function assembleModifiers(
    fragments: ReadonlyArray<{ key: string; text: string }>,
    destinationActive: boolean
): string {
    let out = '';
    for (const f of fragments) {
        if (!f.text) continue;
        if (f.key === 'type' || f.key === 'destination') {
            out += ` ${f.text}`;
        } else if (f.key === 'text') {
            out += destinationActive ? `, ${f.text}` : ` ${f.text}`;
        } else {
            out += `, ${f.text}`;
        }
    }
    return out;
}

/** Build the "ordenados/ordenadas con los/las destacados/destacadas primero" trailing clause from the encoded sort key. */
function buildSortPhrase({
    sortKey,
    locale,
    gender
}: {
    readonly sortKey: string | undefined;
    readonly locale: SummaryLocale;
    readonly gender: EntityGender;
}): string {
    if (!sortKey) return '';
    const fragment = getSortPhraseFragment({ sortKey, locale, gender });
    if (!fragment) return '';
    const sortedBy = getGenderedPhrase({ locale, key: 'sortedBy', gender });
    return `${sortedBy} ${fragment}`;
}

/**
 * Build the natural-language summary sentence for a commerce (gastronomy or
 * experience) listing. Always returns a single sentence ending with a
 * period. Page authors should not call this directly — use
 * `buildGastronomyListingSummary` / `buildExperienceListingSummary` from
 * `index.ts`, which supply the fixed entity config.
 */
export function buildCommerceListingSummary({
    locale: rawLocale,
    entity,
    filters,
    counts,
    sort,
    catalogs: rawCatalogs
}: BuildCommerceListingSummaryInput): string {
    const locale: SummaryLocale = rawLocale ?? DEFAULT_LOCALE;
    const catalogs = {
        destinations: rawCatalogs?.destinations,
        types: rawCatalogs?.types,
        priceRanges: rawCatalogs?.priceRanges
    };

    const subjectPhrase =
        counts.total === 1 ? entity.subjectSingular[locale] : entity.subjectPlural[locale];

    const context: FilterDescriptorContext = {
        locale,
        filters,
        catalogs,
        entity
    };

    const activeDescriptors = FILTER_DESCRIPTORS.filter((d) => d.isActive({ filters, entity }));
    const fragments = activeDescriptors.map((d) => ({
        key: d.key,
        text: d.build({ context })
    }));
    const destinationActive = activeDescriptors.some((d) => d.key === 'destination');
    const sortPhrase = buildSortPhrase({ sortKey: sort?.sortKey, locale, gender: entity.gender });
    const sortPart = sortPhrase ? `, ${sortPhrase}` : '';

    // Zero-results early return.
    if (counts.total === 0) {
        const noResultsFound = getPhrase({ locale, key: 'noResultsFound' });
        const modifierStr = assembleModifiers(fragments, destinationActive);
        return `${noResultsFound} ${subjectPhrase}${modifierStr}.`.replace(/ {2,}/g, ' ');
    }

    const showing = getPhrase({ locale, key: 'showing' });
    const ofWord = getPhrase({ locale, key: 'of' });
    const countFragment = `${showing} ${counts.shown} ${ofWord} ${counts.total}`;

    if (fragments.length === 0) {
        const noFilters = getPhrase({ locale, key: 'noFiltersActive' });
        return `${countFragment} ${subjectPhrase}, ${noFilters}${sortPart}.`.replace(/ {2,}/g, ' ');
    }

    const modifierStr = assembleModifiers(fragments, destinationActive);
    return `${countFragment} ${subjectPhrase}${modifierStr}${sortPart}.`.replace(/ {2,}/g, ' ');
}
