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
    type SearchIntentEntities,
    SearchIntentEntitiesSchema,
    type SearchIntentOutput,
    SearchIntentOutputSchema
} from '@repo/schemas';
import { createAiQuotaMiddleware } from '../../../middlewares/ai-quota.js';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit.js';
import { entitlementMiddleware } from '../../../middlewares/entitlement.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    createProtectedStreamingRoute,
    type StreamTextChunk
} from '../../../utils/streaming-route-factory.js';
import { persistSearchChatTurn } from './search-chat.persistence.js';
import {
    buildConversationalSearchPrompt,
    buildSearchReplyMessages,
    buildSearchReplySystemPrompt
} from './search-chat.prompt.js';
import { mapIntentToSearchParams } from './search-intent.mapper.js';

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
 * @param city - Raw city name extracted by the model (`entities.city`).
 * @returns The matching destination UUID, or `undefined` when no match is found.
 */
async function resolveDestinationIdFromCity(city: string): Promise<string | undefined> {
    const trimmedCity = city.trim();
    if (trimmedCity.length === 0) {
        return undefined;
    }

    const db = getDb();
    const publicActiveFilter = and(
        isNull(destinations.deletedAt),
        eq(destinations.visibility, 'PUBLIC'),
        eq(destinations.lifecycleState, 'ACTIVE')
    );

    // Priority 1: exact case-insensitive match on the destination name.
    const exactRows = await db
        .select({ id: destinations.id })
        .from(destinations)
        .where(and(publicActiveFilter, sql`LOWER(${destinations.name}) = LOWER(${trimmedCity})`));
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
 * - Metered via `recordAiUsage` (for cost visibility), also inside the engine.
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
 *    city was extracted and no stronger location signal is present — the city
 *    name to a destination UUID (see `resolveDestinationIdFromCity`), all in
 *    parallel (single DB queries each).
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
        const prompt = buildConversationalSearchPrompt({
            currentFilters,
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
        // AND no stronger location signal (destinationId or full geo coords) is
        // already present — mirrors the mapper's own location priority so we
        // never pay for a DB lookup whose result would be discarded anyway.
        const hasStrongerLocationSignal =
            validatedEntities.destinationId !== undefined ||
            (validatedEntities.latitude !== undefined && validatedEntities.longitude !== undefined);
        const cityToResolve =
            validatedEntities.city !== undefined && !hasStrongerLocationSignal
                ? validatedEntities.city
                : undefined;

        const [resolvedAmenityIds, resolvedFeatureIds, resolvedDestinationId] = await Promise.all([
            resolveAmenityIds(amenitySlugIds),
            resolveFeatureIds(featureSlugIds),
            cityToResolve === undefined ? undefined : resolveDestinationIdFromCity(cityToResolve)
        ]);

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
        // Step 8 (T-006): Build the reply system prompt + messages, then call
        // streamText to stream the natural-language acknowledgment.
        //
        // The reply system prompt is supplied as a caller-wins system message —
        // this OVERRIDES `DEFAULT_PROMPTS['search']` (the JSON extractor) so the
        // model outputs a friendly conversational text, not structured JSON.
        // -----------------------------------------------------------------------
        const replySystemPrompt = buildSearchReplySystemPrompt({ locale });
        const replyMessages = buildSearchReplyMessages({
            systemPrompt: replySystemPrompt,
            history,
            message,
            extractedFilters: validatedEntities
        });

        const { stream: rawStream, meta: rawMeta } = await aiService.streamText({
            feature: 'search',
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

        const stream: AsyncIterable<StreamTextChunk> = (async function* () {
            for await (const chunk of rawStream) {
                accumulatedReplyText += chunk.delta;
                yield chunk;
            }
        })();

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

                return { conversationId: resolvedConversationId };
            }
        );

        return {
            filters: { params, intent: validatedEntities, confidence: typedObject.confidence },
            stream,
            meta
        };
    }
});
