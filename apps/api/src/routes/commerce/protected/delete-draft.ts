/**
 * Owner self-service commerce DRAFT delete endpoint (HOS-1156 T-015, AC-14).
 *
 * The publish precheck panel offers "borrar el borrador" as the FREE way past a
 * full plan, next to the paid ones. For accommodation that button has always
 * worked, because `DELETE /protected/accommodations/{id}` accepts the owner.
 * The two commerce verticals had no owner-facing delete at all — their only
 * delete is `_canSoftDelete` → `COMMERCE_DELETE`, a staff permission — so on a
 * commerce publish page the same button could only ever answer 403, and the
 * matrix's cheapest branch would have been the one that does not work.
 *
 * ## One route over both verticals, unlike the create pair beside it
 *
 * `create.ts` is deliberately two routes, because the two owner-create payloads
 * have genuinely different required shapes and OpenAPI needs one concrete schema
 * per route. A delete has no payload: the vertical only selects which service
 * answers. So this follows the precheck's shape (HOS-1156 D-7) rather than its
 * neighbour's, and the vertical is a path param validated against a closed enum.
 *
 * ## What it refuses, and with which status
 *
 * The service (`softDeleteOwnDraft`) holds the rules and this route only maps
 * them: a row that does not exist, belongs to somebody else, or is already
 * deleted all answer **404** — never 403, which would confirm the id exists
 * (`apps/api/docs/error-contract.md`). A row in any lifecycle state other than
 * DRAFT answers 422: a published listing is not a draft to discard.
 *
 * @module routes/commerce/protected/delete-draft
 */

import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { deleteOwnCommerceDraft } from '../../../services/publish-draft-delete.service';
import { getActorFromContext } from '../../../utils/actor';
import { createProtectedRoute } from '../../../utils/route-factory';

/**
 * The two commerce verticals, as the URL segment spells them.
 *
 * Accommodation is absent on purpose: it already has an owner delete of its own,
 * and routing it through here would move a flow that is live in production
 * (BETA-197) onto a new endpoint for no gain (HOS-1156 R-2).
 */
const CommerceVerticalParamSchema = z.enum(['gastronomy', 'experience']);

const DeleteDraftResponseSchema = z.object({
    deleted: z.literal(true)
});

/**
 * DELETE /api/v1/protected/commerce/listings/{vertical}/{id}
 */
export const protectedDeleteCommerceDraftRoute = createProtectedRoute({
    method: 'delete',
    path: '/listings/{vertical}/{id}',
    summary: 'Delete one of my DRAFT commerce listings',
    description:
        "Soft-deletes a DRAFT gastronomy or experience listing owned by the caller, freeing a slot under their plan's cap. Ownership is the gate: no commerce permission is required, and a listing the caller does not own answers 404. A listing in any lifecycle state other than DRAFT is refused.",
    tags: ['Commerce'],
    // No `requiredPermissions` on purpose, same posture as the owner-create
    // routes beside it (HOS-687): `COMMERCE_OWNER` is granted BY creating a
    // listing, so gating the owner's own draft behind a commerce permission
    // would lock out exactly the accounts this flow exists for. Authentication
    // is still enforced by the factory, and ownership is checked in the service.
    requestParams: {
        vertical: CommerceVerticalParamSchema,
        id: z.string().uuid()
    },
    responseSchema: DeleteDraftResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        // Re-parsed rather than cast: the factory hands params down as
        // `unknown`, and the value this narrows picks which service answers.
        const vertical = CommerceVerticalParamSchema.parse(params.vertical);
        const id = z.string().uuid().parse(params.id);

        const result = await deleteOwnCommerceDraft({ actor, vertical, id });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { deleted: true as const };
    }
});
