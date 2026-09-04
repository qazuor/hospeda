/**
 * POST /api/v1/admin/gastronomies/:id/media/featured
 * Register an already-uploaded URL as the gastronomy listing's COVER — Admin endpoint
 * (HOS-803).
 *
 * The admin mirror of `routes/gastronomy/protected/addFeaturedMedia.ts`, and the one
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
 * The per-entity cap is never waived. What the service spends it on is the fate
 * of the cover being replaced: demoted into the gallery while there is room,
 * archived out of it when there is not — so the visible gallery cannot grow past
 * the cap however often a cover is swapped. Commerce listings have no per-plan
 * photo allowance, so there is no second cap to resolve here.
 *
 * Requires GASTRONOMY_EDIT_ALL (or the legacy COMMERCE_EDIT_ALL). The service helper `addGastronomyFeaturedMedia` enforces the
 * same gate via `checkGastronomyCanEditMedia`.
 */
import {
    type GastronomyFeaturedMediaAddInput,
    GastronomyFeaturedMediaAddOutputSchema,
    type GastronomyMediaAddPayload,
    GastronomyMediaAddPayloadSchema,
    PermissionEnum
} from '@repo/schemas';
import { addGastronomyFeaturedMedia, GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * Route handler — registers an uploaded photo as the listing's cover.
 *
 * TYPE-WORKAROUND: accesses the internal `model` field from the service
 * instance to pass to the standalone media helper without requiring a public
 * accessor. Mirrors the sibling media routes.
 */
export const adminAddGastronomyFeaturedMediaRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/media/featured',
    summary: 'Upload the gastronomy listing cover image (admin)',
    description:
        'Registers an already-uploaded URL as the gastronomy listing cover. The row is created ' +
        'already featured and the previous cover is disposed of in the same transaction ' +
        '— demoted into the gallery when there is room, archived when there is not. ' +
        'Unlike POST /:id/media this does not consume a gallery slot, because the cover ' +
        'is not a gallery item (HOS-791). Requires GASTRONOMY_EDIT_ALL (or the legacy COMMERCE_EDIT_ALL).',
    tags: ['Gastronomy', 'Media'],
    anyOfPermissions: [[PermissionEnum.GASTRONOMY_EDIT_ALL, PermissionEnum.COMMERCE_EDIT_ALL]],
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
