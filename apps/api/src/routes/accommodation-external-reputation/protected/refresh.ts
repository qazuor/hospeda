/**
 * POST /api/v1/protected/accommodations/:id/external-reputation/refresh
 *
 * Triggers a manual reputation refresh for all enabled platforms.
 *
 * SPEC-237 T-008 — protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (service enforces ownership).
 *
 * Rate-limit mapping:
 *   ServiceErrorCode.QUOTA_EXCEEDED → HTTP 429
 *   The Retry-After header is set when the service returns a windowSeconds hint
 *   in `error.details.retryAfter`.
 */
import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import { AccommodationIdSchema, ServiceErrorCode } from '@repo/schemas';
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

/** Shape returned by a successful refresh call. */
const RefreshResultSchema = z.object({
    succeeded: z.array(z.string()),
    failed: z.array(
        z.object({
            platform: z.string(),
            error: z.string()
        })
    )
});

/**
 * POST /api/v1/protected/accommodations/:id/external-reputation/refresh
 *
 * Triggers a manual fetch from all enabled external platforms.
 *
 * - Returns 200 with {@link RefreshResult} on success (including partial failures).
 * - Returns 429 with a Retry-After hint when the rate-limit window is active.
 * - Returns 403 when the actor does not own the accommodation.
 * - Returns 404 when the accommodation does not exist.
 */
export const protectedRefreshReputationRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/external-reputation/refresh',
    summary: 'Refresh external reputation',
    description:
        'Triggers a manual fetch of reputation data from all enabled external platforms for the accommodation. Rate-limited per accommodation.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: RefreshResultSchema,
    // POST to refresh — treat as 200 (not 201) because it triggers an action,
    // not a resource creation.
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

        return result.data;
    }
});
