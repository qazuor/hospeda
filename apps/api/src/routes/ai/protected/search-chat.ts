/**
 * AI conversational-search streaming route (SPEC-212 T-004 / T-005 / T-006 / T-007).
 *
 * Mounted at `POST /api/v1/protected/ai/search-chat` by the protected-AI barrel.
 * Serves the multi-turn conversational accommodation search experience.
 *
 * ## Middleware order
 *
 * `createProtectedStreamingRoute` prepends `protectedAuthMiddleware`, so the
 * effective order is:
 *
 *   auth → entitlement (loads context) → rateLimit-perUser → rateLimit-perIP
 *     → quota (per-plan monthly, consumer-keyed)
 *
 * `entitlementMiddleware()` runs first so billing context (limits) is populated
 * for the quota middleware. `ai_search` is auth-baseline (SPEC-283 OQ-1): it has
 * a graduated per-plan monthly quota keyed on the requesting user but NO plan
 * entitlement, so `createAiQuotaMiddleware('search', { skipEntitlementGate: true })`
 * enforces the quota without the entitlement gate. The USD cost ceiling and
 * metering remain inside the AI engine via `createConfiguredAiService()`.
 *
 * ## Handler status (T-007 implemented)
 *
 * T-007 is now wired: after the `streamText` stream drains, the accumulated
 * assistant reply is persisted to `aiConversations` / `aiMessages` with
 * `feature='search'` via `persistSearchChatTurn`. The persistence is
 * best-effort: it races a 1500 ms timeout. On success the `done` frame carries
 * the real persisted `conversationId`; on failure or timeout it carries `null`.
 * Persistence failures are logged via `apiLogger` and swallowed — they MUST
 * NEVER break the SSE stream or throw out of the handler.
 *
 * ## Attraction-constrained search (HOS-111 T-016, G-11)
 *
 * When the extracted entities carry `attractionSlugs` (T-015 — a curated
 * allowlist match, e.g. "carnavales"), the handler resolves them to the
 * destinations that have that attraction and constrains `params.
 * destinationIds` to that set. See the inline comment at the resolution
 * block for how this combines with nearby-expansion (T-013) and a single
 * resolved `destinationId` when both fire in the same turn.
 *
 * ## POI-constrained + proximity-centered search (HOS-113 §6.3, T-042)
 *
 * When the extracted entities carry `poiSlugs` (T-040 — a curated allowlist
 * match against a NAMED landmark, e.g. "cerca del autódromo"), the handler
 * resolves them via `resolvePoiConstraint` (T-039): on a `constrain` outcome
 * it both narrows `params.destinationIds` (same intersect-or-no-match rule as
 * attractions) AND overwrites `params.latitude`/`params.longitude`/
 * `params.radius` with the matched landmark's own coordinates + the default
 * (or model-extracted) radius — reusing the EXISTING "near POI" geo path
 * (HOS-113 §6.2, NG-2: no new distance SQL). The resolved slugs are echoed
 * back on the `filters` frame's `poiSlugs` field (T-043) so the UI/reply can
 * cite what was resolved; an unmatched or conflicting mention silently skips
 * the proximity constraint on the SEARCH itself (R-4 — never a hallucinated
 * slug, never a crash). On the REPLY side, a `no-match` (or a non-fatal
 * resolution failure with a raw mention still present) now builds a
 * `poiLocationConflict` and threads it into `buildSearchReplyMessages` (HOS-113
 * review H-1/M-1) so the assistant never narrates a proximity search that
 * didn't actually run — see the Step 7.7 comment below.
 *
 * HOS-142 §6.6/G-7 extended `poiSlugs` with a server-side lexical fallback:
 * `matchPoiTerms` (the same curated+generated `POI_ALLOWLIST` used to build
 * the prompt's embedded subset) runs directly against the raw user message,
 * so a landmark whose slug wasn't in the (deliberately small) prompt-embedded
 * subset can still be resolved — see the Step 7.7 comment below for the
 * dedup/precedence details.
 *
 * @module apps/api/routes/ai/protected/search-chat
 */

import type { AiService } from '@repo/ai-core';
import {
    amenities,
    and,
    destinations,
    eq,
    features,
    getDb,
    inArray,
    isNull,
    safeIlike,
    sql
} from '@repo/db';
import {
    type AiSearchChatFiltersEvent,
    type AiSearchChatRequest,
    AiSearchChatRequestSchema,
    type AttractionLocationConflict,
    type NearbyDestinationSummary,
    type SearchIntentEntities,
    SearchIntentEntitiesSchema,
    type SearchIntentOutput,
    SearchIntentOutputSchema
} from '@repo/schemas';
import { DEFAULT_POI_PROXIMITY_RADIUS_KM, DestinationService } from '@repo/service-core';
import { isUsableEntityId } from '@repo/utils';
import { createAiQuotaMiddleware } from '../../../middlewares/ai-quota.js';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit.js';
import { entitlementMiddleware } from '../../../middlewares/entitlement.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { meterAiUsage } from '../../../utils/ai-usage-metering.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    createProtectedStreamingRoute,
    type StreamTextChunk
} from '../../../utils/streaming-route-factory.js';
import { resolveAttractionConstraint } from './attraction-resolver.js';
import { matchPoiTerms } from './poi-allowlist.js';
import { resolvePoiConstraint } from './poi-resolver.js';
import { persistSearchChatTurn } from './search-chat.persistence.js';
import {
    buildConversationalSearchPrompt,
    buildSearchReplyMessages,
    buildSearchReplySystemPrompt,
    type LocationCarryoverConflict,
    type PoiLocationConflict
} from './search-chat.prompt.js';
import {
    dropDestinationId,
    mapIntentToSearchParams,
    sanitizeSearchIntentEntities
} from './search-intent.mapper.js';

/** Search-radius clamp shared with `search-intent.mapper.ts` (§5.3 clamp rule). */
const MAX_POI_RADIUS_KM = 500;

/** Best-effort persistence timeout (mirrors the chat route — SPEC-200 T-003). */
const PERSISTENCE_TIMEOUT_MS = 1500;

// ─── Slug → UUID resolution helpers ──────────────────────────────────────────

/**
 * Amenity slug matched by each boolean shortcut flag on {@link SearchIntentEntities}.
 *
 * Mirrors the mapper's boolean-shortcut serialisation (`hasPool` → `'true'`,
 * etc.) but on the amenity-slug side: these are the exact slugs the model may
 * ALSO emit in `amenitySlugs` for the same physical amenity.
 */
const BOOLEAN_SHORTCUT_AMENITY_SLUGS = {
    hasPool: 'pool',
    hasParking: 'parking',
    hasWifi: 'wifi',
    allowsPets: 'pet_friendly'
} as const;

/**
 * Removes amenity slugs that are already covered by a `true` boolean shortcut
 * flag (`hasPool`, `hasParking`, `hasWifi`, `allowsPets`).
 *
 * ## Why this is needed
 *
 * The model may extract BOTH `hasPool: true` AND `amenitySlugs: ['pool']` for
 * the same user request. The boolean shortcut is deliberately expanded
 * downstream (search UI / accommodation search) into an OR of variants
 * (e.g. `pool` OR `heated_pool`), while a resolved amenity UUID is applied
 * with exact AND semantics. Keeping `'pool'` in `amenitySlugs` in that case
 * would additionally AND-filter on the exact `pool` amenity, silently
 * excluding accommodations that only have a variant like `heated_pool` —
 * even though the boolean shortcut alone would have matched them.
 *
 * Dropping the duplicated slug BEFORE resolving `amenitySlugs` to UUIDs keeps
 * the boolean shortcut as the sole (correct, OR-based) source of truth for
 * that amenity, while leaving any OTHER amenity slugs in the array untouched.
 *
 * @param amenitySlugs - Raw amenity slugs from `entities.amenitySlugs`.
 * @param entities - The validated entities carrying the boolean shortcut flags.
 * @returns A new array with slugs already covered by a `true` boolean shortcut removed.
 */
function dedupeAmenitySlugsAgainstBooleanShortcuts(
    amenitySlugs: readonly string[],
    entities: SearchIntentEntities
): string[] {
    const shortcutSlugsToDrop = new Set<string>();
    if (entities.hasPool === true) {
        shortcutSlugsToDrop.add(BOOLEAN_SHORTCUT_AMENITY_SLUGS.hasPool);
    }
    if (entities.hasParking === true) {
        shortcutSlugsToDrop.add(BOOLEAN_SHORTCUT_AMENITY_SLUGS.hasParking);
    }
    if (entities.hasWifi === true) {
        shortcutSlugsToDrop.add(BOOLEAN_SHORTCUT_AMENITY_SLUGS.hasWifi);
    }
    if (entities.allowsPets === true) {
        shortcutSlugsToDrop.add(BOOLEAN_SHORTCUT_AMENITY_SLUGS.allowsPets);
    }

    if (shortcutSlugsToDrop.size === 0) {
        return [...amenitySlugs];
    }

    return amenitySlugs.filter((slug) => !shortcutSlugsToDrop.has(slug));
}

/**
 * Resolves amenity slugs to UUIDs via a single DB query.
 *
 * Returns an empty array when `slugs` is empty (skips the DB round-trip).
 * Unknown slugs are silently ignored — only rows that match are returned.
 *
 * @param slugs - Amenity slug identifiers from the validated entities.
 * @returns Array of UUID strings for the matching amenity rows.
 */
async function resolveAmenityIds(slugs: readonly string[]): Promise<string[]> {
    if (slugs.length === 0) {
        return [];
    }
    const db = getDb();
    const rows = await db
        .select({ id: amenities.id })
        .from(amenities)
        .where(inArray(amenities.slug, [...slugs]));
    return rows.map((r) => r.id);
}

/**
 * Resolves feature slugs to UUIDs via a single DB query.
 *
 * Returns an empty array when `slugs` is empty (skips the DB round-trip).
 * Unknown slugs are silently ignored — only rows that match are returned.
 *
 * @param slugs - Feature slug identifiers from the validated entities.
 * @returns Array of UUID strings for the matching feature rows.
 */
async function resolveFeatureIds(slugs: readonly string[]): Promise<string[]> {
    if (slugs.length === 0) {
        return [];
    }
    const db = getDb();
    const rows = await db
        .select({ id: features.id })
        .from(features)
        .where(inArray(features.slug, [...slugs]));
    return rows.map((r) => r.id);
}

/**
 * Visibility / lifecycle predicate shared by every destination lookup in this
 * route, so a hidden, draft, or soft-deleted destination is never resolvable —
 * whether it is reached by name (`resolveDestinationIdFromCity`) or by id
 * (`destinationRowExists`).
 *
 * @returns The `and(...)` predicate for public + active, non-deleted destinations.
 */
function publicActiveDestinationFilter() {
    return and(
        isNull(destinations.deletedAt),
        eq(destinations.visibility, 'PUBLIC'),
        eq(destinations.lifecycleState, 'ACTIVE')
    );
}

/**
 * Verifies a model-emitted `entities.destinationId` against the destinations
 * table (HOS-298).
 *
 * ## Why an id from the model needs verifying at all
 *
 * `entities.destinationId` has NO legitimate source. The extraction prompt
 * gives the model no destination-UUID allowlist — unlike `amenitySlugs` /
 * `featureSlugs`, which are constrained to a per-request list and then
 * re-resolved server-side, and unlike `city`, which gets this same DB
 * round-trip via {@link resolveDestinationIdFromCity}. The only DB-verified
 * destination the handler produces is `resolvedDestinationId`, and that one
 * goes to `params`, never back into `intent`. So every value the model puts in
 * this slot is invented; the nil UUID it emits as a "there is a destination, I
 * just do not know which" placeholder is merely the most reproducible one.
 * `isUsableEntityId` catches blank and nil, but
 * `123e4567-e89b-12d3-a456-426614174000` (the RFC 4122 example UUID) or a
 * v4-shaped `00000000-0000-4000-8000-000000000000` would sail through it with
 * the identical symptom: zero results for a constraint the user never
 * expressed, and a self-reinforcing filter set that keeps re-emitting it.
 *
 * Uses {@link publicActiveDestinationFilter} — the same predicate the city
 * lookup uses — so an id that names a hidden or deleted destination is treated
 * exactly like one that names nothing.
 *
 * Only called when the model actually emitted an id that survived the cheap
 * guard, so the common request pays nothing for it, and it runs inside the
 * handler's existing `Promise.all` alongside the amenity/feature/city lookups
 * rather than adding a serial round-trip.
 *
 * ## Fails CLOSED, never fatal (HOS-298 round 2)
 *
 * A rejection here used to propagate out of that `Promise.all` and out of the
 * handler, turning a transient destinations-table blip into a JSON 500 with no
 * SSE frames at all — on a turn that previously issued zero queries, and AFTER
 * the intent-extraction provider call had already been paid for. Every other
 * resolution step in this handler (nearby expansion, attraction, POI) is
 * explicitly non-fatal, so this one is too: the error is logged and the id is
 * treated as UNVERIFIED (dropped). Fail-closed rather than fail-open, because
 * the whole point of the check is that the slot has no legitimate source —
 * "the DB did not confirm it" and "the DB said no" must lead to the same
 * place, and the dropped-location path already has its own user-visible
 * signal (`locationCarryoverConflict`).
 *
 * @param destinationId - Candidate destination UUID emitted by the model.
 * @returns Whether a public, active destination row carries that id. `false`
 *   when the lookup itself failed.
 */
async function destinationRowExists(destinationId: string): Promise<boolean> {
    try {
        const db = getDb();
        const rows = await db
            .select({ id: destinations.id })
            .from(destinations)
            .where(and(publicActiveDestinationFilter(), eq(destinations.id, destinationId)));
        return rows.length > 0;
    } catch (error) {
        apiLogger.warn(
            {
                destinationId,
                error: error instanceof Error ? error.message : String(error)
            },
            'search-chat: destinationId verification failed (non-fatal, id treated as unverified)'
        );
        return false;
    }
}

/**
 * Whether an entity set carries any location the user actually expressed.
 *
 * Used to decide whether dropping an unusable `destinationId` LOST a location
 * (HOS-298 — see the `locationCarryoverConflict` block in the handler), so the
 * three signals mirror the mapper's own location-priority chain: a usable
 * destination id, a non-blank city, or a complete geo pair.
 *
 * @param entities - Entity set to inspect (typically the inbound `currentFilters`).
 * @returns `true` when at least one location signal is present.
 */
function hasLocationSignal(entities: SearchIntentEntities | undefined): boolean {
    if (entities === undefined) {
        return false;
    }
    return (
        isUsableEntityId(entities.destinationId) ||
        (typeof entities.city === 'string' && entities.city.trim() !== '') ||
        (entities.latitude !== undefined && entities.longitude !== undefined)
    );
}

/**
 * Whether the mapped search params still constrain results to a location.
 *
 * Reads `params` (not the entities) because that is what the accommodation
 * search actually receives, and because the attraction / POI steps can add a
 * `destinationIds` narrowing that no entity slot reflects.
 *
 * `q` is deliberately NOT counted (HOS-298 round 2). It is an ILIKE against
 * `accommodations.name` / `accommodations.description` — never a location
 * filter — so counting it here SUPPRESSED the carry-over signal in exactly the
 * case that needs it: a dropped id plus a city that fell through to
 * `params.q`, which is the degraded keyword search this whole block exists to
 * announce. Dropping it also removes a blank-vs-absent mismatch with the
 * sibling {@link hasLocationSignal}, which trims `city` while a `city: ''`
 * would have emitted `q: ''` and read as "a location survived".
 *
 * @param params - The URL-ready params assembled for this turn.
 * @returns `true` when at least one location filter survived into the query.
 */
function paramsHaveLocationFilter(params: AiSearchChatFiltersEvent['params']): boolean {
    // TYPE-WORKAROUND: the params are typed as AccommodationSearchHttp, whose
    // location fields are optional in a way TypeScript cannot narrow through a
    // plain property probe here; this reads three known keys for presence only
    // and never uses the values, so a loose record is the honest shape.
    const probe = params as unknown as Record<string, unknown>;
    return (
        probe.destinationId !== undefined ||
        (Array.isArray(probe.destinationIds) && probe.destinationIds.length > 0) ||
        (probe.latitude !== undefined && probe.longitude !== undefined)
    );
}

/**
 * Resolves a free-text city name to a known destination UUID (fix for the
 * "city falls back to free-text `q` search" bug).
 *
 * ## Why this exists
 *
 * `entities.city` (e.g. "Colón") previously always fell through to the `q`
 * free-text keyword param, which does an ILIKE against accommodation
 * name/description — almost never matching accommodations that are simply
 * LOCATED in that city. This resolves the city server-side against the
 * `destinations` table (mirrors `resolveAmenityIds` / `resolveFeatureIds`)
 * so the caller can pass a verified `destinationId` to the mapper instead.
 *
 * ## Matching strategy
 *
 * 1. Exact, case-insensitive match on `destinations.name`, scoped to public +
 *    active destinations (never resolves to a hidden/draft/deleted row).
 * 2. If no exact match, a `safeIlike` substring match on `destinations.name`
 *    (handles partial mentions or minor spelling variance) — first match wins.
 *
 * Returns `undefined` when no destination matches, in which case the caller
 * keeps the existing fallback to `q` (mapper priority: `destinationId` > geo
 * > `city`).
 *
 * Like its sibling {@link destinationRowExists}, a DB failure here is
 * NON-FATAL (HOS-298 round 2): both run unwrapped inside the handler's
 * `Promise.all`, so an unhandled rejection would take the whole turn down with
 * a JSON 500 and no SSE at all. Degrading to `undefined` lands on the already
 * documented "city could not be resolved" path instead.
 *
 * @param city - Raw city name extracted by the model (`entities.city`).
 * @returns The matching destination UUID, or `undefined` when no match is found
 *   (or when the lookup itself failed).
 */
async function resolveDestinationIdFromCity(city: string): Promise<string | undefined> {
    const trimmedCity = city.trim();
    if (trimmedCity.length === 0) {
        return undefined;
    }

    try {
        const db = getDb();
        const publicActiveFilter = publicActiveDestinationFilter();

        // Priority 1: exact case-insensitive match on the destination name.
        const exactRows = await db
            .select({ id: destinations.id })
            .from(destinations)
            .where(
                and(publicActiveFilter, sql`LOWER(${destinations.name}) = LOWER(${trimmedCity})`)
            );
        if (exactRows[0]) {
            return exactRows[0].id;
        }

        // Priority 2: fuzzy substring match (handles partial or slightly varied
        // city mentions). safeIlike escapes '%', '_', and '\' metacharacters, so
        // it must always be used here instead of the raw drizzle helper.
        const fuzzyRows = await db
            .select({ id: destinations.id })
            .from(destinations)
            .where(and(publicActiveFilter, safeIlike(destinations.name, trimmedCity)));
        return fuzzyRows[0]?.id;
    } catch (error) {
        apiLogger.warn(
            {
                city: trimmedCity,
                error: error instanceof Error ? error.message : String(error)
            },
            'search-chat: city → destination resolution failed (non-fatal, falling back to keyword search)'
        );
        return undefined;
    }
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * Protected SSE route: `POST /api/v1/protected/ai/search-chat`.
 *
 * Turns a multi-turn natural-language accommodation search conversation into
 * structured filter parameters (via `generateObject`) and streams a
 * natural-language reply (via `streamText`).
 *
 * ## Governance model (SPEC-211 §7.7, revised by SPEC-283)
 *
 * `ai_search` is **auth-baseline**: available to every authenticated user with
 * a graduated per-plan monthly quota, but NO plan entitlement gate. The route is:
 *
 * - Authenticated-only (handled by `createProtectedStreamingRoute`'s
 *   `protectedAuthMiddleware`).
 * - Rate-limited by `createAiRateLimitMiddlewares('search')` (per-user + per-IP
 *   burst guard). Same rate-limit configuration as the sibling search-intent
 *   route (SPEC-199) — they share the `search` feature key.
 * - Quota-gated by `createAiQuotaMiddleware('search', { skipEntitlementGate: true })`
 *   — a per-plan MAX_AI_SEARCH_PER_MONTH keyed on the requesting user
 *   (SPEC-283, reverting SPEC-211 G-4).
 * - Cost-backstopped by the `ai_settings` per-feature USD ceiling enforced
 *   inside `createConfiguredAiService()` — NOT as a middleware.
 * - Metered by this route via `meterAiUsage` after the reply stream drains
 *   (HOS-328). The engine itself does NOT write to `ai_usage` — see the
 *   engine module JSDoc, which states that decision explicitly — so this route
 *   is the only writer, and the monthly `search` counter depends entirely on
 *   it. One row is written per request, aggregating BOTH provider calls the
 *   handler makes (intent extraction + reply).
 *
 * ## SSE event sequence (SPEC-212 §5)
 *
 * For a single turn the stream emits:
 *
 *   1. `filters` — URL-ready accommodation search params + extracted intent.
 *      (T-005: emitted as soon as `generateObject` resolves, before the reply.)
 *   2. `token` × N — incremental text chunks of the NL reply.
 *      (T-006: emitted by the `streamText` async iterable.)
 *   3. `done` — terminal frame carrying the persisted `conversationId`.
 *      (T-006/T-007: conversationId added by T-007 persistence step.)
 *
 * On error: a single `error` frame is emitted and the stream closes (no `done`).
 *
 * ## Handler flow (T-007)
 *
 * 1. Parse the validated body: messages, optional currentFilters, locale, conversationId.
 * 2. Derive `message` (last user turn) and `history` (all prior messages).
 * 3. Build the per-request slot-extraction prompt via `buildConversationalSearchPrompt`.
 * 4. Call `aiService.generateObject` with `SearchIntentOutputSchema` to extract
 *    the full updated entity set. Mirrors search-intent.ts (same Zod-cast pattern).
 * 5. Safe-parse returned entities; fall back to `{}` on failure.
 * 6. Resolve amenity slugs (deduped against boolean shortcuts — see
 *    `dedupeAmenitySlugsAgainstBooleanShortcuts`), feature slugs, and — when a
 *    city was extracted and no explicit geo pair is present — the city name to
 *    a destination UUID (see `resolveDestinationIdFromCity`), all in parallel
 *    (single DB queries each). A model-emitted `entities.destinationId` does
 *    NOT suppress the city lookup (HOS-298 round 2): the id is unverified at
 *    that point, so skipping on it degraded a real destination filter into a
 *    free-text `q` search whenever the id turned out to be invented.
 * 7. Map entities to URL-ready params via `mapIntentToSearchParams`, passing the
 *    resolved amenity/feature UUIDs and (if resolved) the destination UUID.
 * 8. Build the reply system prompt via `buildSearchReplySystemPrompt` (caller-wins
 *    policy — this OVERRIDES `DEFAULT_PROMPTS['search']` so the model outputs text,
 *    not JSON). Assemble `streamText` messages via `buildSearchReplyMessages`.
 * 9. Call `aiService.streamText` with `feature: 'search'`, the reply messages, and
 *    the locale. Adapt the raw `{ delta }` chunks via an async generator;
 *    accumulate the full reply text as chunks arrive.
 * 10. After stream drains, race `persistSearchChatTurn` against 1500 ms.
 *     On success: `done.conversationId` = persisted id.
 *     On timeout/failure: `done.conversationId` = null (non-fatal, logged).
 * 11. Return `{ filters, stream, meta }`. The factory emits:
 *     - `filters` frame (from step 7),
 *     - `token` frames (from the generator in step 9),
 *     - `done` frame with `{ conversationId }` (real persisted id, or null).
 */
export const protectedAiSearchChatRoute = createProtectedStreamingRoute({
    path: '/',
    summary: 'Conversational AI accommodation search (streaming SSE)',
    description:
        'Multi-turn conversational search that extracts filter parameters from natural language ' +
        'and streams a natural-language reply via Server-Sent Events. ' +
        'Requires authentication and is subject to per-user/IP rate limits and a USD cost ceiling. ' +
        'Gated by a graduated per-plan monthly quota keyed on the requesting user (SPEC-283); ' +
        'ai_search remains auth-baseline (no plan entitlement gate).',
    tags: ['AI Search'],
    requestSchema: AiSearchChatRequestSchema,
    options: {
        middlewares: [
            // Layer 0: load billing context into Hono context vars (entitlements, limits,
            // billingLoadFailed). Does NOT gate AI_SEARCH — search is platform-governed.
            // Runs first so downstream middleware / handler always has a populated context.
            entitlementMiddleware(),
            // Layer 1: burst control (perUser + perIP sliding-window rate limits).
            // Uses the same 'search' feature key as the sibling search-intent route (SPEC-199).
            ...createAiRateLimitMiddlewares('search'),
            // Layer 2: per-plan monthly quota keyed on the requesting (consuming)
            // user (SPEC-283 §2.2, reverting SPEC-211 G-4 / §7.7). skipEntitlementGate
            // is true because ai_search is auth-baseline (OQ-1): no plan grants
            // AI_SEARCH, so only the graduated per-plan quota applies — the
            // entitlement gate would otherwise 403 every request. The USD cost
            // ceiling + metering stay inside the AI engine as a backstop.
            createAiQuotaMiddleware('search', { skipEntitlementGate: true })
        ]
    },
    streamHandler: async ({ c }) => {
        const handlerStartMs = Date.now();
        const rawBody = (await c.req.json()) as AiSearchChatRequest;

        // Step 1: Parse validated body fields.
        const { messages, currentFilters, locale, conversationId } = rawBody;
        const actor = getActorFromContext(c);

        apiLogger.debug(
            {
                messageCount: messages.length,
                locale,
                hasCurrentFilters: currentFilters !== undefined,
                hasConversationId: conversationId != null
            },
            'search-chat: handler invoked (T-005)'
        );

        // Step 2: Derive the new user message and the prior conversation history.
        // The schema guarantees messages.length >= 1, so the last element exists.
        // biome-ignore lint/style/noNonNullAssertion: schema enforces min(1)
        const message = messages[messages.length - 1]!.content;
        const history = messages.slice(0, -1);

        // Step 3: Build the per-request conversational prompt.
        //
        // HOS-298: the client echoes back the previous turn's entities, so a
        // session that already picked up a placeholder destination before this
        // fix shipped would keep feeding it into the CURRENT FILTER SET, where
        // the "carry filters over unchanged" rule tells the model to keep it.
        // Sanitising the INBOUND filters too means such a session heals on its
        // next turn instead of staying poisoned until the user starts over.
        const sanitizedCurrentFilters =
            currentFilters === undefined ? undefined : sanitizeSearchIntentEntities(currentFilters);
        const prompt = buildConversationalSearchPrompt({
            currentFilters: sanitizedCurrentFilters,
            history,
            message,
            locale
        });

        // Step 4: Extract the full updated filter set via generateObject.
        //
        // Cast SearchIntentOutputSchema to the parameter type that ai-service's
        // generateObject expects. Mirrors the exact cast used in search-intent.ts
        // (lines 257-263): both @repo/schemas and @repo/ai-core pin zod ^4.0.8,
        // but pnpm may resolve them to slightly different patch versions, producing
        // a nominal ZodType mismatch that is safe to bypass — the runtime schemas
        // are identical and the structural contract is enforced by the safeParse below.
        const aiService = await createConfiguredAiService();
        type GenerateObjectSchema = Parameters<AiService['generateObject']>[1];
        const outputSchema = SearchIntentOutputSchema as unknown as GenerateObjectSchema; // TYPE-WORKAROUND: pnpm may resolve @repo/schemas and @repo/ai-core to different Zod patch versions (4.3.x vs 4.4.x), causing a nominal ZodType mismatch; the runtime schemas are structurally identical and the safeParse enforces the contract.
        const result = await aiService.generateObject(
            { feature: 'search', prompt, locale },
            outputSchema
        );

        // HOS-328: remember this call's token usage. A single search-chat
        // request makes TWO provider calls (this intent extraction, then the
        // reply stream in step 9); both are aggregated into the one `ai_usage`
        // row written after the stream drains, so the recorded cost reflects
        // the full request and not just its second half.
        const intentUsage = result.usage;

        // Step 5: Safe-parse entities; fall back to empty on model output failure.
        //
        // `result.object` is typed as `unknown` because the Zod-version cast above
        // loses the generic type parameter. Re-assert as `SearchIntentOutput` —
        // the safeParse provides the actual runtime safety guarantee.
        const typedObject = result.object as SearchIntentOutput;
        const rawEntities = typedObject.entities;

        const entitiesParse = SearchIntentEntitiesSchema.safeParse(rawEntities);
        let validatedEntities: SearchIntentEntities;
        if (entitiesParse.success) {
            validatedEntities = entitiesParse.data;
        } else {
            apiLogger.warn(
                { locale, issues: entitiesParse.error.issues },
                'search-chat: entities safeParse failed — falling back to empty entities'
            );
            validatedEntities = {};
        }

        // HOS-298: drop an unusable destination id before anything downstream
        // can see it.
        //
        // This is the cheap half (blank / nil UUID, no DB round-trip); the
        // authoritative check against the destinations table runs in the
        // parallel resolution block below, once we know the id is worth a query.
        //
        // The model sometimes answers a refinement turn that has no destination
        // with the nil UUID, as a "there is a destination, I just do not know
        // which" stand-in. It survives `SearchIntentEntitiesSchema` because it
        // is a syntactically valid UUID, and it then filters by a destination
        // that cannot exist: zero results the user never asked for.
        //
        // Scrubbing HERE rather than at each consumer is deliberate — this one
        // value feeds five separate paths, and the schema itself cannot clean it
        // (the same object is the `generateObject` output schema, and transforms
        // cannot be expressed in JSON Schema — the `radius: 0` sentinel hit the
        // identical wall and was likewise fixed in its consumers):
        //
        //   1. the search params via `mapIntentToSearchParams` (the 0 results),
        //   2. the reply/prompt narrative, which treats the slot as "a
        //      destination is already pinned" (the city → destination lookup
        //      used to be skipped for the same reason; round 2 removed that
        //      coupling — see `cityToResolve` below),
        //   3. the nearby-expansion anchor, which would query with a junk id,
        //   4. the attraction/POI destination intersection, where a nil id
        //      intersects nothing and forces a bogus "no destination combines
        //      those" conflict on a LATER turn,
        //   5. the `filters.intent` SSE payload — the load-bearing one. The
        //      client stores that verbatim and echoes it back as
        //      `currentFilters` next turn, where it lands in the prompt's
        //      CURRENT FILTER SET and the "carry filters over unchanged" rule
        //      makes the model keep re-emitting it. Left in, the bad value
        //      re-infects every remaining turn of the conversation; a fix that
        //      only cleaned the query would leave the chip and the empty results
        //      exactly as reported.
        //
        // The "was anything dropped?" test is an explicit before/after
        // comparison of the slot, NOT `sanitized !== validated`: reference
        // identity happens to work today only because the helper returns the
        // same object when it has nothing to do, which is an implementation
        // detail of the helper, not part of its contract.
        const sanitizedEntities = sanitizeSearchIntentEntities(validatedEntities);
        let destinationIdDropped =
            validatedEntities.destinationId !== undefined &&
            sanitizedEntities.destinationId === undefined;
        if (destinationIdDropped) {
            apiLogger.warn(
                { locale, destinationId: validatedEntities.destinationId },
                'search-chat: dropped an unusable model-emitted destinationId'
            );
        }
        validatedEntities = sanitizedEntities;

        // Step 6: Resolve amenity slugs, feature slugs, and city → destinationId
        // to DB-verified values in parallel.
        //
        // Amenity slugs are first deduped against any `true` boolean shortcut
        // flag (hasPool/hasParking/hasWifi/allowsPets) — see
        // `dedupeAmenitySlugsAgainstBooleanShortcuts` JSDoc for why: resolving
        // both would AND-filter on the exact amenity on top of the shortcut's
        // OR-based variant expansion, silently excluding valid matches.
        const rawAmenitySlugIds = validatedEntities.amenitySlugs ?? [];
        const amenitySlugIds = dedupeAmenitySlugsAgainstBooleanShortcuts(
            rawAmenitySlugIds,
            validatedEntities
        );
        const featureSlugIds = validatedEntities.featureSlugs ?? [];

        // Only attempt city → destination resolution when a city was extracted
        // AND no explicit geo pair is present. Geo keeps its precedence (mapper
        // priority 2 beats city, and a resolved city would otherwise jump to
        // priority 0 and override coordinates the user actually gave), so a
        // lookup whose result would be discarded is still never paid for.
        //
        // HOS-298 (round 2): `entities.destinationId` deliberately does NOT
        // suppress this lookup any more. It used to, and the read happened
        // BEFORE `destinationRowExists` had verified the id — so
        // `{ city: 'Colón', destinationId: <invented> }` skipped the city
        // lookup, then dropped the id, then fell through to mapper priority 3
        // and emitted `params.q = 'Colón'`. `q` is an ILIKE on the
        // accommodation NAME/DESCRIPTION, never a location filter (see
        // `resolveDestinationIdFromCity`'s "Why this exists"), so turn 2 of
        // "cabañas en Colón" silently degraded from a real destination filter
        // to a name-substring search. Resolving unconditionally costs one extra
        // query ONLY when both slots are populated — the exact path that already
        // pays for the verification query — and the mapper still gives
        // `resolvedDestinationId` priority 0 over `entities.destinationId`, so
        // nothing downstream has to change.
        const hasGeoLocationSignal =
            validatedEntities.latitude !== undefined && validatedEntities.longitude !== undefined;
        const cityToResolve =
            validatedEntities.city !== undefined && !hasGeoLocationSignal
                ? validatedEntities.city
                : undefined;

        // HOS-298: the model-emitted destinationId is verified against the
        // destinations table in this same parallel block — it is the only
        // location signal that never gets a DB round-trip otherwise, and it has
        // no legitimate source at all (see `destinationRowExists`). The query is
        // only issued when an id actually survived the cheap guard, so a turn
        // without one costs nothing extra. `true` (not a query) is the "nothing
        // to verify" value, so the drop below cannot fire on a turn that never
        // had an id.
        const destinationIdToVerify = validatedEntities.destinationId;

        const [resolvedAmenityIds, resolvedFeatureIds, resolvedDestinationId, destinationIdIsReal] =
            await Promise.all([
                resolveAmenityIds(amenitySlugIds),
                resolveFeatureIds(featureSlugIds),
                cityToResolve === undefined
                    ? undefined
                    : resolveDestinationIdFromCity(cityToResolve),
                destinationIdToVerify === undefined
                    ? true
                    : destinationRowExists(destinationIdToVerify)
            ]);

        if (destinationIdToVerify !== undefined && !destinationIdIsReal) {
            apiLogger.warn(
                { locale, destinationId: destinationIdToVerify },
                'search-chat: dropped a model-emitted destinationId that matches no destination'
            );
            validatedEntities = dropDestinationId(validatedEntities);
            destinationIdDropped = true;
        }

        // Step 7: Map validated intent to URL-ready AccommodationSearchHttp params.
        //
        // mapIntentToSearchParams returns MappedParams (Record<string, string | string[]>)
        // which is structurally compatible with AccommodationSearchHttp for the fields it
        // actually sets. The cast is safe: the returned object carries only valid
        // AccommodationSearchHttp keys (whitelist-enforced by the mapper). `page` and
        // `pageSize` are intentionally absent — the UI applies its own defaults when it
        // constructs the search request. TYPE-WORKAROUND: MappedParams lacks `page`/`pageSize`
        // which AccommodationSearchHttp requires (they have Zod defaults making them
        // non-optional in the output type); the client receives a partial param set and
        // the search endpoint applies pagination defaults independently.
        const mappedParams = mapIntentToSearchParams(
            validatedEntities,
            resolvedAmenityIds,
            resolvedFeatureIds,
            resolvedDestinationId
        );
        // TYPE-WORKAROUND: mapIntentToSearchParams returns MappedParams
        // (Record<string, string | string[]>) which omits page/pageSize; the
        // AccommodationSearchHttp output type marks those required via .default().
        // The emitted params are the URL-ready query form the frontend forwards
        // verbatim, so the shape is compatible at runtime.
        const params = mappedParams as unknown as AiSearchChatFiltersEvent['params'];

        // -----------------------------------------------------------------------
        // Step 7.5 (HOS-111 T-013): Nearby-destination expansion.
        //
        // When the model set `expandToNearby: true` (T-012) AND the mapper
        // resolved a single anchor destination this turn, resolve the
        // anchor's ~50 km neighbors (T-011) and widen the search to a
        // multi-destination query. `params.destinationId` is whatever the
        // mapper's location-priority chain (resolvedDestinationId > entities.
        // destinationId > geo > city-as-q) actually picked — reusing it here
        // (rather than re-deriving priority) guarantees the expansion anchor
        // always matches what the search itself is actually filtering by.
        // Never fatal: a nearby-resolution failure just skips expansion and
        // the turn proceeds as a normal (non-expanded) search.
        // -----------------------------------------------------------------------
        let nearbyDestinations: NearbyDestinationSummary[] = [];
        const nearbyAnchorId =
            typeof params.destinationId === 'string' ? params.destinationId : undefined;

        if (validatedEntities.expandToNearby === true && nearbyAnchorId !== undefined) {
            try {
                const destinationService = new DestinationService({ logger: apiLogger });
                const nearbyResult = await destinationService.getNearby(actor, {
                    destinationId: nearbyAnchorId
                });

                if (!nearbyResult.error && nearbyResult.data.nearby.length > 0) {
                    nearbyDestinations = nearbyResult.data.nearby.map((d) => ({
                        id: d.id,
                        name: d.name,
                        slug: d.slug
                    }));
                    // Widen the accommodation search to the anchor + its
                    // neighbors. `destinationIds` (when non-empty) takes
                    // priority over the singular `destinationId` in the
                    // accommodation model's query builder, so leaving
                    // `params.destinationId` in place is harmless.
                    params.destinationIds = [
                        nearbyAnchorId,
                        ...nearbyDestinations.map((d) => d.id)
                    ];
                } else if (nearbyResult.error) {
                    apiLogger.warn(
                        { destinationId: nearbyAnchorId, error: nearbyResult.error.message },
                        'search-chat: nearby-destination resolution failed (non-fatal, expansion skipped)'
                    );
                }
            } catch (error) {
                apiLogger.warn(
                    {
                        destinationId: nearbyAnchorId,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    'search-chat: nearby-destination resolution threw (non-fatal, expansion skipped)'
                );
            }
        }

        // -----------------------------------------------------------------------
        // Step 7.6 (HOS-111 T-016): Attraction-constrained destination search.
        //
        // When the model emitted attractionSlugs (T-015), resolve them to the
        // destinations that have those attractions. Three outcomes (see
        // `attraction-resolver.ts`):
        //   - `constrain` → narrow the search to those destination ids.
        //   - `no-match`  → the requested attraction is incompatible with the
        //     requested location (empty intersection), OR matched no destination
        //     at all. Owner decision: return ZERO accommodations + have the
        //     assistant explain the conflict, NOT a silent substitution.
        //   - `none`      → no attractionSlugs, or a non-fatal service failure.
        //
        // CRITICAL (empty-array gotcha): the accommodation query builder treats
        // an empty `destinationIds` array as "no location filter" → FULL catalog
        // (`params.destinationIds && length > 0`). So a no-match must NEVER set
        // `params.destinationIds = []` to try to force zero results — instead it
        // emits `attractionLocationConflict` in the filters frame and the web
        // client (`useSearchChat.ts`) skips the accommodation search entirely,
        // rendering the empty-results + explanation state. `params` is left
        // untouched on no-match (the conflict flag is the guarantee).
        // -----------------------------------------------------------------------
        const attractionSlugs = validatedEntities.attractionSlugs ?? [];
        const singularDestinationId =
            typeof params.destinationId === 'string' ? params.destinationId : undefined;
        const currentDestinationIdsForAttraction: string[] | undefined =
            Array.isArray(params.destinationIds) && params.destinationIds.length > 0
                ? params.destinationIds
                : singularDestinationId === undefined
                  ? undefined
                  : [singularDestinationId];

        const attractionResolution = await resolveAttractionConstraint({
            actor,
            attractionSlugs,
            currentDestinationIds: currentDestinationIdsForAttraction
        });

        let attractionLocationConflict: AttractionLocationConflict | undefined;
        if (attractionResolution.kind === 'constrain') {
            params.destinationIds = attractionResolution.destinationIds;
        } else if (attractionResolution.kind === 'no-match') {
            // Best-effort human location label: the resolved city string when
            // present (the raw destinationId UUID has no name to hand here).
            const locationLabel =
                typeof validatedEntities.city === 'string' && validatedEntities.city.trim() !== ''
                    ? validatedEntities.city
                    : undefined;
            attractionLocationConflict = {
                attractionSlugs: [...attractionResolution.attractionSlugs],
                ...(locationLabel === undefined ? {} : { locationLabel })
            };
        }

        // -----------------------------------------------------------------------
        // Step 7.7 (HOS-113 §6.3): POI-constrained + proximity-centered search.
        //
        // When the model emitted poiSlugs (T-040), resolve them to the matched
        // landmark's destinations + coordinates via resolvePoiConstraint (T-039).
        // Recomputed from `params` AFTER the attraction step above, so a turn
        // that carries BOTH an attraction and a POI mention combines all three
        // constraints (location, attraction, POI) rather than the POI silently
        // ignoring the attraction's narrowing.
        //
        // On `constrain`: narrow params.destinationIds to the (already
        // intersected) set AND overwrite params.latitude/longitude/radius with
        // the matched landmark's own coordinates — mirrors the documented
        // precedence on `poiId`/`poiSlug` (HOS-113 §6.2): a resolved POI's
        // coordinates take precedence over any explicit latitude/longitude
        // already present. `radius` honors a model-extracted `entities.radius`
        // when present (clamped, mirrors the mapper's own clamp rule),
        // otherwise falls back to the Phase-2 default (5km).
        //
        // On `no-match`/`none`: deliberately NOT surfaced as a conflict frame
        // on the `filters` SSE payload (unlike attractionLocationConflict) —
        // forcing zero accommodations is out of scope for this phase's tasks
        // (T-038..T-044). The search simply proceeds without the proximity
        // constraint; the resolved `poiSlugs` response field stays empty so
        // the reply never cites an unresolved/hallucinated landmark (R-4).
        //
        // HOS-113 review H-1/M-1: that "search proceeds untouched" is exactly
        // what makes the REPLY narrative risky — `validatedEntities.poiSlugs`
        // (the model's raw, unresolved mention) would otherwise still reach
        // buildSearchReplyMessages' `extractedFilters` context, so the reply
        // could claim a proximity search was applied when it wasn't. When
        // `poiResolution` is `no-match`, or `none` with a raw mention still
        // present (e.g. a non-fatal service failure), `poiLocationConflict`
        // is built below and threaded into Step 8's reply call, which both
        // scrubs the raw slug out of the filters context and injects a
        // corrective system note — see `buildSearchReplyMessages` and
        // `poi-resolver.ts`'s module doc for the full rationale.
        //
        // HOS-142 §6.6/G-7 server-side lexical fallback: `POI_ALLOWLIST` now
        // covers ~661 featured/high-priority POIs, but only a small curated +
        // featured subset is embedded in the LLM prompt (see
        // `buildAllowlistLines` in `search-chat.prompt.ts`) to keep prompt
        // size bounded — so the model may never even see the other POIs'
        // slugs to emit. `matchPoiTerms` runs the SAME allowlist directly
        // against the raw user message here, server-side, independent of
        // what the model extracted — a landmark mention that the model
        // missed (because its slug wasn't in the embedded subset, or the
        // model just didn't extract it) is still resolved. The two sources
        // are deduplicated into a single `poiSlugs` set that flows into
        // `resolvePoiConstraint` exactly as before; `matchPoiTerms` never
        // invents a slug outside `POI_ALLOWLIST` (R-4), so this adds recall,
        // not hallucination risk.
        // -----------------------------------------------------------------------
        const rawPoiSlugs = validatedEntities.poiSlugs ?? [];
        const lexicalPoiSlugs = matchPoiTerms(message, locale);
        const poiSlugs = Array.from(new Set([...rawPoiSlugs, ...lexicalPoiSlugs]));
        const singularDestinationIdForPoi =
            typeof params.destinationId === 'string' ? params.destinationId : undefined;
        const currentDestinationIdsForPoi: string[] | undefined =
            Array.isArray(params.destinationIds) && params.destinationIds.length > 0
                ? params.destinationIds
                : singularDestinationIdForPoi === undefined
                  ? undefined
                  : [singularDestinationIdForPoi];

        const poiResolution = await resolvePoiConstraint({
            actor,
            poiSlugs,
            currentDestinationIds: currentDestinationIdsForPoi
        });

        let resolvedPoiSlugs: string[] = [];
        let poiLocationConflict: PoiLocationConflict | undefined;
        if (poiResolution.kind === 'constrain') {
            params.destinationIds = poiResolution.destinationIds;
            params.latitude = poiResolution.lat;
            params.longitude = poiResolution.long;
            // HOS-207: the model emits `radius: 0` to mean "no radius specified"
            // (0 !== undefined, so the schema keeps it). Treat 0 the same as
            // absent — fall back to the Phase-2 default rather than letting a
            // degenerate 0 km search silently override it.
            const radiusKm =
                validatedEntities.radius === undefined || validatedEntities.radius === 0
                    ? DEFAULT_POI_PROXIMITY_RADIUS_KM
                    : Math.min(validatedEntities.radius, MAX_POI_RADIUS_KM);
            params.radius = radiusKm;
            resolvedPoiSlugs = [...poiResolution.poiSlugs];
        } else if (poiSlugs.length > 0) {
            // A raw mention was extracted but did not resolve (no-match) or
            // degraded non-fatally (none, service error) while still carrying
            // a real mention — flag it for the reply narrative (see the block
            // comment above). Mirrors the attraction conflict's best-effort
            // location label derivation.
            const locationLabel =
                typeof validatedEntities.city === 'string' && validatedEntities.city.trim() !== ''
                    ? validatedEntities.city
                    : undefined;
            poiLocationConflict = {
                poiSlugs: [...poiSlugs],
                ...(locationLabel === undefined ? {} : { locationLabel })
            };
        }

        // -----------------------------------------------------------------------
        // Step 7.8 (HOS-298): a dropped destination must not silently WIDEN the
        // search.
        //
        // Turn 1 "cabañas en Colón" resolves a city. Turn 2 "para 6 personas"
        // carries the location over as a `destinationId` and drops `city` —
        // the model believes the id captured the location. Scrubbing that id
        // then leaves the turn with NO location filter at all, so the user sees
        // accommodations from every destination while the conversation is
        // plainly about Colón, and nothing says so: no chip (the intent no
        // longer carries a location), and the reply is built from the sanitised
        // filters, so it does not mention one either. Before the scrub this was
        // an obviously-wrong zero-result page; after it, it is a
        // plausible-looking WRONG page, which is worse.
        //
        // Step 7.6's attraction no-match documents the owner's rule for this
        // shape of problem: explain the conflict, never substitute silently.
        // Here the owner asked for the signal WITHOUT forcing zero results —
        // the search itself is legitimate, it is just broader than the
        // conversation implies — so this rides the same reply-side plumbing as
        // `poiLocationConflict` (a note on the reply `system` string) rather
        // than the `filters`-frame plumbing that makes the client skip the
        // search entirely.
        //
        // Fires only when all four hold: a destination id was dropped this
        // turn, no attraction conflict already owns the reply, nothing else
        // constrains the query to a location (checked on `params`, AFTER the
        // attraction/POI steps that can add one), and the previous turn
        // genuinely had a location to lose.
        //
        // HOS-298 round 2 — why `attractionLocationConflict` suppresses this:
        // an attraction `no-match` leaves `params` untouched, so a turn that
        // ALSO dropped an id satisfies every condition below and emits both
        // notes at once. They contradict each other. The attraction note says
        // "the search returned ZERO accommodations" (true — the web client
        // skips `fetchAccommodations` entirely and renders the empty state,
        // see `useSearchChat.ts`), while this one would say "the results may
        // come from any destination", which is flatly false when there are no
        // results. The attraction note wins because it describes what the user
        // actually sees.
        //
        // `poiLocationConflict` deliberately does NOT suppress it: a POI
        // no-match is explicitly NOT a zero-results signal (the accommodation
        // search still runs — see Step 7.7 and `poi-resolver.ts`), so the two
        // notes describe different, simultaneously-true facts.
        // -----------------------------------------------------------------------
        let locationCarryoverConflict: LocationCarryoverConflict | undefined;
        if (
            destinationIdDropped &&
            attractionLocationConflict === undefined &&
            !paramsHaveLocationFilter(params) &&
            hasLocationSignal(sanitizedCurrentFilters)
        ) {
            const previousCity = sanitizedCurrentFilters?.city;
            const locationLabel =
                typeof previousCity === 'string' && previousCity.trim() !== ''
                    ? previousCity
                    : undefined;
            locationCarryoverConflict = locationLabel === undefined ? {} : { locationLabel };
        }

        // -----------------------------------------------------------------------
        // Step 8 (T-006): Build the reply system prompt + messages, then call
        // streamText to stream the natural-language acknowledgment.
        //
        // The reply system prompt is supplied via the engine's `system` option
        // (caller-wins) — this OVERRIDES `DEFAULT_PROMPTS['search']` (the JSON
        // extractor) so the model outputs a friendly conversational text, not
        // structured JSON. On an attraction/location conflict, the conflict note
        // is concatenated into that same `system` string so the assistant names
        // it ("no hay carnaval en Chajarí") instead of emitting a generic
        // empty-results acknowledgment. On an unresolved POI mention (HOS-113
        // review H-1/M-1), `poiLocationConflict` is threaded the same way, but
        // corrects the narrative only — it never claims zero results, since the
        // search itself still ran.
        // -----------------------------------------------------------------------
        const replySystemPrompt = buildSearchReplySystemPrompt({ locale });
        const { system: replySystem, messages: replyMessages } = buildSearchReplyMessages({
            systemPrompt: replySystemPrompt,
            history,
            message,
            extractedFilters: validatedEntities,
            attractionLocationConflict,
            poiLocationConflict,
            locationCarryoverConflict
        });

        const { stream: rawStream, meta: rawMeta } = await aiService.streamText({
            feature: 'search',
            system: replySystem,
            messages: replyMessages,
            locale
        });

        // -----------------------------------------------------------------------
        // Step 9 (T-006): Adapt the raw engine stream into `StreamTextChunk`
        // shape. Accumulate the full reply text as chunks arrive so T-007 can
        // persist the complete assistant message after drain.
        // Mirrors the generator in chat.ts (accumulatedAssistantText pattern).
        // -----------------------------------------------------------------------
        let accumulatedReplyText = '';

        // HOS-328: the engine forwards the same `meta` promise through its
        // output-moderation wrapper, which throws AFTER the last token — so
        // `meta` also resolves on requests where the client received an SSE
        // `error` frame and no usable reply. Recording those as 'success' would
        // charge a quota unit for nothing, so track whether the stream actually
        // completed. A promise rather than a boolean: reading a flag would
        // depend on microtask ordering between this generator and `meta`, which
        // is not guaranteed. The factory always drains the stream before
        // awaiting `meta`, so awaiting this cannot deadlock, and the `finally`
        // settles it on throw and early-return alike.
        let markStreamSettled: (drainedCleanly: boolean) => void = () => {};
        const streamDrainedCleanly = new Promise<boolean>((resolve) => {
            markStreamSettled = resolve;
        });

        const stream: AsyncIterable<StreamTextChunk> = (async function* () {
            let drainedCleanly = false;
            try {
                for await (const chunk of rawStream) {
                    accumulatedReplyText += chunk.delta;
                    yield chunk;
                }
                drainedCleanly = true;
            } finally {
                markStreamSettled(drainedCleanly);
            }
        })();

        // HOS-328 side-channel for the case where `rawMeta` REJECTS (mid-stream
        // provider failure). Deliberately a SEPARATE branch off `rawMeta` rather
        // than a rejection arm on the `meta` chain below: `meta` must keep
        // rejecting exactly as it did before, or the factory would emit a `done`
        // frame for a stream that failed. The intent-extraction call already
        // completed and was billed by then, so its tokens are known and recorded
        // — this is the one failure path that carries real, quantified spend.
        rawMeta.catch(() =>
            meterAiUsage({
                userId: actor.id,
                feature: 'search',
                provider: 'none',
                model: 'none',
                promptTokens: intentUsage.promptTokens ?? 0,
                completionTokens: intentUsage.completionTokens ?? 0,
                latencyMs: Date.now() - handlerStartMs,
                status: 'error',
                logContext: { locale, conversationId: conversationId ?? null }
            })
        );

        // -----------------------------------------------------------------------
        // Step 10 (T-007): Persist the turn after the stream drains and resolve
        // `meta` for the `done` frame.
        //
        // Best-effort contract:
        //   - Race `persistSearchChatTurn` against a 1500 ms timeout.
        //   - On success: `done.conversationId` = the persisted id.
        //   - On timeout: `done.conversationId` = null, warn logged.
        //   - On rejection: `done.conversationId` = null, error logged.
        //   - NEVER throws out of this callback — the SSE stream is already
        //     complete and the `done` frame must always be emitted.
        // -----------------------------------------------------------------------
        const meta: Promise<{ readonly conversationId: string | null }> = rawMeta.then(
            async (resolvedMeta) => {
                let resolvedConversationId: string | null = null;

                // ---------------------------------------------------------------
                // Usage metering (HOS-328). See `utils/ai-usage-metering` for why
                // the row exists at all and why the billing unit is the request.
                //
                // The two provider calls this handler makes (intent extraction +
                // reply) are summed into a SINGLE row, so a request costs the
                // caller exactly one quota unit. Provider/model are taken from the
                // reply call: both calls resolve the same `search` feature config,
                // so they agree except in the rare case where a fallback swapped
                // providers mid-request — then the intent call's tokens are priced
                // at the reply call's rate, an accepted approximation.
                //
                // Metering runs CONCURRENTLY with persistence below, not before
                // it. Both are writes on the same connection pool and both are
                // individually time-bounded (1500 ms each), so chaining them
                // would double the worst-case latency of the `done` frame — the
                // exact budget `PERSISTENCE_TIMEOUT_MS` exists to protect.
                // Running them in parallel keeps that budget at 1500 ms, and
                // keeps persistence off the metering path's dependency on the
                // stream having settled.
                //
                // NOTE: this callback runs as soon as `rawMeta` resolves — a
                // `.then` fires eagerly whether or not anyone awaits the derived
                // promise. So on a post-drain output-moderation throw, where the
                // factory emits `error` and never awaits `meta`, the row IS still
                // written (with status 'error', via `streamDrainedCleanly`).
                //
                // `rawMeta` can also REJECT: the adapter builds it as
                // `Promise.all([usage, finishReason])`, so a mid-stream provider
                // failure rejects rather than hangs. That path is covered by the
                // side-channel registered next to the stream above, which still
                // records the already-billed intent call. The remaining unmetered
                // case is a client disconnecting mid-stream, so `rawMeta` never
                // settles at all.
                //
                // The stated 1500 ms budget assumes `streamDrainedCleanly` has
                // already settled by the time `rawMeta` resolves, which holds
                // unless an output-moderation provider is configured — that runs
                // its own round-trip after the adapter resolves `meta`, and adds
                // its latency on top.
                // ---------------------------------------------------------------
                const meteringTask = streamDrainedCleanly.then((drainedCleanly) =>
                    meterAiUsage({
                        userId: actor.id,
                        feature: 'search',
                        provider: resolvedMeta.provider,
                        model: resolvedMeta.model,
                        promptTokens:
                            (intentUsage.promptTokens ?? 0) +
                            (resolvedMeta.usage?.promptTokens ?? 0),
                        completionTokens:
                            (intentUsage.completionTokens ?? 0) +
                            (resolvedMeta.usage?.completionTokens ?? 0),
                        latencyMs: Date.now() - handlerStartMs,
                        status: drainedCleanly ? 'success' : 'error',
                        logContext: { locale, conversationId: conversationId ?? null }
                    })
                );

                try {
                    const persistPromise = persistSearchChatTurn({
                        userId: actor.id,
                        conversationId: conversationId ?? null,
                        // biome-ignore lint/style/noNonNullAssertion: schema enforces min(1)
                        userMessage: messages[messages.length - 1]!.content,
                        assistantMessage: accumulatedReplyText,
                        meta: resolvedMeta
                    }).then((result) => result.conversationId);

                    const timeoutPromise = new Promise<null>((resolve) => {
                        setTimeout(() => resolve(null), PERSISTENCE_TIMEOUT_MS);
                    });

                    resolvedConversationId = await Promise.race([persistPromise, timeoutPromise]);

                    if (resolvedConversationId === null) {
                        apiLogger.warn(
                            { timeoutMs: PERSISTENCE_TIMEOUT_MS },
                            'search-chat: persistence timed out after 1500 ms (non-fatal)'
                        );
                    }
                } catch (error) {
                    apiLogger.error(
                        {
                            error: error instanceof Error ? error.message : String(error)
                        },
                        'search-chat: persistence failed (non-fatal)'
                    );
                }

                // Started before the persistence race above; awaited here so the
                // two overlap instead of chaining.
                //
                // `.catch` is not redundant with `meterAiUsage`'s own guard: the
                // argument object is built INSIDE the `.then` callback, i.e.
                // outside the helper, so a malformed `usage` would reject
                // `meteringTask` and — since this await sits outside the
                // persistence try/catch — turn an already-delivered reply into an
                // SSE `error` frame with no `done` and no conversationId.
                await meteringTask.catch((meteringError: unknown) => {
                    apiLogger.warn(
                        {
                            locale,
                            error:
                                meteringError instanceof Error
                                    ? meteringError.message
                                    : String(meteringError)
                        },
                        'search-chat: usage metering threw (non-fatal — the reply was already delivered)'
                    );
                });

                return { conversationId: resolvedConversationId };
            }
        );

        return {
            filters: {
                params,
                intent: validatedEntities,
                confidence: typedObject.confidence,
                // HOS-111 T-013: only present when this turn actually expanded
                // to nearby destinations (absent, not empty-array, otherwise —
                // see AiSearchChatFiltersEventSchema JSDoc).
                nearbyDestinations: nearbyDestinations.length > 0 ? nearbyDestinations : undefined,
                // HOS-111 T-016: only present on an attraction/location conflict.
                // When present the web client MUST skip the accommodation search
                // and render the empty-results + explanation state (an empty
                // destinationIds array would return the full catalog).
                attractionLocationConflict,
                // HOS-113 T-043: the canonical POI slug(s) resolved this turn
                // (empty array when no landmark was mentioned, matched nothing,
                // or conflicted with the location constraint — R-4, never a
                // hallucinated slug).
                poiSlugs: resolvedPoiSlugs
            },
            stream,
            meta
        };
    }
});
