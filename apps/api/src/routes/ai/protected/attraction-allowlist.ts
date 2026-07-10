/**
 * Curated destination-attraction allowlist for the AI NL search route
 * (HOS-111 T-015, G-11 — "una ciudad con carnavales").
 *
 * Same shape/pattern as `amenity-allowlist.ts` (SPEC-199 §5.4), with one
 * structural difference: an amenity/feature NL term maps to exactly ONE
 * slug, but an attraction CONCEPT ("carnaval") is often modeled as SEVERAL
 * distinct `attractions` rows (the venue, the museum, the workshop...), so
 * each term here maps to an ARRAY of canonical attraction slugs.
 *
 * The route resolves matched slugs to attraction rows and, via
 * `r_destination_attraction`, to the destinations that have them — never to
 * an accommodation-level filter (there is no accommodation↔attraction join
 * for the MVP, spec §6 Phase 3).
 *
 * Every slug below was cross-checked against the real seed data
 * (`packages/seed/src/data/attraction/*.json`, `slug` field) and against
 * which destinations actually carry it (`attractionIds` on
 * `packages/seed/src/data/destination/*.json`) — do not add a slug here
 * without verifying it exists in the seed catalog, per the T-009 lesson
 * (a previously-wrong `air-conditioning` vs `air_conditioning` slug shipped
 * silently broken until it was cross-checked against seed data).
 *
 * @module apps/api/routes/ai/protected/attraction-allowlist
 */

/**
 * Per-locale dictionary mapping NL term variants → an array of canonical
 * attraction slugs (as stored in `attractions.slug`).
 *
 * Keys are natural-language terms users might write (matching code
 * normalises case at call time). Values are DE-DUPLICATED arrays of real,
 * seed-verified attraction slugs — never a single generic "carnaval"
 * attraction, because none exists; the concept spans several rows.
 *
 * @example
 * ```ts
 * const slugs = ATTRACTION_ALLOWLIST['es']['carnaval'];
 * // ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval']
 * ```
 */
export const ATTRACTION_ALLOWLIST: Readonly<
    Record<string, Readonly<Record<string, readonly string[]>>>
> = {
    es: {
        // Carnaval — spec's worked example ("una ciudad con carnavales").
        // Verified against packages/seed/src/data/attraction/030-*.json,
        // 054-*.json, 080-*.json, 084-*.json, and confirmed present on
        // Gualeguaychú / Colón / Concordia / Gualeguay's `attractionIds`.
        carnaval: ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval'],
        carnavales: ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval'],
        corsódromo: ['corsodromo'],
        corsodromo: ['corsodromo'],
        comparsas: ['corsodromo', 'sede_carnaval'],
        // Thermal springs / spa — verified against 002-*, 022-*, 028-*,
        // 066-*, 085-*-attraction JSON files.
        termas: [
            'aqua_parque_termal',
            'centro_spa_termal',
            'complejo_termal_principal',
            'piscinas_termales',
            'termas_familiares'
        ],
        'aguas termales': [
            'aqua_parque_termal',
            'centro_spa_termal',
            'complejo_termal_principal',
            'piscinas_termales',
            'termas_familiares'
        ],
        'parque termal': ['aqua_parque_termal', 'complejo_termal_principal'],
        // Museums — generic term intentionally excludes museo_carnaval
        // (already reachable via the carnaval terms above).
        museo: ['museo_historico', 'museo_regional'],
        museos: ['museo_historico', 'museo_regional'],
        // Historic center — verified against 018-attraction-centro_historico.json.
        'centro histórico': ['centro_historico'],
        'casco histórico': ['centro_historico']
    },
    en: {
        carnival: ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval'],
        carnivals: ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval'],
        'carnival parade grounds': ['corsodromo'],
        'thermal springs': [
            'aqua_parque_termal',
            'centro_spa_termal',
            'complejo_termal_principal',
            'piscinas_termales',
            'termas_familiares'
        ],
        'hot springs': [
            'aqua_parque_termal',
            'centro_spa_termal',
            'complejo_termal_principal',
            'piscinas_termales',
            'termas_familiares'
        ],
        museum: ['museo_historico', 'museo_regional'],
        museums: ['museo_historico', 'museo_regional'],
        'historic center': ['centro_historico'],
        'historic centre': ['centro_historico']
    },
    pt: {
        carnaval: ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval'],
        carnavais: ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval'],
        sambódromo: ['corsodromo'],
        'águas termais': [
            'aqua_parque_termal',
            'centro_spa_termal',
            'complejo_termal_principal',
            'piscinas_termales',
            'termas_familiares'
        ],
        termas: [
            'aqua_parque_termal',
            'centro_spa_termal',
            'complejo_termal_principal',
            'piscinas_termales',
            'termas_familiares'
        ],
        museu: ['museo_historico', 'museo_regional'],
        museus: ['museo_historico', 'museo_regional'],
        'centro histórico': ['centro_historico']
    }
} as const;

/**
 * Match NL attraction mentions to canonical attraction slugs.
 *
 * Scans `text` for every key in the locale-specific `ATTRACTION_ALLOWLIST`
 * dictionary. Both the text and each dictionary key are lowercased and
 * trimmed before comparison so matching is case-insensitive. The function
 * checks whether the lowercased-trimmed key appears as a substring of the
 * lowercased text.
 *
 * Returns a de-duplicated, readonly array of matched slugs (flattening
 * every matched term's slug array). Unmatched terms are silently ignored —
 * the function never guesses or invents a slug not present in the
 * allowlist (R-4 hallucination defence, mirrors amenity/feature matching).
 *
 * @param text   - Raw text to scan (typically the full user query).
 * @param locale - User locale for dictionary selection (`es` | `en` | `pt`).
 * @returns De-duplicated array of matched attraction slugs.
 *
 * @example
 * ```ts
 * matchAttractionTerms('una ciudad con carnavales', 'es');
 * // ['sede_carnaval', 'corsodromo', 'museo_carnaval', 'taller_carnaval']
 * matchAttractionTerms('a city with a nice beach', 'en'); // []
 * ```
 */
export function matchAttractionTerms(text: string, locale: 'es' | 'en' | 'pt'): readonly string[] {
    // Same TypeScript narrowing issue as matchAmenityTerms/matchFeatureTerms —
    // cast ensures a defined value after the 'es' fallback.
    const dict = (ATTRACTION_ALLOWLIST[locale] ?? ATTRACTION_ALLOWLIST.es) as Readonly<
        Record<string, readonly string[]>
    >;
    const normalised = text.toLowerCase();
    const matched = new Set<string>();

    for (const [term, slugs] of Object.entries(dict)) {
        if (normalised.includes(term.toLowerCase().trim())) {
            for (const slug of slugs) {
                matched.add(slug);
            }
        }
    }

    return Array.from(matched);
}
