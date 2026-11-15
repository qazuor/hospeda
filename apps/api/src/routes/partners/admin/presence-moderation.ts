import {
    PartnerPresenceModerationResponseSchema,
    PartnerPresenceModerationSchema,
    PermissionEnum
} from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { moderatePartnerPresence } from '../../../services/partner-presence/partner-presence-moderation.service';
import { getActorFromContext } from '../../../utils/actor';
import { createAdminRoute } from '../../../utils/route-factory';

/** POST /api/v1/admin/partners/{id}/presence-moderation — ACC:12 (sources: action 13), AC:V7:14; V7 §1.6. */
export const adminModeratePartnerPresenceRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/presence-moderation',
    summary: 'Moderate partner presence',
    description:
        'Moderates or lifts the moderation of a partner presence under administrative action 12 (ACC:12, action 13 in the sources). Requires LISTING_MODERATE and a reason. Never touches billing.',
    tags: ['Partners', 'Admin'],
    requiredPermissions: [PermissionEnum.LISTING_MODERATE],
    requestParams: { id: z.string().uuid() },
    requestBody: PartnerPresenceModerationSchema,
    responseSchema: PartnerPresenceModerationResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>, body: unknown) => {
        const request = PartnerPresenceModerationSchema.parse(body);
        return moderatePartnerPresence({
            actor: getActorFromContext(ctx),
            partnerId: params.id as string,
            action: request.action,
            reason: request.reason
        });
    }
});
