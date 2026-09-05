/**
 * POST /api/v1/protected/accommodations/:id/media/featured
 * Register an already-uploaded URL as the accommodation's COVER — Protected
 * (owner-facing) endpoint (HOS-803).
 *
 * ## Why this exists next to `POST /:id/media`
 *
 * Setting a cover used to be two requests against that endpoint: register an
 * ordinary gallery row, then promote it via
 * `PUT /:id/media/:mediaId/featured`. The first of the two runs the plan photo
 * cap, and since HOS-791 that cap counts the gallery ALONE — a cover is not a
 * gallery item and does not consume a plan photo slot. The result was backwards:
 * an owner whose gallery sat exactly at their plan limit was refused at step 1
 * and never reached step 2, so the single action HOS-791 declared free of
 * gallery quota became the only one they could not perform.
 *
 * ## Why a separate route rather than a flag on the existing one
 *
 * So that the different quota rules are visible in the route list rather than
 * hidden behind a request field — and, more importantly, so they cannot be
 * claimed by the caller. A "treat this upload as the cover" flag on `addMedia`
 * would be unverifiable: nothing obliges a client to send the promotion that
 * flag promises, so a caller that set it on every upload would have no gallery
 * cap at all. Here the service creates the row already featured, in one
 * transaction, and `uq_accommodation_media_single_featured` permits exactly one
 * such row per accommodation.
 *
 * ## What this route does and does not waive
 *
 * It does NOT return `LIMIT_REACHED` for a full gallery — that refusal is the
 * bug. The swap cannot move the gallery at all: the replaced cover is DELETED
 * (soft-deleted) in the same transaction, so one row enters the featured slot
 * and one leaves the table. The plan allowance is still resolved, for one thing
 * only — a plan of zero photos grants no cover either.
 *
 * The replaced photo is NOT kept. It does not fall back into the gallery; it
 * disappears from the listing. Its stored file is deliberately left in place, so
 * the deletion is reversible at the row level, but callers must not present the
 * old cover as still available.
 *
 * The plan cap is read from the entitlement context here and NOWHERE else. It
 * is never accepted from the request body: a client able to state its own cap
 * would reopen the exact evasion this design closes.
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import {
    AccommodationFeaturedMediaAddOutputSchema,
    AccommodationIdSchema,
    type AccommodationMediaAddPayload,
    AccommodationMediaAddPayloadSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getRemainingLimit, requireEntitlement } from '../../../middlewares/entitlement';
import type { AppBindings } from '../../../types';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/accommodations/:id/media/featured
 * Upload straight to cover — Protected endpoint.
 *
 * Permission model: the service layer `accommodationService.addFeaturedMedia`
 * calls `_canUpdate(actor, accommodation)`, enforcing
 * `ACCOMMODATION_UPDATE_ANY` OR (`ACCOMMODATION_UPDATE_OWN` + ownership) — the
 * same gate `addMedia` uses. A non-owner therefore gets the same answer here as
 * anywhere else in the media family, and never a different one that would
 * confirm the accommodation exists.
 *
 * Route requires the `EDIT_ACCOMMODATION_INFO` entitlement, matching every other
 * gallery mutation.
 */
export const protectedAddFeaturedMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media/featured',
    summary: 'Upload the accommodation cover image (owner)',
    description:
        'Register an already-uploaded URL as the accommodation cover. The row is ' +
        'created already featured and the photo it replaces is DELETED in the same ' +
        'transaction — soft-deleted, so it disappears from the listing while its ' +
        'stored file is kept. Unlike POST /:id/media this ' +
        'does not consume a plan photo slot, because the cover is not a gallery ' +
        'item (HOS-791). Requires ' +
        'EDIT_ACCOMMODATION_INFO; the service layer enforces UPDATE_OWN + ownership.',
    tags: ['Accommodations', 'Media'],
    requestParams: {
        id: AccommodationIdSchema
    },
    // The SAME payload the gallery endpoint accepts. A cover differs in what the
    // server does with it, not in what the caller sends — which is precisely why
    // neither `isFeatured` nor any cap is reachable from this body.
    requestBody: AccommodationMediaAddPayloadSchema,
    responseSchema: AccommodationFeaturedMediaAddOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        // Resolved server-side, from the entitlement context the middleware
        // populated. `-1` is the entitlement layer's spelling of "unlimited",
        // which the service treats as "entity cap only".
        const planGalleryCap = getRemainingLimit(
            ctx as Context<AppBindings>,
            LimitKey.MAX_PHOTOS_PER_ACCOMMODATION
        );

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
    },
    options: {
        // Gallery mutation gate, same as every sibling media route.
        middlewares: [requireEntitlement(EntitlementKey.EDIT_ACCOMMODATION_INFO)]
    }
});
