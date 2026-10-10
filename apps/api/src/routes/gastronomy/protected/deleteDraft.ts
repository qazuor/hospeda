/**
 * Owner self-service gastronomy DRAFT delete endpoint (HOS-1156 T-015, AC-14).
 *
 *   DELETE /api/v1/protected/gastronomies/{id}
 *
 * The publish precheck panel offers "borrar el borrador" as the FREE way past a
 * full plan. For accommodation that button works because
 * `DELETE /protected/accommodations/{id}` accepts the owner. Gastronomy had no
 * owner-facing delete — its only delete is `_canSoftDelete` → the vertical's
 * DELETE permission, a staff permission — so the same button could only ever
 * answer 403. This route is the owner's own door, following the accommodation
 * pattern (`DELETE /{id}`).
 *
 * ## What it refuses, and with which status
 *
 * The service (`softDeleteOwnDraft`) holds the rules and this route only maps
 * them: a row that does not exist, belongs to somebody else, or is already
 * deleted all answer **404** — never 403, which would confirm the id exists
 * (`apps/api/docs/error-contract.md`). A row in any lifecycle state other than
 * DRAFT answers 422: a published listing is not a draft to discard.
 *
 * @module routes/gastronomy/protected/deleteDraft
 */

import { VerticalEnum } from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

const DeleteDraftResponseSchema = z.object({
    deleted: z.literal(true)
});

/**
 * DELETE /api/v1/protected/gastronomies/{id}
 */
export const protectedDeleteGastronomyDraftRoute = createProtectedRoute({
    method: 'delete',
    path: '/{id}',
    listingAccess: { vertical: VerticalEnum.GASTRONOMY, operation: 'DELETE', idParam: 'id' },
    summary: 'Delete one of my DRAFT gastronomy listings',
    description:
        'Soft-deletes a DRAFT gastronomy listing owned by the caller. Ownership is the gate: no gastronomy permission is required, and a listing the caller does not own answers 404. A listing in any lifecycle state other than DRAFT is refused.',
    tags: ['Gastronomy'],
    // No `requiredPermissions` on purpose, same posture as the owner create
    // route (HOS-687): the owner role is granted BY creating a listing, so
    // gating the owner's own draft behind a permission would lock out exactly
    // the accounts this flow exists for. Authentication is still enforced by
    // the factory, and ownership is checked in the service.
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: DeleteDraftResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = z.string().uuid().parse(params.id);

        const result = await gastronomyService.softDeleteOwnDraft(actor, id);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { deleted: true as const };
    }
});
