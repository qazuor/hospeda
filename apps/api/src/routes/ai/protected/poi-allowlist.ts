/**
 * Curated + machine-generated point-of-interest allowlist for the AI NL
 * search route (HOS-113 §6.3 — "cerca del autódromo"; extended HOS-142 §6.6).
 *
 * Same shape/pattern as `attraction-allowlist.ts` (HOS-111 T-015), with one
 * conceptual difference: an attraction NL term names a CONCEPT ("carnaval")
 * that can span several distinct `attractions` rows, while a point of
 * interest is itself a single NAMED landmark (a specific autódromo, a
 * specific plaza). Each term below therefore normally maps to exactly ONE
 * canonical POI slug, but the dictionary shape stays `readonly string[]` per
 * term (mirroring attraction's) so a shared/ambiguous alias could map to more
 * than one landmark if the catalog ever needs it — never a bare, unqualified
 * category word (e.g. a lone "plaza" or "termas") that could plausibly match
 * many unrelated POIs; every key here names — or closely paraphrases — a
 * specific, real, seeded landmark.
 *
 * The route resolves matched slugs to POI rows and, via
 * `getDestinationIdsByPointOfInterestSlugs`, to the destinations that carry
 * them — plus the matched POI's own `{ lat, long }`, which feeds the existing
 * "near POI" proximity-search path (HOS-113 §6.2). See `poi-resolver.ts`.
 *
 * Every slug below was cross-checked against the real seed data
 * (`packages/seed/src/data/pointOfInterest/*.json`, `slug` field) — do not
 * add a slug here without verifying it exists in the seed catalog, per the
 * HOS-111 T-009 lesson (a previously-wrong slug shipped silently broken until
 * it was cross-checked against seed data). See also `poi-allowlist.test.ts`'s
 * "ATTRACTION_ALLOWLIST structure" companion suite, which asserts every
 * allowlisted slug is present in the seed fixture set (R-4 defence).
 *
 * ## HOS-142 extension (G-7)
 *
 * `POI_ALLOWLIST` (the exported constant consumers use) is now the MERGE of
 * two sources:
 *
 * 1. {@link CURATED_POI_ALLOWLIST} — the original 12 hand-curated entries
 *    below, unchanged, covering all three locales.
 * 2. `poi-allowlist.generated.json` — machine-derived `es`-only entries for
 *    the featured/high-priority subset (~661) of the full seeded catalog,
 *    produced by `scripts/generate-poi-allowlist.ts` (see that file's header
 *    for the exact scope cut, candidate-term derivation, and R-5 generic-term
 *    filter). Never hand-edit the generated file directly — regenerate it
 *    instead.
 *
 * On any key collision the CURATED entry always wins — the generated file is
 * never allowed to silently redefine a hand-verified alias.
 *
 * ## Prompt-embedded slug subset (HOS-142 Phase 4b)
 *
 * `POI_ALLOWLIST`/`matchPoiTerms` are used SERVER-SIDE only (`search-chat.ts`'s
 * lexical fallback) — they are never embedded verbatim in the LLM prompt.
 * {@link PROMPT_FEATURED_POI_SLUGS} is the deliberately small subset (curated
 * 12 + the top featured POIs by `displayWeight`, ~52 total — see
 * `scripts/generate-poi-allowlist.ts`'s "Prompt-embedded slug subset" doc)
 * that `search-chat.prompt.ts`'s `buildAllowlistLines` actually embeds. A
 * landmark whose slug is NOT in this smaller list is still fully resolvable —
 * just not through the LLM's own extraction; `matchPoiTerms` covers it
 * server-side against the FULL `POI_ALLOWLIST` regardless.
 *
 * @module apps/api/routes/ai/protected/poi-allowlist
 */

import generatedPoiAllowlistData from './poi-allowlist.generated.json' with { type: 'json' };

/** Shape shared by both the curated and generated POI allowlist dictionaries. */
type PoiAllowlistDict = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

/** Shape of the JSON artifact produced by `scripts/generate-poi-allowlist.ts`. */
interface GeneratedPoiAllowlistFile {
    readonly es: Readonly<Record<string, readonly string[]>>;
    readonly promptFeaturedSlugs: readonly string[];
}

/**
 * Hand-curated dictionary mapping NL landmark-name/alias variants → an array
 * of canonical point-of-interest slugs (as stored in
 * `points_of_interest.slug`), for the original 12 HOS-113 landmarks.
 *
 * Keys are natural-language terms users might write (matching code
 * normalises case at call time). Values are DE-DUPLICATED arrays of real,
 * seed-verified POI slugs.
 *
 * @example
 * ```ts
 * const slugs = CURATED_POI_ALLOWLIST['es']['autódromo'];
 * // ['autodromo_concepcion_del_uruguay']
 * ```
 */
export const CURATED_POI_ALLOWLIST: PoiAllowlistDict = {
    es: {
        // 001 — Autódromo de Concepción del Uruguay (STADIUM)
        autódromo: ['autodromo_concepcion_del_uruguay'],
        autodromo: ['autodromo_concepcion_del_uruguay'],
        'autódromo de concepción del uruguay': ['autodromo_concepcion_del_uruguay'],
        'circuito de carreras': ['autodromo_concepcion_del_uruguay'],
        // 002 — Playa Banco Pelay (BEACH)
        'banco pelay': ['playa_banco_pelay'],
        'playa banco pelay': ['playa_banco_pelay'],
        // 003 — Palacio San José (MUSEUM)
        'palacio san josé': ['palacio_san_jose'],
        'palacio san jose': ['palacio_san_jose'],
        // 004 — Basílica Inmaculada Concepción (MONUMENT)
        'basílica inmaculada concepción': ['basilica_inmaculada_concepcion'],
        'basilica inmaculada concepcion': ['basilica_inmaculada_concepcion'],
        basílica: ['basilica_inmaculada_concepcion'],
        // 005 — Parque Unzué (PARK)
        'parque unzué': ['parque_unzue'],
        'parque unzue': ['parque_unzue'],
        // 006 — Isla del Puerto (NATURAL)
        'isla del puerto': ['isla_del_puerto'],
        // 007 — Plaza Francisco Ramírez (PLAZA)
        'plaza francisco ramírez': ['plaza_francisco_ramirez'],
        'plaza ramírez': ['plaza_francisco_ramirez'],
        'plaza ramirez': ['plaza_francisco_ramirez'],
        // 008 — Mirador Costanera (VIEWPOINT)
        'mirador de la costanera': ['mirador_costanera'],
        'mirador costanera': ['mirador_costanera'],
        // 009 — Complejo Termal Concordia (OTHER)
        'termas de concordia': ['complejo_termal_concordia'],
        'complejo termal concordia': ['complejo_termal_concordia'],
        // 010 — Balneario Itapé (BEACH)
        'balneario itapé': ['balneario_itape'],
        'balneario itape': ['balneario_itape'],
        itapé: ['balneario_itape'],
        // 011 — Parque Nacional El Palmar (PARK)
        'parque nacional el palmar': ['parque_nacional_el_palmar'],
        'el palmar': ['parque_nacional_el_palmar'],
        // 012 — Termas de Federación (OTHER)
        'termas de federación': ['termas_de_federacion'],
        'termas de federacion': ['termas_de_federacion']
    },
    en: {
        autodrome: ['autodromo_concepcion_del_uruguay'],
        'race track': ['autodromo_concepcion_del_uruguay'],
        'racing circuit': ['autodromo_concepcion_del_uruguay'],
        'concepción del uruguay autodrome': ['autodromo_concepcion_del_uruguay'],
        'banco pelay beach': ['playa_banco_pelay'],
        'banco pelay': ['playa_banco_pelay'],
        'san josé palace': ['palacio_san_jose'],
        'san jose palace': ['palacio_san_jose'],
        'immaculate conception basilica': ['basilica_inmaculada_concepcion'],
        basilica: ['basilica_inmaculada_concepcion'],
        'unzué park': ['parque_unzue'],
        'unzue park': ['parque_unzue'],
        'port island': ['isla_del_puerto'],
        'francisco ramírez square': ['plaza_francisco_ramirez'],
        'ramírez square': ['plaza_francisco_ramirez'],
        'costanera viewpoint': ['mirador_costanera'],
        'riverside lookout': ['mirador_costanera'],
        'concordia thermal springs': ['complejo_termal_concordia'],
        'itapé resort': ['balneario_itape'],
        itape: ['balneario_itape'],
        'el palmar national park': ['parque_nacional_el_palmar'],
        'el palmar': ['parque_nacional_el_palmar'],
        'federación hot springs': ['termas_de_federacion'],
        'federacion hot springs': ['termas_de_federacion']
    },
    pt: {
        autódromo: ['autodromo_concepcion_del_uruguay'],
        'autódromo de concepción del uruguay': ['autodromo_concepcion_del_uruguay'],
        'circuito de corridas': ['autodromo_concepcion_del_uruguay'],
        'praia banco pelay': ['playa_banco_pelay'],
        'banco pelay': ['playa_banco_pelay'],
        'palácio san josé': ['palacio_san_jose'],
        'palacio san jose': ['palacio_san_jose'],
        basílica: ['basilica_inmaculada_concepcion'],
        'basílica da imaculada conceição': ['basilica_inmaculada_concepcion'],
        'parque unzué': ['parque_unzue'],
        'ilha do porto': ['isla_del_puerto'],
        'praça francisco ramírez': ['plaza_francisco_ramirez'],
        'praça ramírez': ['plaza_francisco_ramirez'],
        'mirante da costanera': ['mirador_costanera'],
        'termas de concórdia': ['complejo_termal_concordia'],
        'balneário itapé': ['balneario_itape'],
        itapé: ['balneario_itape'],
        'parque nacional el palmar': ['parque_nacional_el_palmar'],
        'termas de federação': ['termas_de_federacion']
    }
} as const;

/** Typed view of the raw imported generated JSON artifact. */
const generatedPoiAllowlistFile = generatedPoiAllowlistData as GeneratedPoiAllowlistFile;

/**
 * Machine-generated `es`-only NL term → slug entries produced by
 * `scripts/generate-poi-allowlist.ts` (HOS-142 G-7). See the module doc above
 * and the script's own header comment for the scope cut, candidate-term
 * derivation, and R-5 generic-term filter that produced this data.
 */
const GENERATED_POI_ALLOWLIST: PoiAllowlistDict = { es: generatedPoiAllowlistFile.es };

/**
 * Merges a single locale's curated and generated term dictionaries, with
 * curated entries always taking precedence on a key collision.
 *
 * @param curated - The locale's hand-curated term → slugs map, if any.
 * @param generated - The locale's machine-generated term → slugs map, if any.
 * @returns The merged term → slugs map for this locale.
 */
function mergeLocaleDict(
    curated: Readonly<Record<string, readonly string[]>> | undefined,
    generated: Readonly<Record<string, readonly string[]>> | undefined
): Readonly<Record<string, readonly string[]>> {
    return { ...(generated ?? {}), ...(curated ?? {}) };
}

/**
 * Merges the curated and generated POI allowlist dictionaries across every
 * locale present in either source. Curated entries always win on a key
 * collision (see {@link mergeLocaleDict}).
 *
 * @param curated - The hand-curated dictionary.
 * @param generated - The machine-generated dictionary.
 * @returns The merged, per-locale dictionary.
 */
function mergePoiAllowlists(
    curated: PoiAllowlistDict,
    generated: PoiAllowlistDict
): PoiAllowlistDict {
    const locales = new Set([...Object.keys(curated), ...Object.keys(generated)]);
    const merged: Record<string, Readonly<Record<string, readonly string[]>>> = {};
    for (const locale of locales) {
        merged[locale] = mergeLocaleDict(curated[locale], generated[locale]);
    }
    return merged;
}

/**
 * Per-locale dictionary mapping NL landmark-name/alias variants → an array of
 * canonical point-of-interest slugs (as stored in `points_of_interest.slug`).
 *
 * The merge of {@link CURATED_POI_ALLOWLIST} (hand-curated, all locales) and
 * the HOS-142 machine-generated `es`-only entries — see the module doc above
 * for the merge/precedence rule.
 *
 * @example
 * ```ts
 * const slugs = POI_ALLOWLIST['es']['autódromo'];
 * // ['autodromo_concepcion_del_uruguay']
 * ```
 */
export const POI_ALLOWLIST: PoiAllowlistDict = mergePoiAllowlists(
    CURATED_POI_ALLOWLIST,
    GENERATED_POI_ALLOWLIST
);

/**
 * Extracts every distinct slug referenced anywhere in a POI allowlist
 * dictionary (across every locale and every term). Exported so both this
 * module and `scripts/generate-poi-allowlist.ts` derive "every curated slug"
 * from the SAME logic rather than duplicating it.
 *
 * @param dict - A POI allowlist dictionary (curated, generated, or merged).
 * @returns De-duplicated set of every slug appearing in `dict`.
 */
export function extractAllSlugs(dict: PoiAllowlistDict): ReadonlySet<string> {
    const slugs = new Set<string>();
    for (const localeDict of Object.values(dict)) {
        for (const termSlugs of Object.values(localeDict)) {
            for (const slug of termSlugs) {
                slugs.add(slug);
            }
        }
    }
    return slugs;
}

/**
 * The small, LLM-prompt-embeddable subset of POI slugs (HOS-142 Phase 4b) —
 * see the module doc's "Prompt-embedded slug subset" section. Computed as the
 * union of every curated slug (always included, regardless of ranking) with
 * the generated `promptFeaturedSlugs` list (the top featured POIs by
 * `displayWeight`, produced by `scripts/generate-poi-allowlist.ts`). Recomputing
 * the curated half at runtime (rather than trusting the generated file's own
 * embedded union) means a hand-edit to {@link CURATED_POI_ALLOWLIST} is always
 * reflected here even before the next `generate-poi-allowlist` run.
 *
 * `search-chat.prompt.ts`'s `buildAllowlistLines` embeds exactly this list in
 * the LLM prompt — NOT the full `POI_ALLOWLIST`. Every other in-scope POI
 * remains reachable via the server-side `matchPoiTerms` lexical fallback.
 *
 * @example
 * ```ts
 * PROMPT_FEATURED_POI_SLUGS.length; // ~52 (12 curated + up to 40 featured)
 * ```
 */
export const PROMPT_FEATURED_POI_SLUGS: readonly string[] = Array.from(
    new Set([
        ...extractAllSlugs(CURATED_POI_ALLOWLIST),
        ...generatedPoiAllowlistFile.promptFeaturedSlugs
    ])
).sort();

/**
 * Match NL point-of-interest mentions to canonical POI slugs.
 *
 * Scans `text` for every key in the locale-specific `POI_ALLOWLIST`
 * dictionary. Both the text and each dictionary key are lowercased and
 * trimmed before comparison so matching is case-insensitive. The function
 * checks whether the lowercased-trimmed key appears as a substring of the
 * lowercased text.
 *
 * Returns a de-duplicated, readonly array of matched slugs (flattening
 * every matched term's slug array). Unmatched terms are silently ignored —
 * the function never guesses or invents a slug not present in the
 * allowlist (R-4 hallucination defence, mirrors attraction/amenity/feature
 * matching).
 *
 * @param text   - Raw text to scan (typically the full user query).
 * @param locale - User locale for dictionary selection (`es` | `en` | `pt`).
 * @returns De-duplicated array of matched point-of-interest slugs.
 *
 * @example
 * ```ts
 * matchPoiTerms('busco algo cerca del autódromo', 'es');
 * // ['autodromo_concepcion_del_uruguay']
 * matchPoiTerms('a cabin with a pool and wifi', 'en'); // []
 * ```
 */
export function matchPoiTerms(text: string, locale: 'es' | 'en' | 'pt'): readonly string[] {
    // Same TypeScript narrowing issue as matchAttractionTerms/matchAmenityTerms —
    // cast ensures a defined value after the 'es' fallback.
    const dict = (POI_ALLOWLIST[locale] ?? POI_ALLOWLIST.es) as Readonly<
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
