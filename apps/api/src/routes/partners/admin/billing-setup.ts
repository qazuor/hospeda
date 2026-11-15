import { planCatalogModel } from '@repo/db';
import {
    PartnerBillingSetupParamsSchema,
    PartnerBillingSetupPreviewResponseSchema,
    PartnerBillingSetupRequestSchema,
    PartnerBillingSetupResponseSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import type { Context } from 'hono';
import type { PartnerBillingSetupRejection } from '../../../services/partner-billing-setup/partner-billing-setup.service';
import {
    configurePartnerBilling,
    previewPartnerBillingSetup
} from '../../../services/partner-billing-setup/partner-billing-setup.service';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getPaymentProvider } from '../../../utils/payment-provider';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { beforeCancelNotice } from '../../billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../../billing-subscription/tourist-vip-inheritance';

const REJECTION_ANSWERS: Readonly<
    Record<
        PartnerBillingSetupRejection,
        { readonly status: 403 | 404 | 409 | 422; readonly code: ServiceErrorCode }
    >
> = {
    NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    PARTNER_WITHOUT_OWNER: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS },
    COMMITMENT_TAKEN: { status: 409, code: ServiceErrorCode.ALREADY_EXISTS },
    PLAN_NOT_FOR_SALE: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    MANUAL_PAYMENT_NOT_AVAILABLE: { status: 422, code: ServiceErrorCode.VALIDATION_ERROR },
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN }
};

function isRejection(reason: string | undefined): reason is PartnerBillingSetupRejection {
    return reason !== undefined && Object.hasOwn(REJECTION_ANSWERS, reason);
}

function answerRejection(error: unknown, ctx: Context) {
    const reason = error instanceof ServiceError ? error.reason : undefined;
    if (error instanceof ServiceError && isRejection(reason)) {
        const answer = REJECTION_ANSWERS[reason];
        return createErrorResponse(
            { code: answer.code, message: error.message, reason: error.reason },
            ctx,
            answer.status
        );
    }
    throw error;
}

/** GET /api/v1/admin/partners/{id}/billing-setup — read-only action 6 preview (AC:V7:17, ACC:6). */
export const adminPreviewPartnerBillingSetupRoute = createAdminRoute({
    method: 'get',
    path: '/{id}/billing-setup',
    summary: 'Preview Partner billing setup',
    description: 'Lists sellable Partner manual billing options without writing billing rows.',
    tags: ['Partners', 'Admin'],
    requiredPermissions: [PermissionEnum.PARTNER_CONFIGURE_BILLING],
    requestParams: PartnerBillingSetupParamsSchema.shape,
    responseSchema: PartnerBillingSetupPreviewResponseSchema,
    handler: async (ctx: Context, params) => {
        try {
            return await previewPartnerBillingSetup({
                actor: getActorFromContext(ctx),
                partnerId: params.id as string
            });
        } catch (error) {
            return answerRejection(error, ctx);
        }
    }
});

/** POST /api/v1/admin/partners/{id}/billing-setup — confirmed action 6 act (AC:V7:17, ACC:6). */
export const adminConfigurePartnerBillingRoute = createAdminRoute({
    method: 'post',
    successStatusCode: 200,
    path: '/{id}/billing-setup',
    summary: 'Configure Partner billing',
    description: 'Creates the Partner owner manual subscription after explicit confirmation.',
    tags: ['Partners', 'Admin'],
    requiredPermissions: [PermissionEnum.PARTNER_CONFIGURE_BILLING],
    requestParams: PartnerBillingSetupParamsSchema.shape,
    requestBody: PartnerBillingSetupRequestSchema,
    responseSchema: PartnerBillingSetupResponseSchema,
    handler: async (ctx: Context, params, body) => {
        const request = PartnerBillingSetupRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await configurePartnerBilling(
                {
                    actor,
                    partnerId: params.id as string,
                    billingOptionId: request.billingOptionId,
                    reason: request.reason
                },
                {
                    provider: getPaymentProvider(),
                    clock: getClock().clock,
                    planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy,
                    beforeCancelNotice,
                    touristVipInheritance
                }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'partner',
                resourceId: params.id as string,
                metadata: {
                    administrativeAction: 'ACC_6',
                    subjectId: params.id as string,
                    reason: request.reason
                }
            });
            return {
                subscriptionId: result.subscriptionId,
                manualPaymentId: result.manualPaymentId,
                periodStart: result.periodStart.toISOString(),
                authorizationWindowEndsAt: result.authorizationWindowEndsAt.toISOString(),
                created: result.created
            };
        } catch (error) {
            return answerRejection(error, ctx);
        }
    }
});
