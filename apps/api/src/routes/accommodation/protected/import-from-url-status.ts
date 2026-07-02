/**
 * Accommodation import async status polling route (HOS-50 / SPEC-277 R3 T-011).
 *
 * `GET /api/v1/protected/accommodations/import-from-url/status`
 *
 * Modeled on `reputation-status.ts` (SPEC-250 Phase 5): a lightweight poll
 * endpoint the client calls repeatedly while an async Apify run (started by
 * the `202` branch of `POST .../import-from-url`, T-010) is in flight.
 * Stateless — every identifier the resolver needs (`runId`, `datasetId`,
 * `source`, `startedAt`, `url`) is echoed back by the client on each poll,
 * exactly as returned by the initial `202` response.
 *
 * ## Poll ceiling
 *
 * Once `now - startedAt` exceeds the configured `HOSPEDA_IMPORT_APIFY_TIMEOUT_MS`,
 * the handler stops calling Apify entirely and returns
 * `{ settled: true, failureCode: 'timeout' }` directly — a stalled run should
 * not be polled forever.
 *
 * ## Known simplification (AI Strategy B not available on this path)
 *
 * The R2 Generic-adapter fallback triggered by `resolveImportRunStatus`
 * (T-006) on a blocked/errored terminal run does NOT receive an `aiExtract`
 * port here, unlike the synchronous `POST .../import-from-url` route. AI-assisted
 * (Strategy B) extraction is therefore unavailable on this fallback branch.
 * This is a deliberate T-011 scope cut — wiring the AI entitlement/quota gate
 * into a GET polling route was out of scope for the initial async path; the
 * fallback still runs its free structured (JSON-LD/OpenGraph) extraction.
 *
 * @module apps/api/routes/accommodation/protected/import-from-url-status
 */

import {
    type AccommodationImportStatusQuery,
    AccommodationImportStatusQuerySchema,
    type AccommodationImportStatusResponse,
    AccommodationImportStatusResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    AmenityService,
    type AsyncExtractionSource,
    DestinationService,
    type ImportContext,
    ServiceError,
    finalizeImportDraft,
    resolveImportRunStatus
} from '@repo/service-core';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// Module-level instances (mirrors reputation-status.ts / import-from-url.ts)
// ---------------------------------------------------------------------------

const amenityService = new AmenityService({ logger: apiLogger });
const destinationService = new DestinationService({ logger: apiLogger });

// ---------------------------------------------------------------------------
// Core poll logic (extracted for direct unit testing — same pattern as
// buildImportAiExtract in import-from-url.ts)
// ---------------------------------------------------------------------------

/**
 * Dependencies required by {@link handleImportStatusPoll}.
 */
export interface HandleImportStatusPollDeps {
    /** Import context (locale, limits, Apify credentials) built from env. */
    readonly context: ImportContext;
    /** The authenticated actor, forwarded to `finalizeImportDraft`. */
    readonly actor: Actor;
    /** Composed AmenityService instance. */
    readonly amenityService: AmenityService;
    /** Composed DestinationService instance. */
    readonly destinationService: DestinationService;
    /**
     * Current time in epoch milliseconds, used to evaluate the poll ceiling.
     * Defaults to `Date.now()` — overridable for deterministic tests.
     */
    readonly now?: number;
}

/**
 * Resolves a single status poll into the response the client expects.
 *
 * 1. Rejects any `source` other than `airbnb`/`booking` — the only sources
 *    that ever receive an async run handle (validation error, never reached
 *    by a well-behaved client since the `202` response only carries those
 *    two sources).
 * 2. Poll ceiling: if `now - startedAt` exceeds `context.apifyTimeoutMs`,
 *    returns `{ settled: true, failureCode: 'timeout' }` WITHOUT calling
 *    Apify — a stalled run should not be polled forever.
 * 3. Credential guard: if the Apify token is absent (config drift since the
 *    run was started), returns `{ settled: true, failureCode: 'credentials_missing' }`
 *    without calling Apify.
 * 4. Otherwise calls `resolveImportRunStatus` (T-005/T-006):
 *    - `{ settled: false }` → returned as-is.
 *    - `{ settled: true, raw }` → `raw` is passed through `finalizeImportDraft`
 *      (T-009) and the result is wrapped as `{ settled: true, draft }`.
 *    - `{ settled: true, failureCode }` → returned as-is.
 *
 * @param query - The validated status-poll query params.
 * @param deps - Context, actor, and composed catalogue services.
 * @returns The status response to send back to the client.
 */
export async function handleImportStatusPoll(
    query: AccommodationImportStatusQuery,
    deps: HandleImportStatusPollDeps
): Promise<AccommodationImportStatusResponse> {
    const { context, actor, amenityService, destinationService, now = Date.now() } = deps;

    if (query.source !== 'airbnb' && query.source !== 'booking') {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `Async status polling is not supported for source "${query.source}".`
        );
    }
    const source: AsyncExtractionSource = query.source;

    const startedAtMs = new Date(query.startedAt).getTime();
    const elapsedMs = now - startedAtMs;
    const ceilingMs = context.apifyTimeoutMs ?? context.timeoutMs;
    if (elapsedMs > ceilingMs) {
        return { settled: true, failureCode: 'timeout' };
    }

    const token = context.credentials.apifyToken;
    if (!token) {
        return { settled: true, failureCode: 'credentials_missing' };
    }

    const result = await resolveImportRunStatus({
        token,
        runId: query.runId,
        datasetId: query.datasetId,
        source,
        url: query.url,
        context
    });

    if (!result.settled) {
        return { settled: false };
    }

    if ('raw' in result) {
        const draft = await finalizeImportDraft(result.raw, {
            source,
            actor,
            amenityService,
            destinationService
        });
        return { settled: true, draft };
    }

    return { settled: true, failureCode: result.failureCode };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * Protected route: `GET /api/v1/protected/accommodations/import-from-url/status`.
 *
 * Query params match the initial `202` start response verbatim (`runId`,
 * `datasetId`, `source`, `startedAt`, `url`) — the client echoes them on
 * every poll since the pipeline persists nothing server-side.
 */
export const protectedImportFromUrlStatusRoute = createProtectedRoute({
    method: 'get',
    path: '/import-from-url/status',
    summary: 'Poll the status of an async accommodation import run',
    description:
        'Polls the current state of an in-flight async Apify run started by the 202 branch of ' +
        'POST .../import-from-url. Stateless — the client echoes back the runId/datasetId/source/' +
        'startedAt/url it received on the 202 response. Returns settled:false while the run is ' +
        'still going, or settled:true with either a draft (success) or a failureCode.',
    tags: ['Accommodations'],
    requestQuery: AccommodationImportStatusQuerySchema.shape,
    responseSchema: AccommodationImportStatusResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, _params: Record<string, unknown>, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as AccommodationImportStatusQuery;

        const context: ImportContext = {
            timeoutMs: env.HOSPEDA_IMPORT_FETCH_TIMEOUT_MS,
            apifyTimeoutMs: env.HOSPEDA_IMPORT_APIFY_TIMEOUT_MS,
            maxBytes: env.HOSPEDA_IMPORT_FETCH_MAX_BYTES,
            aiMaxChars: env.HOSPEDA_IMPORT_AI_MAX_CHARS,
            credentials: {
                apifyToken: env.HOSPEDA_APIFY_TOKEN,
                apifyAirbnbActor: env.HOSPEDA_APIFY_AIRBNB_ACTOR,
                apifyBookingActor: env.HOSPEDA_APIFY_BOOKING_ACTOR,
                googlePlacesApiKey: env.HOSPEDA_GOOGLE_PLACES_API_KEY,
                mercadoLibreToken: env.HOSPEDA_MERCADOLIBRE_TOKEN
            }
        };

        return handleImportStatusPoll(q, {
            context,
            actor,
            amenityService,
            destinationService
        });
    }
});
