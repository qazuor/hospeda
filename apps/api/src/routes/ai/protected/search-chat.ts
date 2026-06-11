/**
 * AI conversational-search streaming route (SPEC-212 T-004 / T-005).
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
 * ## Handler status (T-005 implemented)
 *
 * T-005 is now wired: the handler extracts the full updated filter set via
 * `generateObject` and emits a `filters` SSE event before the reply stream.
 *
 * Subsequent tasks that remain:
 *
 *   - T-006: `streamText` natural-language reply + `token` / `done` SSE events.
 *   - T-007: conversation persistence (`conversationId` in `done` event).
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
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedStreamingRoute } from '../../../utils/streaming-route-factory.js';
import { buildConversationalSearchPrompt } from './search-chat.prompt.js';
import { mapIntentToSearchParams } from './search-intent.mapper.js';

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
 * ## Handler flow (T-005)
 *
 * 1. Parse the validated body: messages, optional currentFilters, locale, conversationId.
 * 2. Derive `message` (last user turn) and `history` (all prior messages).
 * 3. Build the per-request prompt via `buildConversationalSearchPrompt`.
 * 4. Call `aiService.generateObject` with `SearchIntentOutputSchema` to extract
 *    the full updated entity set. Mirrors search-intent.ts (same Zod-cast pattern).
 * 5. Safe-parse returned entities; fall back to `{}` on failure.
 * 6. Resolve amenity and feature slugs to UUIDs in parallel (single DB queries).
 * 7. Map entities to URL-ready params via `mapIntentToSearchParams`.
 * 8. Return `{ filters: { params, intent }, stream: <empty placeholder>, meta: <placeholder> }`.
 *    The factory emits the `filters` SSE frame from the `filters` field.
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
        // TODO (T-006): Stream the natural-language reply via `streamText`.
        //
        // Steps:
        //   1. Resolve system prompt via `resolveSystemPrompt({ feature: 'search' })`.
        //   2. Build the engine messages list (system + conversation history).
        //   3. Call `aiService.streamText({ feature: 'search', messages, locale })`.
        //   4. Yield delta chunks as `token` events from the async generator below.
        //   5. After the stream drains, return `meta` so the factory emits `done`.
        //
        // The `done` frame payload is populated by T-007 with `conversationId`.
        // -----------------------------------------------------------------------

        // -----------------------------------------------------------------------
        // TODO (T-007): Persist the conversation turn and include `conversationId`
        // in the `done` event meta.
        //
        // Steps:
        //   1. After the stream drains, call `persistSearchChatTurn(...)`.
        //   2. Race persistence vs. 1500 ms timeout (non-fatal on timeout).
        //   3. Return `{ conversationId }` (or `{ conversationId: null }` on timeout)
        //      as part of the `meta` Promise so the factory serialises it in `done`.
        // -----------------------------------------------------------------------

        // Step 8: Return the filters prelude + empty reply stream + placeholder meta.
        // The factory emits `filters` before the `token` loop (T-005 prelude pattern).
        // The reply stream and done payload are T-006/T-007 placeholders.
        const emptyStream: AsyncIterable<{ readonly delta: string }> =
            (async function* (): AsyncGenerator<{ readonly delta: string }> {
                // Placeholder — T-006 replaces this with the streamText generator.
            })();

        const placeholderMeta: Promise<{ readonly conversationId: null }> = Promise.resolve({
            conversationId: null
        });

        return {
            filters: { params, intent: validatedEntities },
            stream: emptyStream,
            meta: placeholderMeta
        };
    }
});
