/**
 * Admin create partner endpoint
 * Creates a new partner
 */

import type { AdminCreatePartner } from '@repo/schemas';
import { adminCreatePartnerSchema, PermissionEnum, partnerSchema } from '@repo/schemas';
import { createPartnerDirectly } from '../../../services/partner-application/partner-direct-create.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/**
 * POST /api/v1/admin/partners
 * Create partner - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminCreatePartnerRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create partner (admin)',
    description:
        'Creates a new partner without an owner and sends a claim notice to the provided email.',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestBody: adminCreatePartnerSchema,
    responseSchema: partnerSchema,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        return createPartnerDirectly({ actor, input: body as AdminCreatePartner });
    }
});
