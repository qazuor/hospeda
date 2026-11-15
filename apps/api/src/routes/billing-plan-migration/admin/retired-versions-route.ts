import { PermissionEnum, RetiredPlanVersionListSchema } from '@repo/schemas';
import { listRetiredPlanVersions } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { planMigrationVerticals } from './ports.js';
import { answerPlanMigrationRejection } from './rejections.js';

/** List the plan versions nobody can buy anymore with their live customers. */
export const adminListRetiredPlanVersionsRoute = createAdminRoute({
    method: 'get',
    path: '/retired-versions',
    summary: 'List retired plan versions',
    description: 'Lists versions that are not current and sellable, with live subscriptions.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_MIGRATE_PLAN],
    responseSchema: RetiredPlanVersionListSchema,
    handler: async (ctx: Context) => {
        try {
            return await listRetiredPlanVersions({
                actor: getActorFromContext(ctx),
                verticals: planMigrationVerticals()
            });
        } catch (error) {
            return answerPlanMigrationRejection({ error, ctx });
        }
    }
});
