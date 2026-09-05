/**
 * POST /api/v1/admin/experiences/:id/media/featured
 * Register an already-uploaded URL as the experience listing's COVER — Admin endpoint
 * (HOS-803).
 *
 * The admin mirror of `routes/experience/protected/addFeaturedMedia.ts`, and the one
 * the admin panel's gallery manager actually calls — its hooks address
 * `/api/v1/admin/...`, never the protected tier.
 *
 * ## Why this exists next to `POST /:id/media`
 *
 * Setting a cover used to be two requests: register an ordinary gallery row,
 * then promote it. The first runs the gallery cap, and that cap counts the
 * gallery ALONE because a cover is not a gallery item (HOS-791) — so a listing
 * whose gallery sat at the cap was refused at step 1 and never reached step 2,
 * and the one action exempt from the quota became the only one impossible to
 * perform.
 *
 * No cap needs waiving, because none is spent: the replaced cover is DELETED
 * (soft-deleted) in the same transaction, so one row enters the featured slot
 * and one leaves the table and the visible gallery never moves. Commerce
 * listings have no per-plan photo allowance either.
 *
 * The replaced photo is NOT kept. It does not fall back into the gallery; it
 * disappears from the listing. Its stored file is deliberately left in place, so
 * the deletion is reversible at the row level, but callers must not present the
 * old cover as still available.
 *
 * Requires EXPERIENCE_EDIT_ALL (or the legacy COMMERCE_EDIT_ALL). The service helper `addExperienceFeaturedMedia` enforces the
 * same gate via `checkExperienceCanEditMedia`.
 */
import {
    type ExperienceFeaturedMediaAddInput,
    ExperienceFeaturedMediaAddOutputSchema,
    type ExperienceMediaAddPayload,
    ExperienceMediaAddPayloadSchema,
    PermissionEnum
} from '@repo/schemas';
import { addExperienceFeaturedMedia, ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Route handler — registers an uploaded photo as the listing's cover.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service
 * instance to pass to the standalone media helper without requiring a public
 * accessor. Mirrors the sibling media routes.
 */
export const adminAddExperienceFeaturedMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media/featured',
    summary: 'Upload the experience listing cover image (admin)',
    description:
        'Registers an already-uploaded URL as the experience listing cover. The row is created ' +
        'already featured and the photo it replaces is DELETED in the same transaction ' +
        '— soft-deleted, so it disappears from the listing while its stored file ' +
        'is kept. Unlike POST /:id/media this does not ' +
        'consume a gallery slot, because the cover is not a gallery item ' +
        '(HOS-791). Requires EXPERIENCE_EDIT_ALL (or the legacy COMMERCE_EDIT_ALL).',
    tags: ['Experience', 'Media'],
    anyOfPermissions: [[PermissionEnum.EXPERIENCE_EDIT_ALL, PermissionEnum.COMMERCE_EDIT_ALL]],
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
