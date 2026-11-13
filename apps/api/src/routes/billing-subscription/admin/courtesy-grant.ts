import {
    AdminSubscriptionCourtesyGrantPreviewQuerySchema,
    AdminSubscriptionCourtesyGrantPreviewResponseSchema,
    AdminSubscriptionCourtesyGrantRequestSchema,
    AdminSubscriptionCourtesyGrantResponseSchema,
    AdminSubscriptionPauseParamsSchema,
    PermissionEnum
} from '@repo/schemas';
import { grantTemporaryCourtesy, previewTemporaryCourtesyGrant } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { buildPausePorts } from '../pause-ports';
import { rejectPause } from '../pause-rejections';
import { readSubscription } from '../read-subscription';
import {
    answerCourtesyGrantError,
    answerCourtesyGrantNotApplied,
    answerCourtesyGrantRefusal
} from './courtesy-grant-rejections';

async function subjectFor(subscriptionId: string, actorId: string) {
    const found = await readSubscription(subscriptionId);
    if (!found) rejectPause('SUBSCRIPTION_NOT_FOUND');
    if (found.subjectId?.toLowerCase() === actorId.toLowerCase())
        rejectPause('ADMINISTRATIVE_ACTION_FORBIDDEN');
    return found;
}

/** Preview S9 or S34 temporary courtesy without a provider call. */
export const adminCourtesyGrantPreviewRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/courtesy/grant-preview',
    summary: 'Preview temporary courtesy grant (ACC:1)',
    description: 'Reads courtesy eligibility and the projected end date.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: AdminSubscriptionPauseParamsSchema.shape,
    requestQuery: AdminSubscriptionCourtesyGrantPreviewQuerySchema.shape,
    responseSchema: AdminSubscriptionCourtesyGrantPreviewResponseSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const found = await subjectFor(subscriptionId, actor.id);
            const input = AdminSubscriptionCourtesyGrantPreviewQuerySchema.parse(query);
            const preview = await previewTemporaryCourtesyGrant(
                { subscriptionId, months: input.months },
                buildPausePorts()
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'subscription',
                resourceId: subscriptionId,
                metadata: { subjectId: found.subjectId }
            });
            return {
                ...preview,
                endsAt: preview.endsAt.toISOString(),
                liveCourtesy: preview.liveCourtesy
                    ? { ...preview.liveCourtesy, endsAt: preview.liveCourtesy.endsAt.toISOString() }
                    : null
            };
        } catch (error) {
            return answerCourtesyGrantError({ error, ctx });
        }
    }
});

/** Execute a confirmed S9 grant or S34 extension and audit the grant. */
export const adminGrantCourtesyRoute = createAdminRoute({
    method: 'post',
    path: '/{subscriptionId}/courtesy/grant',
    summary: 'Grant temporary courtesy (ACC:1)',
    description: 'Requires the observed status and explicit confirmation.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_GRANT_COMPLIMENTARY],
    requestParams: AdminSubscriptionPauseParamsSchema.shape,
    requestBody: AdminSubscriptionCourtesyGrantRequestSchema,
    responseSchema: AdminSubscriptionCourtesyGrantResponseSchema,
    successStatusCode: 200,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = AdminSubscriptionCourtesyGrantRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        const subscriptionId = params.subscriptionId as string;
        try {
            const found = await subjectFor(subscriptionId, actor.id);
            if (found.row.status !== input.expectedStatus)
                rejectPause('ADMINISTRATIVE_ACTION_STATE_CHANGED');
            const result = await grantTemporaryCourtesy(
                { subscriptionId, months: input.months, reason: input.reason, grantedBy: actor.id },
                buildPausePorts()
            );
            if (result.outcome === 'REFUSED')
                return answerCourtesyGrantRefusal({ reason: result.reason, ctx });
            if (result.outcome === 'NOT_APPLIED') return answerCourtesyGrantNotApplied(ctx);
            if (!('courtesyGrantId' in result)) rejectPause('LOST_RACE');
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: result.outcome === 'GRANTED' ? 'create' : 'update',
                resourceType: 'courtesy_grant',
                resourceId: result.courtesyGrantId,
                metadata: {
                    administrativeAction: 'ACC_1',
                    act: result.outcome === 'GRANTED' ? 'GRANT_COURTESY' : 'EXTEND_COURTESY',
                    transition: result.outcome === 'GRANTED' ? 'S9' : 'S34',
                    subjectId: found.subjectId,
                    subscriptionId,
                    months: input.months,
                    endsAt: result.endsAt.toISOString(),
                    reason: input.reason
                }
            });
            return {
                outcome: result.outcome,
                courtesyGrantId: result.courtesyGrantId,
                endsAt: result.endsAt.toISOString()
            };
        } catch (error) {
            return answerCourtesyGrantError({ error, ctx });
        }
    }
});
