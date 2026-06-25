import { PermissionEnum, partnerSchema } from '@repo/schemas';
import { PartnerService } from '@repo/service-core';
/**
 * Admin register manual payment endpoint
 * Registers a manual payment for a partner (activates without QZPay)
 */
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const partnerService = new PartnerService({ logger: apiLogger });

/**
 * POST /api/v1/admin/partners/{id}/manual-payment
 * Register manual payment - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminManualPaymentRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/manual-payment',
    summary: 'Register manual payment for partner (admin)',
    description: 'Activates a partner subscription without QZPay payment',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    requestBody: z.object({
        note: z.string().max(500).optional()
    }),
    responseSchema: partnerSchema,
    handler: async (ctx, params, body) => {
        const actor = getActorFromContext(ctx);
        const id = params.id as string;
        const { note } = body as { note?: string };

        const result = await partnerService.registerManualPayment(actor, id, note);

        return result;
    }
});
