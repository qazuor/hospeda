import {
    PermanentGrantCreateRequestSchema,
    type PermanentGrantPreviewResponse,
    PermanentGrantPreviewResponseSchema,
    PermissionEnum,
    VerticalEnumSchema
} from '@repo/schemas';
import { previewPermanentGrant } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { buildPermanentGrantPorts } from './ports.js';
import { answerRejection } from './rejections.js';

/** Preview the grant act without writing; the act reads again when signed. */
export const adminPreviewPermanentGrantRoute = createAdminRoute({
    method: 'post',
    path: '/preview',
    summary: 'Preview a permanent grant (ACC:2)',
    description:
        'Shows the grant effects without writing anything. The signed act reads the state again.',
    tags: ['Billing permanent grants', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestBody: PermanentGrantCreateRequestSchema,
    responseSchema: PermanentGrantPreviewResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = PermanentGrantCreateRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await previewPermanentGrant(
                { actor, ...input },
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
