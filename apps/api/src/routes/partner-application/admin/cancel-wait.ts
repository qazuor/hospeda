import {
    PartnerApplicationCancelWaitResponseSchema,
    PartnerApplicationCancelWaitSchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { cancelPartnerApplicationWait } from '../../../services/partner-application/partner-application-wait.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/** POST /api/v1/admin/partner-applications/{id}/cancel-wait — cancels an active rejection wait (ACC:5). */
export const adminCancelPartnerApplicationWaitRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/cancel-wait',
    summary: 'Cancel a rejected Partner application wait (ACC:5)',
    description:
        'Cancels the active wait after a Partner application rejection under administrative action 5 (ACC:5). Requires PARTNER_RESOLVE_APPLICATION and a reason.',
    tags: ['Partner applications', 'Admin'],
    requiredPermissions: [PermissionEnum.PARTNER_RESOLVE_APPLICATION],
    requestParams: { id: z.string().uuid() },
    requestBody: PartnerApplicationCancelWaitSchema,
    responseSchema: PartnerApplicationCancelWaitResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        cancelPartnerApplicationWait({
            actor: getActorFromContext(ctx),
            applicationId: params.id as string,
            reason: PartnerApplicationCancelWaitSchema.parse(body).reason
        })
});
