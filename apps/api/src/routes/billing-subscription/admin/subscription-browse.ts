import {
    AdminSubscriptionDetailHttpSchema,
    AdminSubscriptionDetailParamsSchema,
    AdminSubscriptionListItemHttpSchema,
    AdminSubscriptionListQuerySchema,
    PermissionEnum
} from '@repo/schemas';
import { getAdminSubscriptionDetail, listAdminSubscriptions } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory';

/** Serialize a nullable date for an HTTP response. */
const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

/**
 * GET /api/v1/admin/billing-subscription — authorized support list of subscriptions.
 *
 * Searches by owner email/name or by a subscription/user UUID and filters by vertical and
 * status. Unknown query parameters (for example `limit`) are rejected by the list factory.
 */
export const adminListSubscriptionsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List subscriptions for administrative support',
    description:
        'Search subscriptions by owner email/name or id and filter by vertical and status.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestQuery: AdminSubscriptionListQuerySchema.shape,
    responseSchema: AdminSubscriptionListItemHttpSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const parsed = AdminSubscriptionListQuerySchema.parse(query ?? {});
        const { page, pageSize } = parsed;
        const result = await listAdminSubscriptions({ actor, ...parsed });
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'subscription',
            resourceId: 'list',
            metadata: { subjectId: null }
        });
        return {
            items: result.items.map((item) => ({
                ...item,
                nextChargeAt: toIso(item.nextChargeAt),
                createdAt: item.createdAt.toISOString()
            })),
            pagination: getPaginationResponse(result.total, { page, pageSize })
        };
    }
});

/**
 * GET /api/v1/admin/billing-subscription/{subscriptionId}/overview — one subscription detail.
 *
 * Returns the plan and version, the next charge, and the currently open pause and courtesy.
 * An unknown subscription answers 404; a malformed id answers 400.
 */
export const adminSubscriptionOverviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/overview',
    summary: 'Read one subscription detail for administrative support',
    description: 'Reads plan, next charge, open pause and current courtesy for one subscription.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: AdminSubscriptionDetailParamsSchema.shape,
    responseSchema: AdminSubscriptionDetailHttpSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const detail = await getAdminSubscriptionDetail(
            { actor, subscriptionId: params.subscriptionId as string },
            { clock: getClock().clock }
        );
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'subscription',
            resourceId: detail.id,
            metadata: { subjectId: detail.owner?.id ?? null }
        });
        return {
            ...detail,
            nextChargeAt: toIso(detail.nextChargeAt),
            createdAt: detail.createdAt.toISOString(),
            serviceEndsAt: toIso(detail.serviceEndsAt),
            planVersion: detail.planVersion
                ? {
                      ...detail.planVersion,
                      createdAt: detail.planVersion.createdAt.toISOString()
                  }
                : null,
            pause: detail.pause
                ? {
                      ...detail.pause,
                      startsAt: detail.pause.startsAt.toISOString(),
                      expectedEndAt: toIso(detail.pause.expectedEndAt)
                  }
                : null,
            courtesy: detail.courtesy
                ? {
                      ...detail.courtesy,
                      startsAt: detail.courtesy.startsAt.toISOString(),
                      endsAt: detail.courtesy.endsAt.toISOString()
                  }
                : null
        };
    }
});
