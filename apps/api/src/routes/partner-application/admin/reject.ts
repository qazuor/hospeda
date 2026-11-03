import {
    PartnerApplicationRejectResponseSchema,
    PartnerApplicationRejectSchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { rejectPartnerApplication } from '../../../services/partner-application/partner-application-resolution.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/** POST /api/v1/admin/partner-applications/{id}/reject — rejects PP3 as action 5 (ACC:5). */
export const adminRejectPartnerApplicationRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/reject',
    summary: 'Reject a Partner application (PP3, ACC:5)',
    description:
        'Rejects a pending Partner application under administrative action 5 (ACC:5). Requires PARTNER_RESOLVE_APPLICATION and a reason.',
    tags: ['Partner applications', 'Admin'],
    requiredPermissions: [PermissionEnum.PARTNER_RESOLVE_APPLICATION],
    requestParams: { id: z.string().uuid() },
    requestBody: PartnerApplicationRejectSchema,
    responseSchema: PartnerApplicationRejectResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        rejectPartnerApplication({
            actor: getActorFromContext(ctx),
            applicationId: params.id as string,
            ...PartnerApplicationRejectSchema.parse(body)
        })
});
