/**
 * Accommodation Import — curated locality aliases (HOS-346)
 *
 * A closed map from a normalized scraped locality to a catalog destination
 * **slug**, for the abbreviations listing sites emit that no substring search
 * can reach: `"C. del Uruguay"` does not occur inside `"Concepción del
 * Uruguay"`, so `ILIKE '%c. del uruguay%'` returns nothing at all.
 *
 * ## Why a table and not a matcher
 *
 * The previous attempt at this problem layered exact / alias / containment /
 * tokens / Levenshtein matching plus address-qualifier parsing, and five rounds
 * of adversarial review found a confidently-wrong pre-fill in whatever the
 * previous round had added (PR #2529, HOS-346). The lesson recorded there:
 *
 * > The danger is not the ambiguous match, it is the **single wrong** match.
 * > The review UI pre-fills when there is exactly one candidate, so **every
 * > layer able to return one row is an automatic-write path.**
 *
 * A table is the one such layer whose failure surface is **enumerable**. It
 * cannot surprise anyone with `Colonia Elía → Colón`, because `colonia elia` is
 * simply not a key. Every single-row answer it can produce was approved by a
 * human once, at review time. A heuristic's failure surface is the interaction
 * between its layers, which is not enumerable — that is what defeated five
 * rounds of review.
 *
 * ## Rules for adding an entry
 *
 * 1. **Only what was observed in a real payload.** `"C. del Uruguay"` is the
 *    exact string measured on MercadoLibre item `MLA1771107139`. Plausible
 *    abbreviations (`Gchú`, `Cdad.`, `Pto.`) are guesses, not data — they earn
 *    an entry when they show up in a payload, not before.
 * 2. **Never add an ambiguous alias.** If the abbreviation could name two real
 *    places in the region, it stays out and the host picks. Ambiguity is the
 *    safe outcome.
 * 3. **Map to the slug, not the name.** Two catalog slugs do not derive from
 *    their name (`liebig` → "Pueblo Liebig", `paranacito` → "Villa Paranacito").
 * 4. Keys are stored already normalized by {@link normalizeLocalityKey}, and
 *    matched on the WHOLE locality string — never as a substring.
 *
 * @module services/accommodation-import/resolvers/locality-aliases
 */

/**
 * Normalizes a locality string into an alias-table key: lowercase, accents
 * stripped, every non-alphanumeric run collapsed to a single space, trimmed.
 *
 * Deliberately identical to the normalization the resolver applies to catalog
 * names, so `"C. del Uruguay"`, `"c. del uruguay"` and `"C DEL URUGUAY"` are
 * the same key.
 *
 * @param value - A scraped locality string.
 * @returns The normalized lookup key.
 */
export function normalizeLocalityKey(value: string): string {
    return (
        value
            .toLowerCase()
            .normalize('NFD')
            // \p{Mn} (nonspacing marks) after NFD is the idiomatic accent strip
            // and avoids biome's noMisleadingCharacterClass.
            .replace(/\p{Mn}/gu, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
    );
}

/**
 * Normalized locality → catalog destination slug.
 *
 * Intentionally tiny. It grows by observation, one measured payload at a time;
 * see the rules in the module header before adding to it.
 */
const LOCALITY_ALIAS_ENTRIES: readonly (readonly [string, string])[] = [
    // MercadoLibre item MLA1771107139, measured 2026-08-15 (smoke agosto 2026,
    // finding H-97). ML emits the city abbreviated; the catalog row is
    // "Concepción del Uruguay", which the substring search cannot reach.
    ['c del uruguay', 'concepcion-del-uruguay']
];

/** Frozen lookup built from {@link LOCALITY_ALIAS_ENTRIES}. */
const LOCALITY_ALIASES: ReadonlyMap<string, string> = new Map(LOCALITY_ALIAS_ENTRIES);

/**
 * Resolves a scraped locality to a catalog slug through the curated alias
 * table.
 *
 * Matches the WHOLE normalized locality, never a substring: `"Salto, C. del
 * Uruguay"` names Salto (Uruguay) and must not resolve to Concepción del
 * Uruguay.
 *
 * @param locality - Raw scraped locality string.
 * @returns The catalog slug, or `undefined` when no alias applies.
 */
export function resolveLocalityAlias(locality: string): string | undefined {
    return LOCALITY_ALIASES.get(normalizeLocalityKey(locality));
}
