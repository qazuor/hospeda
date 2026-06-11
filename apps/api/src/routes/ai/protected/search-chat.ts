/**
 * AI conversational-search streaming route (SPEC-212 T-004).
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
 * ## Handler status (T-004 scaffold)
 *
 * The handler opens the SSE stream and immediately emits a placeholder `done`
 * event. The real conversational logic is added by subsequent tasks:
 *
 *   - T-005: `generateObject` intent extraction + `filters` SSE event emission.
 *   - T-006: `streamText` natural-language reply + `token` / `done` SSE events.
 *   - T-007: conversation persistence (`conversationId` in `done` event).
 *
 * @module apps/api/routes/ai/protected/search-chat
 */

import { type AiSearchChatRequest, AiSearchChatRequestSchema } from '@repo/schemas';
import { createAiRateLimitMiddlewares } from '../../../middlewares/ai-rate-limit.js';
import { entitlementMiddleware } from '../../../middlewares/entitlement.js';
import { apiLogger } from '../../../utils/logger.js';
import { createProtectedStreamingRoute } from '../../../utils/streaming-route-factory.js';

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

        apiLogger.debug(
            {
                messageCount: rawBody.messages.length,
                locale: rawBody.locale,
                hasCurrentFilters: rawBody.currentFilters !== undefined,
                hasConversationId: rawBody.conversationId != null
            },
            'search-chat: handler invoked (T-004 scaffold)'
        );

        // -----------------------------------------------------------------------
        // TODO (T-005): Extract full updated filter set via `generateObject`.
        //
        // Steps:
        //   1. Build the per-request prompt using `buildSearchChatPrompt(...)`.
        //   2. Call `aiService.generateObject({ feature: 'search', prompt, locale })`.
        //   3. safeParse the returned entities (fall back to {} on failure).
        //   4. Resolve amenity/feature slugs to UUIDs (single DB queries, parallel).
        //   5. Call `mapIntentToSearchParams(entities, amenityIds, featureIds)`.
        //   6. Return `{ params, intent }` to emit the `filters` SSE event.
        //
        // The `filters` event MUST be emitted BEFORE the reply stream starts so
        // the UI can render search results while the reply is streaming.
        // -----------------------------------------------------------------------

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

        // T-004 scaffold: open the SSE stream with an empty async iterable and a
        // minimal `done` frame so the route is exercisable end-to-end without
        // any real AI engine calls. T-005/T-006/T-007 will replace this body.
        const emptyStream: AsyncIterable<{ readonly delta: string }> =
            (async function* (): AsyncGenerator<{ readonly delta: string }> {
                // Placeholder — T-006 replaces this with the streamText generator.
            })();

        const placeholderMeta: Promise<{ readonly conversationId: null }> = Promise.resolve({
            conversationId: null
        });

        return {
            stream: emptyStream,
            meta: placeholderMeta
        };
    }
});
