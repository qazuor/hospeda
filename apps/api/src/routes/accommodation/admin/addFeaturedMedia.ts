/**
 * POST /api/v1/admin/accommodations/:id/media/featured
 * Register an already-uploaded URL as the accommodation's COVER — Admin
 * endpoint (HOS-803).
 *
 * The admin mirror of `routes/accommodation/protected/addFeaturedMedia.ts`, and
 * the one the admin panel's gallery manager actually calls — its hooks address
 * `/api/v1/admin/...`, never the protected tier.
 *
 * ## Why this exists next to `POST /:id/media`
 *
 * Setting a cover used to be two requests: register an ordinary gallery row,
 * then promote it. The first runs the plan photo cap, which counts the gallery
 * ALONE because a cover is not a gallery item (HOS-791) — so an owner whose
 * gallery sat at their plan limit was refused at step 1 and never reached step
 * 2, and the one action exempt from the quota became the only one they could
 * not perform.
 *
 * ## Plan cap semantics — identical to the sibling add-media route
 *
 * The plan allowance is resolved ONLY when the actor is the owner. Staff acting
 * on someone else's listing bypass it, exactly as `addMedia` and
 * `media/admin/upload.ts` do: an admin intervening on a host's behalf is a
 * support action, not a consumption of that host's plan.
 *
 * Unlike `addMedia` this route never answers `LIMIT_REACHED` for a full
 * gallery — that refusal is the bug. The allowance is spent instead on deciding
 * the fate of the cover being replaced: demoted into the gallery while there is
 * room, archived out of it when there is not, so the visible gallery cannot
 * grow past the allowance however often a cover is swapped.
 *
 * The cap is read from the entitlement context and never from the request body:
 * a caller able to state its own allowance would have none.
 */

import { LimitKey } from '@repo/billing';
import {
    AccommodationFeaturedMediaAddOutputSchema,
    AccommodationIdSchema,
    type AccommodationMediaAddPayload,
    AccommodationMediaAddPayloadSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getRemainingLimit } from '../../../middlewares/entitlement';
import type { AppBindings } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/admin/accommodations/:id/media/featured
 * Upload straight to cover — Admin endpoint.
 *
 * Permission model: the service layer `accommodationService.addFeaturedMedia`
 * calls `_canUpdate(actor, accommodation)`, enforcing
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership). The
 * route only requires admin-panel access, so HOSTs can manage the cover of
 * their own accommodations here — which is why the owner check below is a real
 * branch and not dead code.
 */
export const adminAddFeaturedMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media/featured',
    summary: 'Upload the accommodation cover image (admin)',
    description:
        'Register an already-uploaded URL as the accommodation cover. The row is ' +
        'created already featured and the previous cover is disposed of in the same ' +
        'transaction — demoted into the gallery when there is room, archived when ' +
        'there is not. Unlike POST /:id/media this does not consume a plan photo ' +
        'slot, because the cover is not a gallery item (HOS-791). Requires ' +
        'admin-panel access; the service enforces UPDATE_ANY or (UPDATE_OWN + ownership).',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    // The SAME payload the gallery endpoint accepts. A cover differs in what the
    // server does with it, not in what the caller sends — which is why neither
    // `isFeatured` nor the cap is reachable from this body.
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationFeaturedMediaAddOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // Owner-only, mirroring addMedia: staff acting on someone else's listing
        // are not spending that host's plan. `undefined` means "no plan cap",
        // leaving only the per-entity cap the service applies itself.
        const accommodation = await accommodationService.getById(actor, accommodationId);
        if (accommodation.error || !accommodation.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Accommodation not found');
        }

        const ownerId = (accommodation.data as { ownerId?: string | null }).ownerId;
        const planGalleryCap =
            ownerId && ownerId === actor.id
                ? getRemainingLimit(
                      ctx as Context<AppBindings>,
                      LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
                  )
                : undefined;

        const result = await accommodationService.addFeaturedMedia(actor, {
            accommodationId,
            media: body as AccommodationMediaAddPayload,
            planGalleryCap
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to register the cover image'
            );
        }

        return result.data;
    }
});
