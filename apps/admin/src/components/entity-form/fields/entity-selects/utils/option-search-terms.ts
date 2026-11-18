/**
 * @file option-search-terms.ts
 * @description Client-mode filtering for entity selects (HOS-2340).
 *
 * Options that carry `metadata.searchTerms` (`{ nameI18n, keywordsI18n }`) are
 * searched and ranked with the shared `matchSearchItems` (accent and case
 * insensitive, token-prefix, name before keyword). Every other option keeps the
 * historic `label.toLowerCase().includes(query.toLowerCase())` filter, so the
 * selectors that do not opt in behave exactly as before.
 */

import type { SearchableTerms, SearchLocale } from '@repo/utils';
import { matchSearchItems } from '@repo/utils';
import {
    SELECT_OPTION_SEARCH_TERMS_KEY,
    type SelectOption
} from '@/components/entity-form/types/field-config.types';

/** Locales an admin may type in: labels resolve es, then en, then pt. */
const ADMIN_SEARCH_LOCALES: readonly SearchLocale[] = ['es', 'en', 'pt'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isLocaleStringMap = (value: unknown): boolean =>
    isRecord(value) &&
    Object.values(value).every((entry) => entry == null || typeof entry === 'string');

const isLocaleKeywordMap = (value: unknown): boolean =>
    isRecord(value) &&
    Object.values(value).every(
        (entry) =>
            entry == null ||
            (Array.isArray(entry) && entry.every((word) => typeof word === 'string'))
    );

/**
 * Reads and validates the search terms of an option. The metadata is untyped
 * (`Record<string, unknown>`), so a malformed value yields `undefined` and the
 * caller falls back to `includes()`; this never throws.
 *
 * @param option - The select option.
 * @returns The terms, or `undefined` when absent or malformed.
 */
export function getSearchTerms(option: SelectOption): SearchableTerms | undefined {
    const raw = option.metadata?.[SELECT_OPTION_SEARCH_TERMS_KEY];
    if (!isRecord(raw) || !isLocaleStringMap(raw.nameI18n)) return undefined;
    if (raw.keywordsI18n !== undefined && !isLocaleKeywordMap(raw.keywordsI18n)) return undefined;
    return raw as unknown as SearchableTerms;
}

/**
 * Filters the options of a client-mode select for a typed query.
 *
 * Options with valid search terms are matched and ranked by the shared matcher
 * (name matches first, then keyword matches, server order inside each rank) and
 * come first; the rest are filtered with `includes()` and keep their order.
 * Blank queries are the caller's concern (`showAllWhenEmpty`).
 *
 * @param input.options - All loaded options, in server order.
 * @param input.query - Raw text typed by the user.
 * @returns The matching options.
 */
export function filterClientOptions({
    options,
    query
}: {
    readonly options: readonly SelectOption[];
    readonly query: string;
}): SelectOption[] {
    const withTerms: { option: SelectOption; terms: SearchableTerms }[] = [];
    const plain: SelectOption[] = [];
    for (const option of options) {
        const terms = getSearchTerms(option);
        if (terms) withTerms.push({ option, terms });
        else plain.push(option);
    }

    const ranked = matchSearchItems({
        items: withTerms,
        query,
        locales: ADMIN_SEARCH_LOCALES,
        getTerms: (entry) => entry.terms
    }).map((entry) => entry.option);
    const included = plain.filter((option) =>
        option.label.toLowerCase().includes(query.toLowerCase())
    );
    return [...ranked, ...included];
}
