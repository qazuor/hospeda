import { SUBSCRIPTION_STATUSES } from '@repo/db';
import {
    AdminSubscriptionCancellationRequestSchema,
    AdminSubscriptionCancellationResponseSchema,
    PermissionEnum,
    ServiceErrorCode,
    SubscriptionCancellationParamsSchema,
    SubscriptionCancellationPreviewResponseSchema
} from '@repo/schemas';
import {
    CANCEL_ACTIVE_REJECTIONS,
    type CancelActiveRejection,
    type CancelActiveSubscriptionResult,
    type CancelDirectSubscriptionResult,
    cancelActiveSubscription,
    cancelDirectSubscription,
    previewSubscriptionCancellation,
    ServiceError
} from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createErrorResponse } from '../../../utils/response-helpers';
import { createAdminRoute } from '../../../utils/route-factory';
import { buildSelfCancellationPorts } from '../cancellation-ports';
import { readSubscription } from '../read-subscription';

/** Route-specific typed cancellation refusals. */
export const ADMIN_CANCELLATION_ROUTE_REJECTIONS = [
    'ADMINISTRATIVE_ACTION_FORBIDDEN',
    'CANCELLATION_ORIGIN_CHANGED'
] as const;
type AdminCancellationRouteRejection = (typeof ADMIN_CANCELLATION_ROUTE_REJECTIONS)[number];
type CancellationRejection = CancelActiveRejection | AdminCancellationRouteRejection;
type Answer = { readonly status: 403 | 404 | 409; readonly code: ServiceErrorCode };
const CONFLICT: Answer = { status: 409, code: ServiceErrorCode.ALREADY_EXISTS };
const REJECTION_ANSWERS: Readonly<Record<CancellationRejection, Answer>> = {
    SUBSCRIPTION_NOT_FOUND: { status: 404, code: ServiceErrorCode.NOT_FOUND },
    CANCELLATION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    CANCELLATION_NOT_PRINCIPAL: CONFLICT,
    CANCELLATION_STATE_NOT_ALLOWED: CONFLICT,
    ADMINISTRATIVE_ACTION_FORBIDDEN: { status: 403, code: ServiceErrorCode.FORBIDDEN },
    CANCELLATION_ORIGIN_CHANGED: CONFLICT
};

function isCancellationRejection(reason: string | undefined): reason is CancellationRejection {
    return (
        reason !== undefined &&
        (
            [
                ...CANCEL_ACTIVE_REJECTIONS,
                ...ADMIN_CANCELLATION_ROUTE_REJECTIONS
            ] as readonly string[]
        ).includes(reason)
    );
}

/** Map typed cancellation rejections; unexpected errors remain server errors. */
export function answerAdminCancellationRejection(input: {
    readonly error: unknown;
    readonly ctx: Context;
}) {
    const { error, ctx } = input;
    if (error instanceof ServiceError && isCancellationRejection(error.reason)) {
        const answer = REJECTION_ANSWERS[error.reason];
        return createErrorResponse(
            { code: answer.code, message: error.message, reason: error.reason },
            ctx,
            answer.status
        );
    }
    throw error;
}

function reject(reason: AdminCancellationRouteRejection, message: string): never {
    throw new ServiceError(ServiceErrorCode.FORBIDDEN, message, undefined, reason);
}

function rejectState(): never {
    throw new ServiceError(
        ServiceErrorCode.ALREADY_EXISTS,
        'Subscription state cannot be cancelled',
        undefined,
        'CANCELLATION_STATE_NOT_ALLOWED'
    );
}

const DESCRIPTION_SUFFIX =
    'Requires billing.cancelSubscription as the route scope; actor equal to the subject is refused by the route.';

/** Preview action 8 cancellation without a refund, using the production cancellation ports. */
export const adminSubscriptionCancellationPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/cancellation',
    summary: 'Preview subscription cancellation without refund (ACC:8)',
    description: `Previews administrative cancellation without refund. ${DESCRIPTION_SUFFIX}`,
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
    requestParams: SubscriptionCancellationParamsSchema.shape,
    responseSchema: SubscriptionCancellationPreviewResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const id = params.subscriptionId as string;
        try {
            const found = await readSubscription(id);
            if (!found)
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Subscription not found',
                    undefined,
                    'SUBSCRIPTION_NOT_FOUND'
                );
            if (found.subjectId?.toLowerCase() === actor.id.toLowerCase())
                reject(
                    'ADMINISTRATIVE_ACTION_FORBIDDEN',
                    'Administrative self-cancellation is forbidden'
                );
            const ports = buildSelfCancellationPorts();
            const preview = await previewSubscriptionCancellation(
                { actor, subscriptionId: id },
                { clock: ports.clock, complements: ports.complements }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: id,
                metadata: { subjectId: found.subjectId }
            });
            return preview;
        } catch (error) {
            return answerAdminCancellationRejection({ error, ctx });
        }
    }
});

type CancellationResult = CancelActiveSubscriptionResult | CancelDirectSubscriptionResult;
type CancellationAction = 'S11' | 'DIRECT' | 'REJECT';
const STATUS_ACTION: Readonly<
    Record<
        (typeof SUBSCRIPTION_STATUSES)[number],
        { readonly action: CancellationAction; readonly origins: readonly string[] }
    >
> = {
    ACTIVE: { action: 'S11', origins: ['ACTIVE'] },
    CANCEL_SCHEDULED: { action: 'S11', origins: ['ACTIVE'] },
    SUSPENDED: { action: 'DIRECT', origins: ['SUSPENDED'] },
    GRACE_PERIOD: { action: 'DIRECT', origins: ['GRACE_PERIOD'] },
    CANCELLED: { action: 'DIRECT', origins: ['SUSPENDED', 'GRACE_PERIOD'] },
    PAUSED: { action: 'REJECT', origins: [] },
    PENDING_AUTHORIZATION: { action: 'REJECT', origins: [] },
    ABANDONED: { action: 'REJECT', origins: [] },
    CHARGE_DECLINED: { action: 'REJECT', origins: [] }
};

/** Execute administrative action 8 cancellation without refund (S11, S23 or S24). */
export const adminCancelSubscriptionRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/cancellation',
    summary: 'Cancel subscription without refund (ACC:8)',
    description: `Cancels a subscription without issuing a refund. ${DESCRIPTION_SUFFIX}`,
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION],
    requestParams: SubscriptionCancellationParamsSchema.shape,
    requestBody: AdminSubscriptionCancellationRequestSchema,
    responseSchema: AdminSubscriptionCancellationResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = AdminSubscriptionCancellationRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const id = params.subscriptionId as string;
        try {
            const found = await readSubscription(id);
            if (!found)
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Subscription not found',
                    undefined,
                    'SUBSCRIPTION_NOT_FOUND'
                );
            if (found.subjectId?.toLowerCase() === actor.id.toLowerCase())
                reject(
                    'ADMINISTRATIVE_ACTION_FORBIDDEN',
                    'Administrative self-cancellation is forbidden'
                );
            const status = found.row.status;
            if (!(SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) rejectState();
            const plan = STATUS_ACTION[status as (typeof SUBSCRIPTION_STATUSES)[number]];
            if (plan.action === 'REJECT') rejectState();
            if (!plan.origins.includes(input.expectedOrigin))
                reject('CANCELLATION_ORIGIN_CHANGED', 'Subscription cancellation origin changed');

            const ports = buildSelfCancellationPorts();
            const result: CancellationResult =
                plan.action === 'S11'
                    ? await cancelActiveSubscription(
                          { actor, subscriptionId: id, reason: input.reason },
                          ports
                      )
                    : await cancelDirectSubscription(
                          { actor, subscriptionId: id, reason: input.reason },
                          ports
                      );
            const transition =
                result.outcome === 'SCHEDULED'
                    ? 'S11'
                    : result.outcome === 'CANCELLED'
                      ? result.transition
                      : null;
            const serviceEndsAt =
                'serviceEndsAt' in result ? result.serviceEndsAt : result.serviceEndedAt;
            const origin = status;
            const note = input.note;
            const response = {
                subscriptionId: id,
                outcome: result.outcome,
                transition,
                serviceEndsAt: serviceEndsAt?.toISOString() ?? null,
                ...('cancelCall' in result ? { cancelCall: result.cancelCall } : {}),
                ...('escalated' in result && result.escalated
                    ? { escalated: result.escalated }
                    : {})
            };
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'subscription',
                resourceId: id,
                metadata: {
                    administrativeAction: 'ACC_8',
                    transition,
                    outcome: result.outcome,
                    origin,
                    subjectId: found.subjectId,
                    ...('cancelCall' in result ? { cancelCall: result.cancelCall } : {}),
                    ...('escalated' in result && result.escalated
                        ? { escalated: result.escalated }
                        : {}),
                    ...(note ? { note } : {}),
                    ...(input.reason ? { reason: input.reason } : {})
                }
            });
            return response;
        } catch (error) {
            return answerAdminCancellationRejection({ error, ctx });
        }
    }
});
