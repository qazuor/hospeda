/**
 * Main orchestrator for the post listing summary builder.
 *
 * Produces a single human-readable sentence describing the active filters,
 * shown / total counts, and sort. Examples:
 *
 * - "Mostrando 12 de 12 publicaciones, sin filtros activos, ordenadas por publicación más reciente."
 * - "Mostrando 3 de 4 publicaciones sobre Concordia, ordenadas por publicación más reciente."
 * - "Mostrando 1 de 1 publicación de cultura sobre Gualeguaychú, solo destacadas."
 * - "No se encontraron publicaciones que contienen \"feria\" en el título o el contenido."
 *
 * Mirrors `event-listing-summary/summary.builder` in pipeline and joining
 * rules, but with post-specific descriptors and a fixed subject
 * ("publicaciones") since posts do not have a type-driven subject phrase.
 */

import { toBcp47Locale } from '@repo/i18n/web';
import { SORT_KEY_PHRASES, getPhrase } from './summary.catalogs';
import { FILTER_DESCRIPTORS } from './summary.descriptors';
import type {
    BuildPostListingSummaryInput,
    FilterDescriptorContext,
    SummaryLocale
} from './summary.types';

const DEFAULT_LOCALE: SummaryLocale = 'es';

/**
 * Joins descriptor fragments. Flow modifiers (category, destination) attach
 * to the subject with a space; `text` flows when it is the only flow modifier
 * and comma-joins when destination is also active. All other modifiers are
 * comma-joined.
 *
 * Examples:
 *   - "publicaciones de cultura"                       (category flow)
 *   - "publicaciones de cultura sobre Concordia"       (category + destination flow)
 *   - "publicaciones sobre Concordia, que contienen \"feria\"…" (text gets a comma)
 */
function assembleModifiers(
    fragments: ReadonlyArray<{ key: string; text: string }>,
    destinationActive: boolean
): string {
    let out = '';
    for (const f of fragments) {
        if (!f.text) continue;
        if (f.key === 'category' || f.key === 'destination') {
            out += ` ${f.text}`;
        } else if (f.key === 'text') {
            out += destinationActive ? `, ${f.text}` : ` ${f.text}`;
        } else {
            out += `, ${f.text}`;
        }
    }
    return out;
}

/** Build the "ordenadas por X" trailing clause from the encoded sort key. */
function buildSortPhrase(sortKey: string | undefined, locale: SummaryLocale): string {
    if (!sortKey) return '';
    const entry = SORT_KEY_PHRASES[sortKey];
    if (!entry) return '';
    const sortedBy = getPhrase({ locale, key: 'sortedBy' });
    return `${sortedBy} ${entry[locale]}`;
}

/**
 * Build the natural-language summary sentence for a post listing.
 * Always returns a single sentence ending with a period.
 */
export function buildPostListingSummary({
    locale: rawLocale,
    filters,
    counts,
    sort,
    catalogs: rawCatalogs,
    options: rawOptions
}: BuildPostListingSummaryInput): string {
    const locale: SummaryLocale = rawLocale ?? DEFAULT_LOCALE;
    const intlLocale = toBcp47Locale(locale);
    const catalogs = {
        destinations: rawCatalogs?.destinations,
        categories: rawCatalogs?.categories
    };
    const options = { ...rawOptions };

    // Subject phrase: posts always use a fixed plural — the type is not the
    // sentence subject the way `hoteles` is for accommodations.
    const subjectPlural = getPhrase({ locale, key: 'postPlural' });
    const subjectSingular = getPhrase({ locale, key: 'postSingular' });
    const subjectPhrase = counts.total === 1 ? subjectSingular : subjectPlural;

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
        text: d.build({ context })
    }));
    const destinationActive = activeDescriptors.some((d) => d.key === 'destination');
    const sortPhrase = buildSortPhrase(sort?.sortKey, locale);
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
