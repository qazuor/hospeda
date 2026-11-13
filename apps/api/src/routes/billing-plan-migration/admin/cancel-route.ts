import { randomUUID } from 'node:crypto';
import { PermissionEnum, PlanMigrationCancelResultSchema } from '@repo/schemas';
import { cancelPlanMigration } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getRequestCorrelationId } from '../../../lib/request-context.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { getClock } from '../../../utils/clock.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { answerPlanMigrationRejection } from './rejections.js';

/** Cancel and audit an announced migration after its transaction succeeds. */
export const adminCancelPlanMigrationRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/cancel',
    successStatusCode: 200,
    summary: 'Cancel a plan migration',
    description: 'Cancels pending cohort rows and queues customer notices.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_MIGRATE_PLAN],
    requestParams: { id: z.string().uuid() },
    responseSchema: PlanMigrationCancelResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        try {
            const actor = getActorFromContext(ctx);
            const result = await cancelPlanMigration(
                { actor, planMigrationId: params.id },
                { clock: getClock().clock }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'plan-migration',
                resourceId: params.id as string,
                metadata: {
                    administrativeAction: 'ACC_17',
                    planMigrationId: params.id,
                    correlationId: getRequestCorrelationId() ?? randomUUID()
                }
            });
            return result;
        } catch (error) {
            return answerPlanMigrationRejection({ error, ctx });
        }
    }
});
