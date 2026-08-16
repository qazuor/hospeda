/**
 * @file rank-city-suggestions.ts
 * @description Client-side ranking for the accommodation sign-up city
 * autocomplete (H-136, smoke agosto 2026).
 *
 * The public destinations endpoint matches accent-blindly, so a host typing
 * `colon` gets `Colón` back. Ranking those results on the RAW strings would
 * then score that hit as neither exact nor prefix — `'colón'.startsWith('colon')`
 * is false — and drop it below a plain alphabetical tie-break. The right city
 * would come back from the server and still sort last.
 *
 * So the ranking folds accents on the same terms the search does. Folding is
 * used for COMPARISON ONLY: the returned items are untouched and keep
 * rendering their catalog names with accents intact.
 */

/** The minimum shape this ranking needs. Matches `SelectableItem`. */
export interface RankableCityItem {
    readonly id: string;
    readonly label: string;
}

/**
 * Lowercases, trims and strips accents.
 *
 * Folds `ñ` to `n`. That looks wrong at first — `ñ` is a letter in Spanish,
 * not an accented `n` — but this must agree with PostgreSQL's `unaccent()`,
 * which returns `Canada` for `Cañada` (verified against production). Folding
 * less than the server does would score a row the search legitimately returned
 * as a non-match and sort it last, which is the bug this helper exists to
 * prevent. Do not "fix" it without changing the server side too.
 *
 * @param value - A user query or a destination name.
 * @returns The lowercased, accent-free form.
 */
export function foldForRanking(value: string): string {
    return (
        value
            .trim()
            .toLowerCase()
            .normalize('NFD')
            // \p{Mn} (nonspacing marks) after NFD is the idiomatic accent strip
            // and avoids biome's noMisleadingCharacterClass.
            .replace(/\p{Mn}/gu, '')
    );
}

/**
 * Orders city suggestions so the closest match to what the host typed comes
 * first: exact name, then prefix match, then alphabetical.
 *
 * Accent-insensitive in both directions — an unaccented query ranks an
 * accented city, and an accented query ranks an unaccented one.
 *
 * @param input - The raw query and the items returned by the endpoint.
 * @returns A new array, sorted. The input array is not mutated.
 */
export function rankCitySuggestions<T extends RankableCityItem>(input: {
    readonly query: string;
    readonly items: readonly T[];
}): readonly T[] {
    const needle = foldForRanking(input.query);

    return [...input.items].sort((a, b) => {
        const an = foldForRanking(a.label);
        const bn = foldForRanking(b.label);

        const aExact = an === needle;
        const bExact = bn === needle;
        if (aExact !== bExact) return aExact ? -1 : 1;

        const aStarts = an.startsWith(needle);
        const bStarts = bn.startsWith(needle);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;

        return an.localeCompare(bn);
    });
}
