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
 * ## The chosen fix, and what it deliberately does NOT do
 *
 * A fully robust fix would change the extraction contract itself — e.g. a
 * dedicated classification call before extraction, or a model-emitted
 * `isNewSearch` flag that controls whether `currentFilters` is even shown to
 * the model. Both are legitimate architecture changes (more provider calls,
 * or a new schema field consumed by prompt logic) and are explicitly OUT OF
 * SCOPE for this fix — they change the LLM contract and the per-turn latency
 * profile, which is a product/architecture tradeoff, not a unilateral bug-fix
 * decision.
 *
 * This module is the narrower, fully DETERMINISTIC mitigation available
 * without touching that contract. It reuses a signal the route already has —
 * this turn's own extracted location differing from the prior turn's — as
 * evidence that a new search started, and on that evidence alone drops the
 * handful of fields most prone to silent carryover (the boolean amenity
 * shortcuts and the slug arrays) WHEN their value is byte-identical to the
 * prior turn's. It does not attempt to second-guess numeric ranges (guests,
 * price, rating, bedrooms/bathrooms, dates) — those updated correctly in the
 * reported repro, so narrowing the guard to the fields actually observed to
 * stick avoids a false-positive risk on fields that were never shown to
 * misbehave. A truly identical fresh re-mention (e.g. a new destination that
 * ALSO explicitly asks for a pool again) is a smaller, softer failure
 * (over-broad results, not a silently narrowed-to-zero search) than the
 * reported bug, and is an accepted tradeoff of this mitigation.
 *
 * @module apps/api/routes/ai/protected/search-chat.stale-carryover
 */

import type { SearchIntentEntities } from '@repo/schemas';
import { isUsableEntityId } from '@repo/utils';

/**
 * Boolean amenity shortcuts prone to silent carryover across turns. Mirrors
 * `search-chat.ts`'s `BOOLEAN_SHORTCUT_AMENITY_SLUGS` keys; `amenitySlugs` /
 * `featureSlugs` are handled separately below because they are arrays.
 */
const STALE_PRONE_BOOLEAN_KEYS = ['hasPool', 'hasWifi', 'allowsPets', 'hasParking'] as const;

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
 * from a PRIOR turn, when this turn introduces a genuinely different
 * destination. See the module doc above for the full rationale.
 *
 * ## What counts as "introduces a different destination"
 *
 * `entities` carries a location signal (id, geo, or city) that is DEFINED
 * and DIFFERENT from `previousEntities`'s (including "previous had none at
 * all"). A message naming NO destination never triggers this — that is the
 * documented "keeps the current destination" refinement case, where
 * carryover is correct, not a bug.
 *
 * ## What gets dropped
 *
 * Only `hasPool` / `hasWifi` / `allowsPets` / `hasParking` / `amenitySlugs` /
 * `featureSlugs` values that are IDENTICAL to the previous turn's — i.e.
 * indistinguishable from blind carryover. A field that genuinely changed
 * (present now, absent or different before) is never touched.
 *
 * @param entities - This turn's validated entities, straight from the model
 *   (before amenity/feature slug resolution).
 * @param previousEntities - The sanitized `currentFilters` echoed by the
 *   client for this turn (the prior turn's accumulated state), or
 *   `undefined` on a first turn.
 * @returns A copy with stale-looking fields removed, or the SAME reference
 *   when nothing needed to change.
 *
 * @example
 * ```ts
 * dropStaleAmenitiesOnLocationChange(
 *   { accommodationType: 'HOTEL', minGuests: 2, destinationId: COLON_UUID, hasPool: true },
 *   { accommodationType: 'CABIN', minGuests: 4, hasPool: true }
 * );
 * // → { accommodationType: 'HOTEL', minGuests: 2, destinationId: COLON_UUID }
 * // (hasPool dropped: identical to the prior turn's value, and a new destination appeared)
 * ```
 */
export function dropStaleAmenitiesOnLocationChange(
    entities: SearchIntentEntities,
    previousEntities: SearchIntentEntities | undefined
): SearchIntentEntities {
    const previousSignal = locationSignal(previousEntities);
    const currentSignal = locationSignal(entities);
    const introducesNewLocation = currentSignal !== undefined && currentSignal !== previousSignal;
    if (!introducesNewLocation) {
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
    if (
        next.amenitySlugs !== undefined &&
        sameSlugSet(next.amenitySlugs, previousEntities?.amenitySlugs)
    ) {
        delete next.amenitySlugs;
        changed = true;
    }
    if (
        next.featureSlugs !== undefined &&
        sameSlugSet(next.featureSlugs, previousEntities?.featureSlugs)
    ) {
        delete next.featureSlugs;
        changed = true;
    }

    return changed ? next : entities;
}
