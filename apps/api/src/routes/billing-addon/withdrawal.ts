import {
    AddonWithdrawalParamsSchema,
    AddonWithdrawalResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError, withdrawAddon } from '@repo/service-core';
import { getActorFromContext, isGuestActor } from '../../utils/actor';
import { AuditEventType, auditLog } from '../../utils/audit-logger';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildAddonWithdrawalPorts } from './withdrawal-ports';

/** Withdraw one live recurring addon owned by the signed-in actor. */
export const protectedAddonWithdrawalRoute = createProtectedRoute({
    method: 'post',
    path: '/instances/{instanceId}/withdrawal',
    summary: 'Withdraw own recurring addon',
    description: 'Cancels one live recurring addon and its provider authorization.',
    tags: ['Billing addons'],
    requestParams: AddonWithdrawalParamsSchema.shape,
    responseSchema: AddonWithdrawalResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        if (isGuestActor(actor))
            return createErrorResponse(
                { code: ServiceErrorCode.UNAUTHORIZED, message: 'Authentication required' },
                ctx,
                401
            );
        const { instanceId } = AddonWithdrawalParamsSchema.parse(params);
        try {
            const result = await withdrawAddon({ actor, instanceId }, buildAddonWithdrawalPorts());
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'addon_instance',
                resourceId: instanceId,
                metadata: { transition: 'WITHDRAWN', status: result.status }
            });
            return result;
        } catch (error) {
            if (error instanceof ServiceError && error.reason === 'NOT_FOUND')
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.NOT_FOUND,
                        message: error.message,
                        reason: error.reason
                    },
                    ctx,
                    404
                );
            if (error instanceof ServiceError && error.reason === 'ADDON_NOT_WITHDRAWABLE')
                return createErrorResponse(
                    {
                        code: ServiceErrorCode.ALREADY_EXISTS,
                        message: error.message,
                        reason: error.reason
                    },
                    ctx,
                    409
                );
            throw error;
        }
    }
});
