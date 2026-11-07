import {
    AdminSubscriptionPlanChangeParamsSchema,
    AdminSubscriptionPlanChangeRequestSchema,
    AdminSubscriptionPlanChangeResponseSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { requestPlanChange } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { env } from '../../../utils/env';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { answer, rejectionAnswer } from '../plan-change';
import { buildPlanChangePorts } from '../plan-change-ports';
import { readSubscription } from '../read-subscription';

/** Execute a confirmed administrative plan change for the subscription owner. */
export const adminPlanChangeRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/plan-change',
    summary: 'Change a customer subscription plan (ACC:10)',
    description:
        'Requires explicit confirmation and the ACTIVE status observed by the administrator.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN],
    requestParams: AdminSubscriptionPlanChangeParamsSchema.shape,
    requestBody: AdminSubscriptionPlanChangeRequestSchema,
    responseSchema: AdminSubscriptionPlanChangeResponseSchema,
    successStatusCode: 200,
    handler: async (ctx, params, body) => {
        const input = AdminSubscriptionPlanChangeRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        const found = await readSubscription(subscriptionId);
        const reject = (status: 403 | 404 | 409, code: string, reason: string) =>
            createErrorResponse(
                { code, message: reason, reason, details: { reason } },
                ctx,
                status
            );
        if (!found) return reject(404, ServiceErrorCode.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND');
        if (found.subjectId?.toLowerCase() === actor.id.toLowerCase())
            return reject(403, ServiceErrorCode.FORBIDDEN, 'ADMINISTRATIVE_ACTION_FORBIDDEN');
        if (found.row.status !== input.expectedStatus)
            return reject(409, 'CONFLICT', 'ADMINISTRATIVE_ACTION_STATE_CHANGED');
        if (!found.subjectId)
            return reject(404, ServiceErrorCode.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND');
        try {
            const result = await requestPlanChange(
                {
                    actor: { id: found.subjectId },
                    subscriptionId,
                    billingOptionId: input.billingOptionId,
                    returnUrl: env.HOSPEDA_SITE_URL
                },
                await buildPlanChangePorts()
            );
            if (result.path === 'REJECTED') {
                const mapped = rejectionAnswer[result.reason];
                return createErrorResponse(
                    {
                        code: mapped.code,
                        message: 'Plan change rejected',
                        reason: result.reason,
                        details: {
                            reason: result.reason,
                            ...(result.reason === 'CHANGE_WINDOW_TOO_SHORT'
                                ? { availableFrom: result.availableFrom.toISOString() }
                                : {})
                        }
                    },
                    ctx,
                    mapped.status
                );
            }
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: {
                    administrativeAction: 'ACC_10',
                    act: 'PLAN_CHANGE',
                    outcome: result.path,
                    subjectId: found.subjectId,
                    billingOptionId: input.billingOptionId,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            if (result.path === 'SUCCESSION')
                return {
                    outcome: result.path,
                    checkoutUrl: result.checkoutUrl,
                    firstChargeAt: result.firstChargeAt.toISOString(),
                    creditDays: result.creditDays
                };
            if (result.path === 'DOWNGRADE')
                return {
                    outcome: result.path,
                    effectiveAt: result.effectiveAt.toISOString(),
                    amountMinor: result.amountMinor,
                    replaced: result.replaced,
                    surplus: result.surplus
                };
            return { outcome: result.path, amountMinor: result.amountMinor };
        } catch (error) {
            return answer(error, ctx);
        }
    }
});
