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
import { normalizeLocalityKey, resolveLocalityAlias } from './locality-aliases.js';
import { splitLocalityQualifiers } from './locality-qualifiers.js';

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
    /**
     * Province/state scraped from the listing page (e.g. "Entre Ríos").
     *
     * The whole catalog is Entre Ríos, so the country alone separates nothing
     * (HOS-346 domain fact #5) while the province separates a great deal: six
     * of the 22 catalog cities have a homonym in another province — Caseros,
     * Villa Elisa, San Justo, Santa Ana, Colón and San José — and an exact name
     * match against any of them is otherwise indistinguishable from the real
     * one.
     */
    readonly region?: string;
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
    const { locality, country, region, destinationService, actor } = input;

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

        if (exactMatches.length > 0) {
            return {
                scrapedLocality: trimmedLocality,
                candidates: exactMatches,
                // Enforced HERE, not left to each consumer: two catalog rows
                // sharing a normalized name would otherwise ship
                // `confident: true` alongside an ambiguous pair, and the field
                // is documented as "safe to pre-fill".
                confident:
                    exactMatches.length === 1 &&
                    countryAllowsConfidence(country) &&
                    regionAllowsConfidence(region)
            };
        }

        // Curated alias fallback (HOS-346). Reached only when the substring
        // search produced no exact name match, which is the case for every
        // abbreviation: `"C. del Uruguay"` does not occur inside `"Concepción
        // del Uruguay"`, so the ILIKE returns nothing at all.
        //
        // This is a lookup by slug, not another matching layer — see
        // `locality-aliases.ts` for why the distinction is the whole point.
        const aliasSlug = resolveLocalityAlias(trimmedLocality);
        if (aliasSlug !== undefined) {
            const aliased = await resolveAliasedCity({
                slug: aliasSlug,
                destinationService,
                actor
            });
            if (aliased) {
                return {
                    scrapedLocality: trimmedLocality,
                    candidates: [aliased],
                    // The alias says WHICH city; it never says the listing is
                    // in our region. Both gates still apply, so an alias can
                    // never be a way around them.
                    confident: countryAllowsConfidence(country) && regionAllowsConfidence(region)
                };
            }
        }

        // Trailing-qualifier retry (HOS-346). `"Colón, Entre Ríos"` finds
        // nothing because no catalog name contains that whole string, yet the
        // province written there is the single most useful signal in the
        // payload. Strip only CLOSED-LIST trailing segments (province, country,
        // postal code), feed the province to the gate, and require the
        // remainder to match a catalog name EXACTLY — so this adds no fuzzy
        // path. `"San José, Colón, Entre Ríos"` leaves `"San José, Colón"`,
        // which is not a catalog name, and therefore resolves nothing rather
        // than resolving the department.
        const qualifiers = splitLocalityQualifiers(trimmedLocality);
        if (qualifiers.stripped && qualifiers.locality.length > 0) {
            // A province the adapter reported as a structured field beats one
            // we parsed out of free text.
            const effectiveRegion = region ?? qualifiers.region;
            const retry = await destinationService.search(actor, {
                q: qualifiers.locality,
                searchScope: 'name',
                destinationType: DestinationTypeEnum.CITY,
                pageSize: MAX_CANDIDATES,
                page: 1
            });

            if (!retry.error) {
                const retryCandidates: DestinationCandidate[] = (retry.data?.items ?? []).map(
                    (dest) => ({ id: dest.id, name: dest.name })
                );
                const retryExact = retryCandidates.filter(
                    (candidate) =>
                        normalizeName(candidate.name) === normalizeName(qualifiers.locality)
                );

                if (retryExact.length > 0) {
                    return {
                        scrapedLocality: trimmedLocality,
                        // Shown even when the province denies confidence: the
                        // host sees what we found and picks, instead of facing
                        // an empty required field (owner decision 2026-08-16).
                        candidates: retryExact,
                        confident:
                            retryExact.length === 1 &&
                            countryAllowsConfidence(country) &&
                            regionAllowsConfidence(effectiveRegion)
                    };
                }
            }
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
 * Deliberately the ONLY normalization applied to NAMES. Anything looser —
 * substring, token overlap, edit distance, address-qualifier parsing — turns a
 * wrong city into a single confident candidate that the review UI writes into
 * `destinationId`.
 *
 * Shares its implementation with the alias table (HOS-346) so a key written
 * there and a catalog name compared here can never normalize differently.
 *
 * @param name - A destination name or a scraped locality.
 * @returns The normalized form.
 */
const normalizeName = normalizeLocalityKey;

/**
 * Province terms that mean "inside Hospeda's catalog region".
 *
 * The catalog is 100% Entre Ríos, so the country separates nothing (every
 * Argentine locality passes it) while the province separates a great deal:
 * six of the 22 cities have a homonym in another province.
 */
const DOMESTIC_REGION_TERMS: ReadonlySet<string> = new Set([
    'entre rios',
    'provincia de entre rios',
    'er'
]);

/**
 * Whether the scraped province leaves the pre-fill admissible.
 *
 * **Fail-open on absence** (owner decision, 2026-08-16): a missing province does
 * not block, because several adapters do not carry one and denying them would
 * remove pre-fills that work correctly today. Only a province that is present
 * AND contradicts Entre Ríos denies confidence.
 *
 * The cost is recorded rather than hidden: HOS-346 domain fact #6 warns that
 * treating the unknown as permission is how a failure becomes a permit. The
 * residual hole is a payload carrying neither province nor country. For
 * MercadoLibre — the adapter where the abbreviation was measured — the country
 * IS populated, so a Brazilian listing is already denied by
 * {@link countryAllowsConfidence}.
 *
 * This function can only ever REMOVE confidence. It grants no match of its own,
 * so it cannot introduce a wrong pre-fill.
 *
 * @param region - The province the adapter scraped, if any.
 * @returns `true` when nothing contradicts the catalog's province.
 */
function regionAllowsConfidence(region?: string): boolean {
    const trimmed = region?.trim();
    if (trimmed === undefined || trimmed.length === 0) {
        return true;
    }
    return DOMESTIC_REGION_TERMS.has(normalizeName(trimmed));
}

/**
 * Resolves a curated alias slug to a catalog CITY.
 *
 * Exact lookup by slug — no `ILIKE`, so it cannot return a neighbouring
 * locality. Degrades to `undefined` on every failure mode: a stale alias whose
 * slug no longer exists, a row that is not a CITY, or a service error. The
 * host's own City picker queries CITY only, so the resolver must never produce
 * an id that picker could not itself have produced.
 *
 * @param input - Alias slug plus the service and actor to resolve it with.
 * @returns The candidate, or `undefined` when the alias cannot be honoured.
 */
async function resolveAliasedCity(input: {
    readonly slug: string;
    readonly destinationService: DestinationService;
    readonly actor: Actor;
}): Promise<DestinationCandidate | undefined> {
    const { slug, destinationService, actor } = input;
    try {
        const result = await destinationService.getBySlug(actor, slug);
        const destination = result.error ? null : result.data;
        if (!destination) return undefined;
        if (destination.destinationType !== DestinationTypeEnum.CITY) return undefined;
        return { id: destination.id, name: destination.name };
    } catch {
        return undefined;
    }
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
