/**
 * Subject resolution for the accommodation listing summary builder.
 *
 * The accommodation type filter is special: unlike other filters it becomes
 * the grammatical subject of the summary sentence rather than a modifier.
 * This module encapsulates all the logic for choosing the right subject phrase
 * and the correct total count to show alongside it.
 */

import { lookupTypeEntry } from './summary.catalogs';
import { formatNaturalList, pluralizeWord } from './summary.helpers';
import type {
    AccommodationSummaryFilters,
    SummaryCatalogs,
    SummaryGender,
    SummaryLocale,
    SummaryOptions
} from './summary.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input for {@link resolveSubject}. */
export interface ResolveSubjectInput {
    readonly filters: AccommodationSummaryFilters;
    readonly counts: {
        readonly globalTotal: number;
        readonly subjectTotal?: number | null;
        readonly shown: number;
    };
    readonly catalogs: SummaryCatalogs;
    readonly locale: SummaryLocale;
    readonly options: Required<Pick<SummaryOptions, 'maxTypesInSubjectList'>> & SummaryOptions;
}

/** Result from {@link resolveSubject}. */
export interface ResolvedSubject {
    /** The subject phrase to use in the sentence (e.g. "hoteles", "hospedajes"). */
    readonly subjectPhrase: string;
    /**
     * The total count to show in the "Mostrando X de {total}" fragment.
     * This is either `subjectTotal` (when the subject is specific) or `globalTotal`.
     */
    readonly total: number;
    /** Whether the subject fell back to the generic "hospedajes" phrase. */
    readonly isGeneric: boolean;
    /** Whether the subject phrase is plural (drives verb/participle agreement). */
    readonly isPlural: boolean;
    /** Grammatical gender of the subject (feminine only when every noun is). */
    readonly gender: SummaryGender;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Resolves the grammatical subject and the correct total count for the
 * summary sentence based on the active type filter.
 *
 * ### Subject selection rules
 *
 * 1. **No types selected** → generic subject ("hospedajes"), `globalTotal`.
 * 2. **1 type** → plural of that type ("hoteles"), `subjectTotal` if available.
 * 3. **2–N types** (where N = `maxTypesInSubjectList`, default 3) → natural
 *    list of plurals ("hoteles y cabañas"), `subjectTotal` if available.
 * 4. **More than N types** → degrade to generic subject, `globalTotal`.
 *
 * ### CRITICAL counter rule
 *
 * When the subject is specific (one or more types are selected) we MUST have
 * `subjectTotal` to show an accurate count. If `subjectTotal` is absent or
 * null we degrade to the generic subject and use `globalTotal` instead.
 *
 * The reason: showing "18 de 124 hoteles" when 124 is the global count (not
 * the hotel-specific count) would be deeply misleading to the user.
 *
 * @param input - {@link ResolveSubjectInput}
 * @returns {@link ResolvedSubject}
 *
 * @example
 * ```ts
 * // No types → generic
 * resolveSubject({ filters: {}, counts: { shown: 5, globalTotal: 124 }, ... })
 * // => { subjectPhrase: 'hospedajes', total: 124, isGeneric: true }
 *
 * // Single type with subjectTotal
 * resolveSubject({
 *   filters: { types: ['HOTEL'] },
 *   counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
 *   locale: 'es', ...
 * })
 * // => { subjectPhrase: 'hoteles', total: 42, isGeneric: false }
 *
 * // Single type WITHOUT subjectTotal → degrade
 * resolveSubject({
 *   filters: { types: ['HOTEL'] },
 *   counts: { shown: 18, globalTotal: 124, subjectTotal: null },
 *   locale: 'es', ...
 * })
 * // => { subjectPhrase: 'hospedajes', total: 124, isGeneric: true }
 * ```
 */
export function resolveSubject({
    filters,
    counts,
    catalogs,
    locale,
    options
}: ResolveSubjectInput): ResolvedSubject {
    const { maxTypesInSubjectList } = options;
    const types = filters.types ?? [];
    const typeEntries = catalogs.types ?? [];

    const genericSingular =
        locale === 'es' ? 'hospedaje' : locale === 'pt' ? 'hospedagem' : 'accommodation';
    const genericPlural =
        locale === 'es' ? 'hospedajes' : locale === 'pt' ? 'hospedagens' : 'accommodations';

    const buildGeneric = (): ResolvedSubject => ({
        subjectPhrase: pluralizeWord({
            count: counts.shown,
            singular: genericSingular,
            plural: genericPlural
        }),
        total: counts.globalTotal,
        isGeneric: true,
        isPlural: counts.shown !== 1,
        // "hospedagem" is feminine in Portuguese; "hospedaje" is masculine in Spanish.
        gender: locale === 'pt' ? 'feminine' : 'masculine'
    });

    // No types selected — always generic
    if (types.length === 0) {
        return buildGeneric();
    }

    // Too many types — degrade to generic
    if (types.length > maxTypesInSubjectList) {
        return buildGeneric();
    }

    // Specific types selected but subjectTotal is missing or null.
    // CRITICAL: we cannot show a specific subject with a misleading total.
    // Degrade to generic to avoid presenting e.g. "18 de 124 hoteles" when
    // 124 is the global count and not the hotel-specific count.
    if (counts.subjectTotal === null || counts.subjectTotal === undefined) {
        return buildGeneric();
    }

    // A single type agrees in number with the shown count ("1 de 1 cabaña").
    // A list of types stays plural: each noun would otherwise disagree.
    const useSingular = types.length === 1 && counts.shown === 1;
    const entries = types.map((typeKey) => lookupTypeEntry({ key: typeKey, entries: typeEntries }));

    // Fall back to the raw key when the type is not in the catalog
    const labels: string[] = entries.map((entry, index) =>
        entry ? (useSingular ? entry.singular[locale] : entry.plural[locale]) : (types[index] ?? '')
    );

    const allFeminine = entries.every((entry) => entry?.gender?.[locale] === 'feminine');

    const conjunction = locale === 'es' ? 'y' : locale === 'pt' ? 'e' : 'and';
    const subjectPhrase = formatNaturalList({ items: labels, conjunction });

    return {
        subjectPhrase,
        total: counts.subjectTotal,
        isGeneric: false,
        isPlural: !useSingular,
        gender: allFeminine ? 'feminine' : 'masculine'
    };
}
