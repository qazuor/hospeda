/**
 * POST /api/v1/protected/experiences/:id/media/featured
 * Register an already-uploaded URL as the experience listing's COVER (HOS-803).
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
 * `uq_experience_media_single_featured` permits exactly one per listing.
 *
 * No cap needs waiving, because none is spent: the replaced cover is DELETED
 * (soft-deleted) in the same transaction, so one row enters the featured slot
 * and one leaves the table and the visible gallery never moves.
 *
 * The replaced photo is NOT kept. It does not fall back into the gallery; it
 * disappears from the listing. Its stored file is deliberately left in place, so
 * the deletion is reversible at the row level, but callers must not present the
 * old cover as still available.
 *
 * Gated on EXPERIENCE_EDIT_OWN (listing owner) or EXPERIENCE_EDIT_ALL (staff) — enforced inside `addExperienceFeaturedMedia` via `checkExperienceCanEditMedia`.
 */
import {
    type ExperienceFeaturedMediaAddInput,
    ExperienceFeaturedMediaAddOutputSchema,
    type ExperienceMediaAddPayload,
    ExperienceMediaAddPayloadSchema
} from '@repo/schemas';
import { addExperienceFeaturedMedia, ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createCRUDRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — registers an uploaded photo as the listing's cover.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service
 * instance to pass to the standalone media helper without requiring a public
 * accessor. Mirrors the sibling media routes.
 */
export const protectedAddExperienceFeaturedMediaRoute = createCRUDRoute({
    method: 'post',
    path: '/{id}/media/featured',
    summary: 'Upload the experience listing cover image',
    description:
        'Registers an already-uploaded URL as the experience listing cover. The row is created ' +
        'already featured and the photo it replaces is DELETED in the same transaction ' +
        '— soft-deleted, so it disappears from the listing and frees its gallery ' +
        'slot, while its stored file is kept. Unlike POST /:id/media this does not ' +
        'consume a gallery slot, because the cover is not a gallery item ' +
        '(HOS-791). Requires EXPERIENCE_EDIT_OWN (listing owner) or EXPERIENCE_EDIT_ALL (staff).',
    tags: ['Experience', 'Experience Media'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    // The SAME payload the gallery endpoint accepts. A cover differs in what the
    // server does with it, not in what the caller sends — which is why neither
    // `isFeatured` nor the cap is reachable from this body.
    requestBody: ExperienceMediaAddPayloadSchema,
    responseSchema: ExperienceFeaturedMediaAddOutputSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);

        const input: ExperienceFeaturedMediaAddInput = {
            experienceId: params.id as string,
            media: body as ExperienceMediaAddPayload
        };

        // TYPE-WORKAROUND: access protected `model` via cast to avoid `any`
        const model = (
            experienceService as unknown as {
                model: Parameters<typeof addExperienceFeaturedMedia>[0];
            }
        ).model;
        const result = await addExperienceFeaturedMedia(model, actor, input);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    }
});
