import {
    PermissionEnum,
    PlanMigrationDetailSchema,
    PlanMigrationListItemSchema
} from '@repo/schemas';
import { getPlanMigrationDetail, listPlanMigrations } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { getClock } from '../../../utils/clock.js';
import { getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute, createAdminRoute } from '../../../utils/route-factory.js';
import { answerPlanMigrationRejection } from './rejections.js';

/** List announced migrations for administrative action 17. */
export const adminListPlanMigrationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List plan migrations',
    description: 'Lists announced migrations with cohort counts.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_MIGRATE_PLAN],
    responseSchema: PlanMigrationListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        try {
            const result = await listPlanMigrations({
                actor: getActorFromContext(ctx),
                page: query?.page,
                pageSize: query?.pageSize
            });
            return {
                items: result.items,
                pagination: getPaginationResponse(result.pagination.total, result.pagination)
            };
        } catch (error) {
            return answerPlanMigrationRejection({ error, ctx });
        }
    }
});

/** Read a migration and each cohort row for administrative action 17. */
export const adminGetPlanMigrationDetailRoute = createAdminRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get plan migration detail',
    description: 'Shows cohort rows by status and unresolved age.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_MIGRATE_PLAN],
    requestParams: { id: z.string().uuid() },
    responseSchema: PlanMigrationDetailSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        try {
            return await getPlanMigrationDetail(
                { actor: getActorFromContext(ctx), planMigrationId: params.id },
                { clock: getClock().clock }
            );
        } catch (error) {
            return answerPlanMigrationRejection({ error, ctx });
        }
    }
});
