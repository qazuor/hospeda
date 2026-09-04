/**
 * POST /api/v1/protected/gastronomies/:id/media/featured
 * Register an already-uploaded URL as the gastronomy listing's COVER (HOS-803).
 *
 * ## Why this exists next to `POST /:id/media`
 *
 * Setting a cover used to be two requests against that endpoint: register an
 * ordinary gallery row, then promote it via `PUT /:id/media/:mediaId/featured`.
 * The first runs the gallery cap, and that cap counts the gallery ALONE — a
 * cover is not a gallery item (HOS-791). So a listing whose gallery sat at the
 * cap was refused at step 1 and never reached step 2: the one action exempt
 * from the quota was the only one its owner could not perform.
 *
 * ## Why a separate route rather than a flag on the existing one
 *
 * So the different quota rules are visible in the route list instead of hidden
 * behind a request field — and so they cannot be claimed by the caller. A
 * "treat this upload as the cover" flag on the gallery endpoint would be
 * unverifiable: nothing obliges a client to send the promotion it promises, so
 * a caller setting it on every upload would have no cap at all. Here the
 * service creates the row already featured, in one transaction, and
 * `uq_gastronomy_media_single_featured` permits exactly one per listing.
 *
 * The per-entity cap is never waived. What the service spends it on is the fate
 * of the cover being replaced: demoted into the gallery while there is room,
 * archived out of it when there is not — so the visible gallery cannot grow
 * past the cap however often a cover is swapped.
 *
 * Gated on GASTRONOMY_EDIT_OWN (listing owner) or GASTRONOMY_EDIT_ALL (staff) — enforced inside `addGastronomyFeaturedMedia` via `checkGastronomyCanEditMedia`.
 */
import {
    type GastronomyFeaturedMediaAddInput,
    GastronomyFeaturedMediaAddOutputSchema,
    type GastronomyMediaAddPayload,
    GastronomyMediaAddPayloadSchema
} from '@repo/schemas';
import { addGastronomyFeaturedMedia, GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — registers an uploaded photo as the listing's cover.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service
 * instance to pass to the standalone media helper without requiring a public
 * accessor. Mirrors the sibling media routes.
 */
export const protectedAddGastronomyFeaturedMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media/featured',
    summary: 'Upload the gastronomy listing cover image',
    description:
        'Registers an already-uploaded URL as the gastronomy listing cover. The row is created ' +
        'already featured and the previous cover is disposed of in the same transaction ' +
        '— demoted into the gallery when there is room, archived when there is not. ' +
        'Unlike POST /:id/media this does not consume a gallery slot, because the cover ' +
        'is not a gallery item (HOS-791). Requires GASTRONOMY_EDIT_OWN (listing owner) or GASTRONOMY_EDIT_ALL (staff).',
    tags: ['Gastronomy', 'Gastronomy Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    // The SAME payload the gallery endpoint accepts. A cover differs in what the
    // server does with it, not in what the caller sends — which is why neither
    // `isFeatured` nor the cap is reachable from this body.
    requestBody: GastronomyMediaAddPayloadSchema,
    responseSchema: GastronomyFeaturedMediaAddOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: GastronomyFeaturedMediaAddInput = {
            gastronomyId: params.id as string,
            media: body as GastronomyMediaAddPayload
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            gastronomyService as unknown as {
                model: Parameters<typeof addGastronomyFeaturedMedia>[0];
            }
        ).model;
        const result = await addGastronomyFeaturedMedia(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
