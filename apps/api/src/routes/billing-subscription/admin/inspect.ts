import { PermissionEnum, SubscriptionReadSchema } from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createRouter } from '../../../utils/create-app';
import { createAdminRoute } from '../../../utils/route-factory';
import { readSubscription } from '../read-subscription';
import {
    adminCancelSubscriptionRoute,
    adminSubscriptionCancellationPreviewRoute
} from './cancellation';
import {
    adminDeclareManualUnpaidRoute,
    adminListManualPaymentsRoute,
    adminManualPaymentRegistrationPreviewRoute,
    adminManualUnpaidPreviewRoute,
    adminRegisterManualPaymentRoute
} from './manual-payment';
import {
    adminLateManualPaymentPreviewRoute,
    adminRegisterLateManualPaymentRoute,
    adminRegisterUnallocatedManualPaymentRoute,
    adminUnallocatedManualPaymentPreviewRoute
} from './manual-payment-late';
import { adminSubscriptionOpenRefundsRoute } from './open-refunds';
import {
    adminPauseSubscriptionRoute,
    adminResumeSubscriptionRoute,
    adminSubscriptionPausePreviewRoute
} from './pause';
import { adminPlanChangeOptionsRoute, adminPlanChangeRoute } from './plan-change';
import {
    adminRevokeSubscriptionRoute,
    adminSubscriptionRevocationPreviewRoute
} from './revocation';

/** Inspect one subscription with the entity-specific permission. */
export const adminInspectSubscriptionRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}',
    summary: 'Inspect subscription',
    description: 'Reads one subscription for administrative inspection.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: { subscriptionId: z.string().uuid() },
    responseSchema: SubscriptionReadSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const found = await readSubscription(params.subscriptionId as string);
        if (!found) {
            throw entityNotFoundError({ entityName: 'Subscription' });
        }
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'subscription',
            resourceId: found.row.id,
            metadata: { subjectId: found.subjectId }
        });
        return {
            ...found.row,
            ...(found.subject ? { subject: found.subject } : {}),
            ...(found.currentPlan ? { currentPlan: found.currentPlan } : {})
        };
    }
});

const router = createRouter();
router.route('/', adminInspectSubscriptionRoute);
router.route('/', adminSubscriptionOpenRefundsRoute);
router.route('/', adminSubscriptionRevocationPreviewRoute);
router.route('/', adminRevokeSubscriptionRoute);
router.route('/', adminSubscriptionCancellationPreviewRoute);
router.route('/', adminCancelSubscriptionRoute);
router.route('/', adminSubscriptionPausePreviewRoute);
router.route('/', adminPauseSubscriptionRoute);
router.route('/', adminResumeSubscriptionRoute);
router.route('/', adminPlanChangeRoute);
router.route('/', adminPlanChangeOptionsRoute);
router.route('/', adminListManualPaymentsRoute);
router.route('/', adminManualPaymentRegistrationPreviewRoute);
router.route('/', adminRegisterManualPaymentRoute);
router.route('/', adminManualUnpaidPreviewRoute);
router.route('/', adminDeclareManualUnpaidRoute);
router.route('/', adminLateManualPaymentPreviewRoute);
router.route('/', adminRegisterLateManualPaymentRoute);
router.route('/', adminUnallocatedManualPaymentPreviewRoute);
router.route('/', adminRegisterUnallocatedManualPaymentRoute);

export { router as adminBillingSubscriptionRoutes };
