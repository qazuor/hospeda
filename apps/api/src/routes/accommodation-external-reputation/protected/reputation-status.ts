/**
 * GET /api/v1/protected/accommodations/:id/external-reputation/status
 *
 * Lightweight poll endpoint that returns the current async run state for
 * every platform linked to the given accommodation.
 *
 * SPEC-250 Phase 5 — new protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (service enforces ownership).
 *
 * Status code mapping:
 *   HTTP 200 — success; body includes platforms map + allSettled flag.
 *   HTTP 403 — actor does not own the accommodation.
 *   HTTP 404 — accommodation not found or soft-deleted.
 *
 * Usage: the owner panel polls this endpoint every ~10 s while
 * `allSettled = false`. Polling should stop when `allSettled = true`.
 *
 * IMPORTANT: This endpoint does NOT trigger any Apify calls. It is a
 * pure DB read. `run_status` is an internal coordination column that is
 * NEVER exposed via any /public route.
 */
import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import {
    AccommodationIdSchema,
    ExternalFetchStatusSchema,
    ExternalReputationRunStatusSchema
} from '@repo/schemas';
import { AccommodationExternalReputationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { getReputationAdapterCredentials } from '../../../utils/reputation-credentials';
import { createProtectedRoute } from '../../../utils/route-factory';

// ---------------------------------------------------------------------------
// Module-level instances (mirrors refresh.ts pattern)
// ---------------------------------------------------------------------------

const listingModel = new AccommodationExternalListingModel();
const reputationModel = new AccommodationExternalReputationModel();
const accommodationModel = new AccommodationModel();

const reputationService = new AccommodationExternalReputationService(
    { logger: apiLogger },
    {
        listingModel,
        reputationModel,
        accommodationModel,
        adapterCredentials: getReputationAdapterCredentials()
    }
);

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

/**
 * Per-platform status entry within the status response.
 *
 * Contains run state (internal only) and the latest data-quality fields.
 * `runStatus` drives the UI spinner: polling should continue while any
 * platform has runStatus in ('pending', 'running').
 */
const PlatformStatusEntrySchema = z.object({
    /** Current async run state — 'idle' | 'pending' | 'running'. Internal only. */
    runStatus: ExternalReputationRunStatusSchema,
    /** Outcome of the last completed fetch. */
    fetchStatus: ExternalFetchStatusSchema,
    /** Numeric rating from the platform, or null when unavailable. */
    rating: z.number().nullish(),
    /** Total review count, or null when unavailable. */
    reviewsCount: z.number().int().nullish(),
    /** ISO 8601 timestamp of the last successful aggregate fetch, or null. */
    aggregateFetchedAt: z.string().nullish()
});

/**
 * Response body schema for GET /external-reputation/status.
 *
 * `platforms` is a string-keyed map where each key is an ExternalPlatformEnum
 * value. Only platforms with at least one reputation row are included (partial).
 * We use `z.string()` as the key type to allow partial maps — `z.nativeEnum` as
 * a key in `z.record` requires all enum keys to be present in Zod 4.
 *
 * `allSettled` is true when every platform has runStatus = 'idle'. The UI
 * should stop polling when this flag is true.
 */
const ReputationStatusResponseSchema = z.object({
    platforms: z.record(z.string(), PlatformStatusEntrySchema),
    allSettled: z.boolean()
});

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/protected/accommodations/:id/external-reputation/status
 *
 * Returns per-platform async refresh status for the given accommodation.
 *
 * - Returns 200 with `{ platforms, allSettled }` on success.
 * - Returns 403 when the actor does not own the accommodation.
 * - Returns 404 when the accommodation does not exist or is soft-deleted.
 *
 * Does NOT trigger any Apify calls. Pure DB read.
 * `run_status` is internal — never exposed on any /public route.
 */
export const protectedReputationStatusRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/external-reputation/status',
    summary: 'Get external reputation refresh status',
    description:
        'Returns the current async run state for all platforms linked to the accommodation. Used by the owner panel to poll for Apify run completion. Does not trigger any Apify calls. Only accessible by the accommodation owner.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: ReputationStatusResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        const result = await reputationService.getRefreshStatus(accommodationId, actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        return result.data;
    }
});
