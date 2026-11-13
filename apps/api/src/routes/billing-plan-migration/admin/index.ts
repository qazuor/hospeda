import { randomUUID } from 'node:crypto';
import {
    LaunchPlanMigrationRequestSchema,
    PermissionEnum,
    PlanMigrationLaunchResponseSchema,
    PlanMigrationOptionsSchema,
    PlanMigrationPreviewRequestSchema,
    PlanMigrationPreviewSchema
} from '@repo/schemas';
import {
    launchPlanMigration,
    listPlanMigrationOptions,
    previewPlanMigration
} from '@repo/service-core';
import type { Context } from 'hono';
import { getRequestCorrelationId } from '../../../lib/request-context.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { getClock } from '../../../utils/clock.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { adminCancelPlanMigrationRoute } from './cancel-route.js';
import { planMigrationVerticals } from './ports.js';
import { adminGetPlanMigrationDetailRoute, adminListPlanMigrationsRoute } from './read-routes.js';
import { answerPlanMigrationRejection } from './rejections.js';
import { adminListRetiredPlanVersionsRoute } from './retired-versions-route.js';

/** List retired origins and current, sellable destinations. */
export const adminPlanMigrationOptionsRoute = createAdminRoute({
    method: 'get',
    path: '/options',
    summary: 'List plan migration options',
    description: 'Lists retired sources and current sellable targets.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_MIGRATE_PLAN],
    responseSchema: PlanMigrationOptionsSchema,
    handler: async (ctx: Context) => {
        try {
            return await listPlanMigrationOptions({
                actor: getActorFromContext(ctx),
                verticals: planMigrationVerticals()
            });
        } catch (error) {
            return answerPlanMigrationRejection({ error, ctx });
        }
    }
});

/** Preview each customer before confirming action 17. */
export const adminPreviewPlanMigrationRoute = createAdminRoute({
    method: 'post',
    path: '/preview',
    successStatusCode: 200,
    summary: 'Preview a plan migration',
    description: 'Shows customer amounts, direction, dates and exclusions.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_MIGRATE_PLAN],
    requestBody: PlanMigrationPreviewRequestSchema,
    responseSchema: PlanMigrationPreviewSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            return await previewPlanMigration({
                actor: getActorFromContext(ctx),
                input: body,
                verticals: planMigrationVerticals(),
                clock: getClock().clock
            });
        } catch (error) {
            return answerPlanMigrationRejection({ error, ctx });
        }
    }
});

/** Launch and audit an announced retirement migration. */
export const adminLaunchPlanMigrationRoute = createAdminRoute({
    method: 'post',
    path: '/',
    successStatusCode: 200,
    summary: 'Launch a plan migration',
    description: 'Announces a retirement migration for the previewed cohort.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_MIGRATE_PLAN],
    requestBody: LaunchPlanMigrationRequestSchema,
    responseSchema: PlanMigrationLaunchResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            const actor = getActorFromContext(ctx);
            const result = await launchPlanMigration({
                actor,
                input: body,
                verticals: planMigrationVerticals(),
                clock: getClock().clock
            });
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'plan-migration',
                resourceId: result.planMigrationId,
                metadata: {
                    administrativeAction: 'ACC_17',
                    planMigrationId: result.planMigrationId,
                    sourcePlanVersionId: body.sourcePlanVersionId,
                    targetPlanVersionId: body.targetPlanVersionId,
                    reason: result.reason,
                    deadlineVersion: result.deadlineVersion,
                    rowCount: result.rows.length,
                    excludedCount: result.excluded.length,
                    correlationId: getRequestCorrelationId() ?? randomUUID()
                }
            });
            return result;
        } catch (error) {
            return answerPlanMigrationRejection({ error, ctx });
        }
    }
});

const router = createRouter();
router.route('/', adminPlanMigrationOptionsRoute);
router.route('/', adminPreviewPlanMigrationRoute);
router.route('/', adminLaunchPlanMigrationRoute);
router.route('/', adminListRetiredPlanVersionsRoute);
router.route('/', adminListPlanMigrationsRoute);
router.route('/', adminGetPlanMigrationDetailRoute);
router.route('/', adminCancelPlanMigrationRoute);

export { router as adminPlanMigrationRoutes };
