/**
 * POST /api/v1/protected/accommodations/:id/external-reputation/refresh
 *
 * Triggers a manual reputation refresh for all enabled platforms.
 *
 * SPEC-237 T-008 — protected owner route.
 * SPEC-250 Phase 5 — updated to return 202 when Apify runs are enqueued async.
 * Permission: ACCOMMODATION_UPDATE_OWN (service enforces ownership).
 *
 * Status code mapping:
 *   HTTP 202 — at least one platform enqueued asynchronously (enqueuedAsync.length > 0).
 *   HTTP 200 — all platforms resolved inline (no async enqueue).
 *   HTTP 429 — rate-limit window active; includes Retry-After header.
 *   HTTP 403 — actor does not own the accommodation.
 *   HTTP 404 — accommodation not found.
 */
import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import { AccommodationIdSchema, ExternalPlatformEnumSchema, ServiceErrorCode } from '@repo/schemas';
import { AccommodationExternalReputationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { getReputationAdapterCredentials } from '../../../utils/reputation-credentials';
import { createProtectedRoute } from '../../../utils/route-factory';

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

/**
 * Schema for a single inline failure entry within a refresh result.
 * Describes a platform that could not be resolved either inline or via async enqueue.
 */
const RefreshFailureEntrySchema = z.object({
    platform: ExternalPlatformEnumSchema,
    error: z.string()
});

/**
 * Shape returned by a successful refresh call (SPEC-250 Phase 5).
 *
 * - inlineSucceeded: platforms resolved synchronously; data persisted immediately.
 * - enqueuedAsync: platforms for which an Apify run was enqueued; rows have run_status='pending'.
 * - inlineFailed: platforms that failed both inline and async paths; rows have fetch_status='error'.
 */
export const RefreshResultSchema = z.object({
    inlineSucceeded: z.array(ExternalPlatformEnumSchema),
    enqueuedAsync: z.array(ExternalPlatformEnumSchema),
    inlineFailed: z.array(RefreshFailureEntrySchema)
});

/**
 * POST /api/v1/protected/accommodations/:id/external-reputation/refresh
 *
 * Triggers a manual fetch from all enabled external platforms.
 *
 * - Returns **202** when at least one platform was enqueued asynchronously.
 * - Returns **200** when all platforms resolved inline (no async enqueue).
 * - Returns 429 with a Retry-After hint when the rate-limit window is active.
 * - Returns 403 when the actor does not own the accommodation.
 * - Returns 404 when the accommodation does not exist.
 */
export const protectedRefreshReputationRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/external-reputation/refresh',
    summary: 'Refresh external reputation',
    description:
        'Triggers a manual fetch of reputation data from all enabled external platforms for the accommodation. Returns 202 when Apify runs are enqueued asynchronously, 200 when all resolved inline. Rate-limited per accommodation.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: RefreshResultSchema,
    // POST to refresh — treat as 200 (not 201) because it triggers an action,
    // not a resource creation. The 202 case is handled directly in the handler.
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        const result = await reputationService.refresh(accommodationId, actor);

        if (result.error) {
            if (result.error.code === ServiceErrorCode.QUOTA_EXCEEDED) {
                // Build a Retry-After hint from the rate-limit window when available.
                // The service stores `windowSeconds` (not `retryAfter`) in details.
                const details = result.error.details as Record<string, unknown> | undefined;
                const retryAfter =
                    details !== null &&
                    details !== undefined &&
                    typeof details.windowSeconds === 'number'
                        ? details.windowSeconds
                        : undefined;

                const serviceErr = new ServiceError(
                    ServiceErrorCode.QUOTA_EXCEEDED,
                    result.error.message,
                    retryAfter !== undefined ? { retryAfter } : details
                );

                // Return 429 directly so the Retry-After header can be set.
                const retryAfterValue = retryAfter ?? 600;
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: serviceErr.code,
                            message: serviceErr.message,
                            details: { retryAfter: retryAfterValue }
                        }
                    },
                    429,
                    { 'Retry-After': String(retryAfterValue) }
                );
            }

            throw new ServiceError(
                result.error.code as ServiceErrorCode,
                result.error.message,
                result.error.details
            );
        }

        const data = result.data;

        // HTTP 202: at least one platform was enqueued asynchronously.
        // Return the response directly because createCRUDRoute only supports 200 | 201
        // as typed status codes, and the route factory passes it to c.json() which
        // accepts any number. We bypass the factory's status selection by returning
        // a Response from the handler (the factory checks `result instanceof Response`).
        if (data.enqueuedAsync.length > 0) {
            return ctx.json(
                {
                    success: true,
                    data,
                    metadata: {
                        timestamp: new Date().toISOString(),
                        requestId: ctx.get('requestId') || 'unknown'
                    }
                },
                202
            );
        }

        // HTTP 200: all platforms resolved inline.
        return data;
    }
});
