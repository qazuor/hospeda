import {
    PartnerApplicationApproveResponseSchema,
    PartnerApplicationApproveSchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { approvePartnerApplication } from '../../../services/partner-application/partner-application-resolution.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/** POST /api/v1/admin/partner-applications/{id}/approve — approves PP2 as action 5 (ACC:5). */
export const adminApprovePartnerApplicationRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/approve',
    summary: 'Approve a Partner application (PP2, ACC:5)',
    description:
        'Approves a pending Partner application under administrative action 5 (ACC:5). Requires PARTNER_RESOLVE_APPLICATION and a reason.',
    tags: ['Partner applications', 'Admin'],
    requiredPermissions: [PermissionEnum.PARTNER_RESOLVE_APPLICATION],
    requestParams: { id: z.string().uuid() },
    requestBody: PartnerApplicationApproveSchema,
    responseSchema: PartnerApplicationApproveResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: Record<string, unknown>) =>
        approvePartnerApplication({
            actor: getActorFromContext(ctx),
            applicationId: params.id as string,
            ...PartnerApplicationApproveSchema.parse(body)
        })
});
