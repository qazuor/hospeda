/**
 * Accommodation Import — Destination Hint Resolver (SPEC-222)
 *
 * Builds a {@link DestinationHint} from a scraped locality/country string by
 * querying the destination search service and returning CANDIDATE destinations
 * for the host to pick from.
 *
 * Scoped to CITY destinations (HOS-286), because an accommodation always sits
 * in a city; before that, a `"Uruguay"` locality could put a DEPARTMENT row's
 * id into `destinationId` — a value the host's own City picker, which queries
 * CITY only, could never have produced.
 *
 * ## Only an exact name may pre-fill
 *
 * The search is `ILIKE '%term%'` (`safeIlike`), i.e. a SUBSTRING match. That
 * makes `"Rosario"` (Santa Fe, 1.3M inhabitants) the sole CITY hit for
 * `"Rosario del Tala"`, and `"Concepción"` (Tucumán) the sole hit for
 * `"Concepción del Uruguay"` — single candidates, which is exactly the shape
 * the review UI pre-fills. So {@link DestinationHint.confident} is granted only
 * when a candidate's name IS the scraped locality under {@link normalizeName};
 * everything else is offered as a suggestion the host accepts by hand.
 *
 * Resolving localities that are abbreviated (`"C. del Uruguay"`), misspelled,
 * or written with their province is deliberately NOT attempted here. Five
 * rounds of adversarial review on a layered matcher produced a confidently
 * wrong pre-fill every time — `"Colonia Elía"`→Colón, `"Santa Elena"`→Santa Ana,
 * `"San José, Colón, Entre Ríos"`→Colón — because in Entre Ríos city names
 * collide both with neighbouring localities and with department names. It is
 * its own problem with its own adversarial corpus, tracked separately.
 *
 * IMPORTANT: This resolver NEVER sets or returns a `destinationId` FK, even
 * when a single exact match is found (SPEC-222 AC-8.2). The output is purely
 * advisory — the host makes the final mapping decision in the review UI.
 *
 * @module services/accommodation-import/resolvers/destination
 */

import { DestinationTypeEnum } from '@repo/schemas';

import type { Actor } from '../../../types/index.js';
import type { DestinationService } from '../../destination/destination.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for {@link buildDestinationHint}.
 */
export interface BuildDestinationHintInput {
    /** Raw locality string scraped from the listing page (e.g. "Concepción del Uruguay"). */
    readonly locality?: string;
    /**
     * ISO 3166-1 alpha-2 country code scraped from the listing page (e.g. "AR").
     * Optional — used to narrow the search when the search service supports it.
     */
    readonly country?: string;
    /** Instantiated DestinationService used to perform the candidate lookup. */
    readonly destinationService: DestinationService;
    /** Actor performing the import operation (passed through to the service layer). */
    readonly actor: Actor;
}

/**
 * A single candidate destination the host can choose to link the accommodation to.
 */
export interface DestinationCandidate {
    /** UUID of the candidate destination record. */
    readonly id: string;
    /** Human-readable display name of the destination. */
    readonly name: string;
}

/**
 * Advisory destination hint included in the import response.
 *
 * - `scrapedLocality` is the raw string that was searched against the destination
 *   catalogue. Present when a locality was provided.
 * - `candidates` is the list of destinations that matched the search. Always an
 *   array (possibly empty). NEVER contains a pre-selected `destinationId`.
 * - `confident` says whether those candidates came from a deterministic path
 *   or from a heuristic guess. See the field docs.
 */
export interface DestinationHint {
    /** Raw locality string as scraped from the listing page. */
    readonly scrapedLocality?: string;
    /**
     * Destination records that match the scraped locality.
     * The host must pick one (or none) — this is purely advisory.
     */
    readonly candidates: readonly DestinationCandidate[];
    /**
     * Whether a candidate's name IS the scraped locality (HOS-286), compared on
     * the normalized form so accents and casing do not matter.
     *
     * `false` means the search matched on a SUBSTRING — `"Rosario"` (Santa Fe)
     * against `"Rosario del Tala"`, `"Uruguay"` against `"Concepción del
     * Uruguay"`. Those are worth SHOWING as suggestions, but pre-filling one
     * writes a wrong `destinationId` under a "we auto-selected it for you"
     * message.
     *
     * Note this is a per-candidate property, not a statement about the set:
     * consumers must ALSO require a single candidate before pre-filling.
     */
    readonly confident: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of destination candidates to return to the host. */
const MAX_CANDIDATES = 5;

// ---------------------------------------------------------------------------
// buildDestinationHint
// ---------------------------------------------------------------------------

/**
 * Builds a destination hint from a scraped locality string.
 *
 * Queries the destination search with `searchScope: 'name'` so descriptions
 * that merely mention a nearby city do not pollute the candidates list, scoped
 * to `destinationType: CITY`. Maps the returned items to minimal `{ id, name }`
 * pairs for the host review UI.
 *
 * There is NO fallback: when the search returns nothing, the hint carries the
 * scraped locality and an empty candidate list. A locality the catalog cannot
 * match verbatim — `"C. del Uruguay"`, a typo, a full postal address — is left
 * for the host to resolve by hand (see the module header for why).
 *
 * **SPEC-222 AC-8.2 enforcement:** This function NEVER returns a bare
 * `destinationId`, never auto-selects a destination, and never sets the FK —
 * even when exactly one candidate is found. The host always decides.
 *
 * @param input - Locality/country strings, a DestinationService, and an Actor.
 * @returns A {@link DestinationHint} with `scrapedLocality` and `candidates`.
 *   On any error (including service errors or thrown exceptions) returns
 *   `{ scrapedLocality, candidates: [] }` — never throws.
 *
 * @example
 * ```ts
 * const hint = await buildDestinationHint({
 *   locality: 'Concepción del Uruguay',
 *   country: 'AR',
 *   destinationService,
 *   actor,
 * });
 * // hint.candidates → [{ id: '...', name: 'Concepción del Uruguay' }, ...]
 * // hint.scrapedLocality → 'Concepción del Uruguay'
 * // destinationId is NEVER set here — the host picks from candidates.
 * ```
 */
export async function buildDestinationHint(
    input: BuildDestinationHintInput
): Promise<DestinationHint> {
    const { locality, country, destinationService, actor } = input;

    // Guard: nothing to search when locality is absent or blank.
    if (!locality || locality.trim().length === 0) {
        return { candidates: [], confident: false };
    }

    const trimmedLocality = locality.trim();

    try {
        // NOTE: do NOT pass `country` here. The destination search schema accepts
        // it, but the destinations table has no `country` column, so a `country`
        // filter throws a DbError ("unknown columns") and yields zero candidates.
        // Searching by locality name alone is sufficient (SPEC-257 smoke finding).
        const result = await destinationService.search(actor, {
            q: trimmedLocality,
            searchScope: 'name',
            destinationType: DestinationTypeEnum.CITY,
            pageSize: MAX_CANDIDATES,
            page: 1
        });

        // Service returned an error — degrade gracefully.
        if (result.error) {
            return { scrapedLocality: trimmedLocality, candidates: [], confident: false };
        }

        const candidates: DestinationCandidate[] = (result.data?.items ?? []).map((dest) => ({
            id: dest.id,
            name: dest.name
        }));

        // A literal hit is NOT automatically trustworthy: `safeIlike` is
        // `%term%`, a raw SUBSTRING match run in Postgres. Against the live
        // catalog `"Rosario"` (Santa Fe, 1.3M inhabitants) is the sole CITY hit
        // for `"Rosario del Tala"`, and `"Concepción"` (Tucumán) the sole hit
        // for `"Concepción del Uruguay"` — each a single candidate, which is the
        // shape the review UI pre-fills.
        //
        // So a candidate may pre-fill only when its name IS the scraped
        // locality, compared on a normalized form so accents and casing do not
        // matter. Narrowing to those also fixes the opposite problem: an
        // over-wide `ILIKE '%Gualeguay%'` returns Gualeguaychú too, and a
        // verbatim catalog name should not arrive as an ambiguous pair.
        const exactMatches = candidates.filter(
            (candidate) => normalizeName(candidate.name) === normalizeName(trimmedLocality)
        );

        if (exactMatches.length > 0 && countryAllowsConfidence(country)) {
            return {
                scrapedLocality: trimmedLocality,
                candidates: exactMatches,
                confident: true
            };
        }

        return { scrapedLocality: trimmedLocality, candidates, confident: false };
    } catch {
        // Any unexpected error — return empty candidates, never throw.
        return { scrapedLocality: trimmedLocality, candidates: [], confident: false };
    }
}

/**
 * Normalizes a place name for comparison: lowercase, accents stripped, every
 * non-alphanumeric character collapsed to a single space.
 *
 * Deliberately the ONLY normalization applied. Anything looser — substring,
 * token overlap, edit distance, address-qualifier parsing — turns a wrong city
 * into a single confident candidate that the review UI writes into
 * `destinationId`. Resolving abbreviated / misspelled / qualified localities is
 * real work with its own adversarial test corpus, tracked separately.
 *
 * @param name - A destination name or a scraped locality.
 * @returns The normalized form.
 */
function normalizeName(name: string): string {
    return (
        name
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
 * Country terms that mean "inside Hospeda's market".
 *
 * An exact NAME match is not an exact PLACE match: `"San José"` and
 * `"Concordia"` name real cities in Uruguay, Mexico and Colombia as well as in
 * Entre Ríos, and the MercadoLibre adapter accepts every country TLD
 * (`mercadolivre.com.br` included).
 */
const DOMESTIC_COUNTRY_TERMS: ReadonlySet<string> = new Set([
    'argentina',
    'republica argentina',
    'ar',
    'arg'
]);

/**
 * Whether the scraped country leaves the pre-fill admissible.
 *
 * Absence is "no objection": most adapters do not reliably capture a country,
 * and denying every unqualified locality would remove the pre-fill entirely.
 *
 * @param country - The country the adapter scraped, if any.
 * @returns `true` when nothing contradicts the catalog's country.
 */
function countryAllowsConfidence(country?: string): boolean {
    const trimmed = country?.trim();
    if (trimmed === undefined || trimmed.length === 0) {
        return true;
    }
    return DOMESTIC_COUNTRY_TERMS.has(normalizeName(trimmed));
}
