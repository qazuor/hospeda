import {
    PermanentGrantAnchorBodySchema,
    PermanentGrantAnchorParamsSchema,
    type PermanentGrantPreviewResponse,
    PermanentGrantPreviewResponseSchema,
    PermissionEnum,
    VerticalEnumSchema
} from '@repo/schemas';
import { previewPermanentGrantAnchor } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { buildPermanentGrantPorts } from './ports.js';
import { answerRejection } from './rejections.js';

/** Preview anchoring without writing; the act reads again when signed. */
export const adminPreviewPermanentGrantAnchorRoute = createAdminRoute({
    method: 'post',
    path: '/{permanentGrantId}/anchors/preview',
    summary: 'Preview a permanent grant anchor (ACC:2)',
    description:
        'Shows the new anchor effects without writing anything. The signed act reads the state again.',
    tags: ['Billing permanent grants', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: PermanentGrantAnchorParamsSchema.shape,
    requestBody: PermanentGrantAnchorBodySchema,
    responseSchema: PermanentGrantPreviewResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const { permanentGrantId } = PermanentGrantAnchorParamsSchema.parse(params);
        const input = PermanentGrantAnchorBodySchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await previewPermanentGrantAnchor(
                { actor, permanentGrantId, ...input },
                buildPermanentGrantPorts()
            );
            const response: PermanentGrantPreviewResponse = {
                stoppedCharges: result.stoppedCharges.map((row) => ({
                    ...row,
                    vertical: VerticalEnumSchema.parse(row.vertical)
                })),
                endingCourtesies: result.endingCourtesies.map((row) => ({
                    ...row,
                    vertical: VerticalEnumSchema.parse(row.vertical),
                    endsAt: row.endsAt.toISOString()
                })),
                closedDeferredBalances: result.closedDeferredBalances.map((row) => ({
                    ...row,
                    vertical: VerticalEnumSchema.parse(row.vertical)
                })),
                convertedAddons: result.convertedAddons.map((row) => ({ ...row }))
            };
            return response;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});
