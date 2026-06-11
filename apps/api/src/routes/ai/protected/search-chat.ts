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
 *
 * `entitlementMiddleware()` runs first so billing context is populated for
 * any downstream middleware or handler that may inspect it. The `ai_search`
 * governance model (SPEC-211 §7.7) is identical to the sibling search-intent
 * route: this is a **platform feature**, not a per-plan billing entitlement.
 * `createAiQuotaMiddleware('search')` is intentionally absent — gating is done
 * solely by auth + rate-limit. The USD cost ceiling and metering are enforced
 * inside the AI engine via `createConfiguredAiService()`.
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
import { amenities, features, getDb, inArray } from '@repo/db';
import {
    type AiSearchChatFiltersEvent,
    type AiSearchChatRequest,
    AiSearchChatRequestSchema,
    type SearchIntentEntities,
    SearchIntentEntitiesSchema,
    type SearchIntentOutput,
    SearchIntentOutputSchema
} from '@repo/schemas';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit.js';
import { entitlementMiddleware } from '../../../middlewares/entitlement.js';
import { createConfiguredAiService } from '../../../services/ai-service.factory.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import {
    type StreamTextChunk,
    createProtectedStreamingRoute
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

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * Protected SSE route: `POST /api/v1/protected/ai/search-chat`.
 *
 * Turns a multi-turn natural-language accommodation search conversation into
 * structured filter parameters (via `generateObject`) and streams a
 * natural-language reply (via `streamText`).
 *
 * ## Governance model (SPEC-211 Phase 3 — §7.7)
 *
 * `ai_search` is a **platform feature**, not a per-plan billing entitlement.
 * The route is:
 *
 * - Authenticated-only (handled by `createProtectedStreamingRoute`'s
 *   `protectedAuthMiddleware`).
 * - Rate-limited by `createAiRateLimitMiddlewares('search')` (per-user + per-IP
 *   burst guard). Same rate-limit configuration as the sibling search-intent
 *   route (SPEC-199) — they share the `search` feature key.
 * - Cost-backstopped by the `ai_settings` per-feature USD ceiling enforced
 *   inside `createConfiguredAiService()` — NOT as a middleware.
 * - Metered via `recordAiUsage` (for cost visibility), also inside the engine.
 *
 * `createAiQuotaMiddleware('search')` is intentionally absent (SPEC-211 §7.7).
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
 * 6. Resolve amenity and feature slugs to UUIDs in parallel (single DB queries).
 * 7. Map entities to URL-ready params via `mapIntentToSearchParams`.
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
        'Platform-governed: requires authentication and is subject to per-user/IP rate limits ' +
        'and a USD cost ceiling. Not gated by a billing entitlement or per-plan monthly quota (SPEC-211 §7.7).',
    tags: ['AI Search'],
    requestSchema: AiSearchChatRequestSchema,
    options: {
        middlewares: [
            // Layer 0: load billing context into Hono context vars (entitlements, limits,
            // billingLoadFailed). Does NOT gate AI_SEARCH — search is platform-governed.
            // Runs first so downstream middleware / handler always has a populated context.
            entitlementMiddleware(),
            // Layer 1: burst control (perUser + perIP sliding-window rate limits).
            // These are the only access guards for this platform feature.
            // Uses the same 'search' feature key as the sibling search-intent route (SPEC-199).
            ...createAiRateLimitMiddlewares('search')
            // NOTE: createAiQuotaMiddleware('search') is intentionally omitted.
            // ai_search is a free platform feature (SPEC-211 Phase 3 §7.7). The USD
            // cost ceiling and metering are enforced inside the AI engine, not here.
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

        // Step 6: Resolve amenity and feature slugs to DB UUIDs in parallel.
        const amenitySlugIds = validatedEntities.amenitySlugs ?? [];
        const featureSlugIds = validatedEntities.featureSlugs ?? [];

        const [resolvedAmenityIds, resolvedFeatureIds] = await Promise.all([
            resolveAmenityIds(amenitySlugIds),
            resolveFeatureIds(featureSlugIds)
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
            resolvedFeatureIds
        );
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
            filters: { params, intent: validatedEntities },
            stream,
            meta
        };
    }
});
