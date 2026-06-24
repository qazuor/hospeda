/**
 * POST /api/v1/protected/accommodations/:id/media
 * Add a photo to an accommodation gallery — Protected (owner-facing) endpoint (SPEC-204)
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload` (or equivalent). This endpoint
 * registers the returned URL + metadata as a new `accommodation_media` row.
 *
 * Plan cap enforcement:
 *   - Owner-actors always have `ownerId === actor.id`, so the cap check ALWAYS applies.
 *   - Enforcement happens in this route handler (not in the service) because
 *     `checkLimit` requires the Hono `Context` populated by `entitlementMiddleware`.
 *
 * Mirrors `apps/api/src/routes/accommodation/admin/addMedia.ts` cap-block verbatim,
 * adapted for the protected (owner-actor) context.
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { accommodationMediaModel } from '@repo/db';
import {
    AccommodationIdSchema,
    type AccommodationMediaAddInput,
    type AccommodationMediaAddPayload,
    AccommodationMediaAddPayloadSchema,
    AccommodationMediaSingleOutputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { buildLimitReachedDetails } from '../../../middlewares/limit-enforcement';
import { getActorFromContext } from '../../../utils/actor';
import { calculateThreshold, calculateUsagePercent, checkLimit } from '../../../utils/limit-check';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/accommodations/:id/media
 * Add a photo to an accommodation gallery — Protected endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.addMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route requires `EDIT_ACCOMMODATION_INFO` entitlement (granted on all host plans)
 * plus an inline plan photo-count cap check.
 */
export const protectedAddMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to accommodation gallery (owner)',
    description:
        'Register an already-uploaded URL as a new accommodation_media row. ' +
        'Requires EDIT_ACCOMMODATION_INFO entitlement. Plan photo cap is enforced ' +
        'inline. The service layer enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationMediaSingleOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // ── Plan cap enforcement ──────────────────────────────────────────────
        // For protected owner-actors, `ownerId === actor.id` is always true for
        // their own accommodations, so the plan cap ALWAYS applies.
        const accommodation = await accommodationService.getById(actor, accommodationId);
        if (accommodation.error || !accommodation.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        const ownerId = (accommodation.data as { ownerId?: string | null }).ownerId;
        if (ownerId && ownerId === actor.id) {
            const { total: currentPhotoCount } = await accommodationMediaModel.findByAccommodation({
                accommodationId,
                state: 'visible'
            });

            const planLimitCheck = checkLimit({
                context: ctx,
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: currentPhotoCount
            });

            const threshold = calculateThreshold(currentPhotoCount, planLimitCheck.maxAllowed);
            const usagePercent = calculateUsagePercent(
                currentPhotoCount,
                planLimitCheck.maxAllowed
            );

            if (threshold === 'warning' || threshold === 'critical') {
                ctx.header(
                    'X-Usage-Warning',
                    `limitKey=${LimitKey.MAX_PHOTOS_PER_ACCOMMODATION};usage=${currentPhotoCount};max=${planLimitCheck.maxAllowed};threshold=${threshold}`
                );
            }

            if (!planLimitCheck.allowed) {
                apiLogger.warn(
                    `Plan photo limit reached for accommodation ${accommodationId} (owner ${actor.id}): ${planLimitCheck.currentCount}/${planLimitCheck.maxAllowed}`
                );
                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    planLimitCheck.upgradeMessage ?? 'Photo limit reached',
                    buildLimitReachedDetails({
                        limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                        currentCount: planLimitCheck.currentCount,
                        maxAllowed: planLimitCheck.maxAllowed,
                        usagePercent
                    })
                );
            }
        }

        // ── Delegate to service ───────────────────────────────────────────────
        const input: AccommodationMediaAddInput = {
            accommodationId,
            media: body as AccommodationMediaAddPayload
        };

        const result = await accommodationService.addMedia(actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        // SPEC-145 T-004 / SPEC-204: gallery mutation requires EDIT_ACCOMMODATION_INFO.
        middlewares: [requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)]
    }
});
