/**
 * Stale-carryover guard for the conversational AI search route (HOS-551 / H-71).
 *
 * ## Why this exists
 *
 * The conversational search prompt (`buildConversationalSearchPrompt` /
 * `DEFAULT_PROMPTS['search']`'s "Conversational refinement" rules) makes the
 * model the SOLE owner of the refine-vs-new-search decision: it is instructed
 * to return the COMPLETE updated entity set every turn, and nothing
 * downstream in `search-chat.ts` re-merges `currentFilters` on top of the
 * model's output — `mapIntentToSearchParams` maps exactly what the model
 * returned for THIS turn, no more, no less (see its own module doc: "zero
 * side effects" pure mapping). That design is correct for a genuine
 * refinement ("y que además tenga pileta" must carry the rest of the search
 * forward), but it means a model that MIS-classifies a self-contained new
 * query as a refinement of the prior search silently keeps every unmentioned
 * slot from that prior search.
 *
 * Reproduced in an August 2026 production smoke (Linear HOS-551): turn 1
 * ("cabaña para 4 personas con pileta") set `hasPool: true`; turn 2 ("hotel en
 * Colón para 2 personas") correctly updated `accommodationType` (CABIN →
 * HOTEL) and `minGuests` (4 → 2) — proving the model DID re-extract from the
 * new message — yet `hasPool: true` survived unmentioned, because the model
 * treated the turn as a refinement of the prior state rather than a new
 * search. The natural-language reply (a separate `streamText` call) correctly
 * described only hotels in Colón for 2, with no mention of a pool — the
 * divergence is between the model's OWN two outputs for the same turn, not
 * between the model and some separate merge step.
 *
 * ## Two triggers, in priority order
 *
 * **1. The model's stated decision (`isNewSearch`).** The extraction output
 * schema carries a boolean in which the model reports whether it treated the
 * turn as a NEW SEARCH or a REFINEMENT. It rides in the SAME `generateObject`
 * completion the entities come from, so it costs no extra provider call and no
 * extra latency — the only cost is one field in the schema and a paragraph in
 * the prompt. When the model says `true`, that is the trigger.
 *
 * Asking the model to *state* the branch it took, rather than inferring it from
 * which fields it omitted, is the whole point: "the model did not mention it"
 * and "the model meant to keep it" are indistinguishable in an entity set, and
 * that ambiguity is the bug.
 *
 * **2. A destination change (fallback).** Used only when the flag is absent —
 * an older client, a model that dropped the field, anything that would
 * otherwise regress to the pre-flag behaviour. It is a lossy proxy in both
 * directions: it misses a new search that stays in the same destination
 * ("cabaña con pileta en Colón" → "hotel en Colón para 2") and it fires on a
 * refinement that legitimately moves the destination. It is kept because
 * degrading to the previous shipped behaviour beats degrading to none.
 *
 * A dedicated classification call before extraction — the other way to close
 * this — was considered and rejected: it doubles the provider calls per turn
 * for a marginal gain over a flag the same completion can carry.
 *
 * ## What gets dropped, and the tradeoff accepted
 *
 * Only the fields most prone to silent carryover (the boolean amenity shortcuts
 * and the slug arrays), and only when their value is byte-identical to the
 * prior turn's. Numeric ranges (guests, price, rating, bedrooms/bathrooms,
 * dates) are deliberately left alone — they updated correctly in the reported
 * repro, so guarding them would add false-positive risk on fields never
 * observed to misbehave.
 *
 * A genuinely identical fresh re-mention (a new search that also explicitly
 * asks for a pool again) loses that filter. That is a softer failure —
 * over-broad results rather than a search silently narrowed to zero — and is an
 * accepted tradeoff.
 *
 * @module apps/api/routes/ai/protected/search-chat.stale-carryover
 */

import type { SearchIntentEntities } from '@repo/schemas';
import { isUsableEntityId } from '@repo/utils';

/**
 * Boolean amenity shortcuts prone to silent carryover across turns. Mirrors
 * `search-chat.ts`'s `BOOLEAN_SHORTCUT_AMENITY_SLUGS` keys; the slug arrays are
 * handled separately below because they are arrays.
 */
const STALE_PRONE_BOOLEAN_KEYS = ['hasPool', 'hasWifi', 'allowsPets', 'hasParking'] as const;

/**
 * Slug-array slots prone to the same silent carryover.
 *
 * HOS-562 follow-up: this originally listed only `amenitySlugs` and
 * `featureSlugs`, because those were the two the production smoke happened to
 * reproduce. `attractionSlugs` and `poiSlugs` are the SAME shape with the same
 * failure mode, so leaving them out was an accident of what got observed, not a
 * line anyone drew. A guard that covers two of four identical fields is the
 * partial-coverage trap this whole batch exists to fix.
 */
const STALE_PRONE_SLUG_ARRAY_KEYS = [
    'amenitySlugs',
    'featureSlugs',
    'attractionSlugs',
    'poiSlugs'
] as const;

/**
 * Best-effort single-value "what location is this entity set about" signal,
 * used ONLY to detect a change between two entity sets — never forwarded to
 * a query. Priority mirrors the mapper's own location priority (id > geo >
 * city).
 *
 * @param entities - Entity set to summarize, or `undefined` for a first turn.
 * @returns A comparable signal string, or `undefined` when no location slot
 *   is present.
 */
function locationSignal(entities: SearchIntentEntities | undefined): string | undefined {
    if (entities === undefined) {
        return undefined;
    }
    if (isUsableEntityId(entities.destinationId)) {
        return `id:${entities.destinationId}`;
    }
    if (entities.latitude !== undefined && entities.longitude !== undefined) {
        return `geo:${entities.latitude},${entities.longitude}`;
    }
    if (typeof entities.city === 'string' && entities.city.trim() !== '') {
        return `city:${entities.city.trim().toLowerCase()}`;
    }
    return undefined;
}

/**
 * Order-insensitive equality for the two slug arrays (`amenitySlugs` /
 * `featureSlugs`).
 *
 * @param a - First slug array (or `undefined`).
 * @param b - Second slug array (or `undefined`).
 * @returns Whether both are `undefined`, or both contain the same slugs.
 */
function sameSlugSet(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
    if (a === undefined || b === undefined) {
        return a === undefined && b === undefined;
    }
    if (a.length !== b.length) {
        return false;
    }
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
}

/**
 * Drops amenity/boolean-shortcut slots that look like unmentioned carryover
 * from a PRIOR turn, when this turn started a new search. See the module doc
 * above for the full rationale and the two triggers.
 *
 * ## When it fires
 *
 * `options.isNewSearch === true` (the model said so), or — only when the flag
 * is absent — `entities` carries a location signal (id, geo, or city) that is
 * DEFINED and DIFFERENT from `previousEntities`'s, including "previous had none
 * at all". Under the fallback, a message naming NO destination never triggers
 * it: that is the documented "keeps the current destination" refinement case,
 * where carryover is correct rather than a bug.
 *
 * ## What gets dropped
 *
 * The boolean amenity shortcuts (`hasPool` / `hasWifi` / `allowsPets` /
 * `hasParking`) and ALL FOUR slug arrays (`amenitySlugs` / `featureSlugs` /
 * `attractionSlugs` / `poiSlugs`), and only when their value is IDENTICAL to
 * the previous turn's — i.e. indistinguishable from blind carryover. A field
 * that genuinely changed (present now, absent or different before) is never
 * touched.
 *
 * Numeric ranges and dates (guests, price, rating, bedrooms/bathrooms,
 * check-in/out) are deliberately NOT guarded: they updated correctly in the
 * reported repro, so covering them would add false-positive risk on fields
 * never observed to misbehave. That IS a remaining gap — a stale `minPrice`
 * can still survive a new search — and it is a deliberate line, unlike the two
 * slug arrays that were missing by accident.
 *
 * @param entities - This turn's validated entities, straight from the model
 *   (before amenity/feature slug resolution).
 * @param previousEntities - The sanitized `currentFilters` echoed by the
 *   client for this turn (the prior turn's accumulated state), or
 *   `undefined` on a first turn.
 * @param options.isNewSearch - The model's own refine-vs-new classification for
 *   this turn. Omit (or pass `undefined`) to fall back to the destination-change
 *   proxy.
 * @returns A copy with stale-looking fields removed, or the SAME reference
 *   when nothing needed to change.
 *
 * @example
 * ```ts
 * // The model states it started a new search but carried a filter anyway.
 * dropStaleAmenitiesOnNewSearch(
 *   { accommodationType: 'HOTEL', minGuests: 2, city: 'Colón', hasPool: true },
 *   { accommodationType: 'CABIN', minGuests: 4, city: 'Colón', hasPool: true },
 *   { isNewSearch: true }
 * );
 * // → { accommodationType: 'HOTEL', minGuests: 2, city: 'Colón' }
 * // hasPool dropped even though the destination never changed — the case the
 * // destination-change proxy alone could not see.
 * ```
 */
export function dropStaleAmenitiesOnNewSearch(
    entities: SearchIntentEntities,
    previousEntities: SearchIntentEntities | undefined,
    options: { readonly isNewSearch?: boolean } = {}
): SearchIntentEntities {
    // HOS-551: the model STATES its refine-vs-new decision in `isNewSearch`, so
    // that is the trigger whenever it is present — in BOTH directions.
    //
    // The destination-change test below was only ever a proxy for it, and a
    // lossy one both ways: it missed a new search that stayed in the same
    // destination ("cabaña con pileta en Colón" → "hotel en Colón para 2"), and
    // it fired on a refinement that legitimately moved the destination — which
    // the prompt documents as a refinement ("y en destinos cercanos"). So a
    // stated `false` must not be overridden by the proxy either: a lossy guess
    // may not beat an explicit answer.
    //
    // Only an ABSENT flag falls through to the proxy, which is exactly the
    // behaviour that shipped before the flag existed. That is why the schema
    // keeps the field optional rather than defaulting it to `false`: collapsing
    // "said refinement" into "said nothing" would silently disable this
    // fallback the moment a model stopped emitting it.
    const startedNewSearch =
        options.isNewSearch === undefined
            ? (() => {
                  const previousSignal = locationSignal(previousEntities);
                  const currentSignal = locationSignal(entities);
                  return currentSignal !== undefined && currentSignal !== previousSignal;
              })()
            : options.isNewSearch;
    if (!startedNewSearch) {
        return entities;
    }

    let changed = false;
    const next: SearchIntentEntities = { ...entities };

    for (const key of STALE_PRONE_BOOLEAN_KEYS) {
        if (next[key] !== undefined && next[key] === previousEntities?.[key]) {
            delete next[key];
            changed = true;
        }
    }
    for (const key of STALE_PRONE_SLUG_ARRAY_KEYS) {
        if (next[key] !== undefined && sameSlugSet(next[key], previousEntities?.[key])) {
            delete next[key];
            changed = true;
        }
    }

    return changed ? next : entities;
}
