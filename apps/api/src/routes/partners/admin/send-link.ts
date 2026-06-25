import { PermissionEnum } from '@repo/schemas';
import { PartnerService } from '@repo/service-core';
/**
 * Admin send payment link endpoint
 * Generates a QZPay payment link for a partner
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * POST /api/v1/admin/partners/{id}/send-link
 * Send payment link - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminSendPaymentLinkRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/send-link',
    summary: 'Send payment link for partner (admin)',
    description: 'Generates a QZPay payment link for a partner',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    responseSchema: z.object({
        paymentUrl: z.string().url(),
        planId: z.string()
    }),
    handler: async (ctx, params) => {
        const partnerService = new PartnerService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const result = await partnerService.sendPaymentLink(actor, id);

        return result;
    }
});
