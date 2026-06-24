/**
 * POST /api/v1/admin/accommodations/:id/media
 * Add a photo to an accommodation gallery - Admin endpoint (SPEC-204)
 *
 * This is a URL-receiver endpoint: the caller has already uploaded the file to
 * Cloudinary via `POST /api/v1/admin/media/upload`. This endpoint registers the
 * returned URL + metadata as a new `accommodation_media` row.
 *
 * Plan cap enforcement follows the same semantics as the upload route:
 *   - Only enforces when the actor IS the owner (`actor.id === accommodation.ownerId`).
 *   - Admins with `ACCOMMODATION_UPDATE_ANY` bypass the plan limit (trusted manual
 *     intervention / support scenario).
 *   - Enforcement happens in this route handler (not in the service) because
 *     `checkLimit` requires the Hono `Context` populated by `entitlementMiddleware`.
 */

import { LimitKey } from '@repo/billing';
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
import { buildLimitReachedDetails } from '../../../middlewares/limit-enforcement';
import { getActorFromContext } from '../../../utils/actor';
import { calculateThreshold, calculateUsagePercent, checkLimit } from '../../../utils/limit-check';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/media
 * Add a photo to an accommodation gallery - Admin endpoint
 *
 * Permission model (SPEC-204): service layer `accommodationService.addMedia`
 * calls `_canUpdate(actor, accommodation)` which enforces
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership).
 * Route only requires admin-panel access so HOSTs can manage photos on their
 * own accommodations.
 *
 * Plan cap: enforced here (not in the service) because `checkLimit` needs the
 * Hono Context. Mirrors the cap logic in `apps/api/src/routes/media/admin/upload.ts`
 * §3d-i exactly. Only applies when the actor IS the owner; admin overrides bypass.
 */
export const adminAddMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media',
    summary: 'Add photo to accommodation gallery (admin)',
    description:
        'Register an already-uploaded URL as a new accommodation_media row. ' +
        'Requires admin-panel access; the service layer enforces UPDATE_ANY or ' +
        '(UPDATE_OWN + ownership). Plan photo cap is enforced for owner-actors.',
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

        // ── Plan cap enforcement (mirrors upload.ts §3d-i) ────────────────────
        // Only enforces when the actor is the owner. Admins uploading on behalf
        // of an owner bypass the plan limit — this matches `validateEntityMedia
        // Permission` where admins with ACCOMMODATION_UPDATE_ANY skip ownership.
        // `findByAccommodation({ state: 'visible' })` counts both the featured
        // row (is_featured=true, state='visible') and every active gallery row,
        // matching the prior `gallery.length + (featuredImage ? 1 : 0)` semantics.
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
    }
});
