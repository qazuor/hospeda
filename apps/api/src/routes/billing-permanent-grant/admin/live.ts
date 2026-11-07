import {
    LivePermanentGrantParamsSchema,
    type LivePermanentGrantResponse,
    LivePermanentGrantResponseSchema,
    PermissionEnum,
    VerticalEnumSchema
} from '@repo/schemas';
import { readLivePermanentGrant } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { answerRejection } from './rejections.js';

/** Read the beneficiary's live grant and anchors. */
export const adminLivePermanentGrantRoute = createAdminRoute({
    method: 'get',
    path: '/by-beneficiary/{userId}',
    summary: 'Read the live permanent grant (ACC:2)',
    description: 'Reads the live grant and anchors for a beneficiary without writing anything.',
    tags: ['Billing permanent grants', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: LivePermanentGrantParamsSchema.shape,
    responseSchema: LivePermanentGrantResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const { userId } = LivePermanentGrantParamsSchema.parse(params);
        const actor = getActorFromContext(ctx);
        try {
            const result = await readLivePermanentGrant({ actor, beneficiaryUserId: userId });
            const response: LivePermanentGrantResponse = {
                grant: result.grant && {
                    ...result.grant,
                    createdAt: result.grant.createdAt.toISOString(),
                    anchors: result.grant.anchors.map((row) => ({
                        ...row,
                        vertical: VerticalEnumSchema.parse(row.vertical)
                    }))
                }
            };
            return response;
        } catch (error) {
            return answerRejection({ error, ctx });
        }
    }
});
