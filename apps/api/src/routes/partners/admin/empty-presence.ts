import {
    PartnerEmptyPresenceParamsSchema,
    PartnerEmptyPresenceRequestSchema,
    PartnerEmptyPresenceResponseSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getMediaProvider } from '../../../services/media';
import { emptyPartnerPresence } from '../../../services/partner-presence/partner-presence-emptying.service';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { env } from '../../../utils/env';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';

const REJECTIONS = {
    NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    PRESENCE_ALREADY_EMPTY: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS },
    PRESENCE_STATE_CHANGED: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS },
    MEDIA_PROVIDER_UNAVAILABLE: { status: 503, code: ServiceErrorCode.SERVICE_UNAVAILABLE },
    REMOTE_DELETE_FAILED: { status: 503, code: ServiceErrorCode.SERVICE_UNAVAILABLE }
} as const;

/** POST /api/v1/admin/partners/{id}/empty-presence — confirmed ACC:25 (AC:V8b:6). */
export const adminEmptyPartnerPresenceRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/empty-presence',
    summary: 'Empty Partner presence',
    description: 'Deletes a Partner presence and its Hospeda remote logo assets on request.',
    tags: ['Partners', 'Admin'],
    requiredPermissions: [PermissionEnum.PARTNER_EMPTY_PRESENCE],
    requestParams: PartnerEmptyPresenceParamsSchema.shape,
    requestBody: PartnerEmptyPresenceRequestSchema,
    responseSchema: PartnerEmptyPresenceResponseSchema,
    handler: async (ctx: Context, params, body) => {
        const request = PartnerEmptyPresenceRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const partnerId = params.id as string;
        try {
            const result = await emptyPartnerPresence(
                { actor, partnerId, reason: request.reason },
                {
                    mediaProvider: getMediaProvider(),
                    cloudName: env.HOSPEDA_CLOUDINARY_CLOUD_NAME ?? null,
                    clock: getClock().clock
                }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'delete',
                resourceType: 'partner',
                resourceId: partnerId,
                metadata: {
                    administrativeAction: 'ACC_25',
                    subjectId: partnerId,
                    reason: request.reason
                }
            });
            return result;
        } catch (error) {
            if (error instanceof ServiceError && error.reason && error.reason in REJECTIONS) {
                const answer = REJECTIONS[error.reason as keyof typeof REJECTIONS];
                return createErrorResponse(
                    { code: answer.code, message: error.message, reason: error.reason },
                    ctx,
                    answer.status
                );
            }
            throw error;
        }
    }
});
