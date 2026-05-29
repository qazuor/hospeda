/**
 * Admin Cron Run History Routes (SPEC-161)
 *
 * Read-only admin endpoints over the `cron_runs` table:
 * - GET /api/v1/admin/cron/runs          - paginated + filtered run history
 * - GET /api/v1/admin/cron/runs/summary  - last run per job + recent failures (dashboard card D)
 * - GET /api/v1/admin/cron/runs/{id}     - single run detail
 *
 * All gated by SYSTEM_MAINTENANCE_MODE, the same permission as the rest of the
 * cron-admin surface (list jobs + manual trigger).
 *
 * @module routes/cron-admin/runs
 */

import {
    CronRunFilterSchema,
    CronRunSchema,
    CronRunSummarySchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { CronRunService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

/** Lazy singleton — recording/reading is stateless. */
const cronRunService = (() => {
    let instance: CronRunService | null = null;
    return () => {
        if (!instance) {
            instance = new CronRunService({ logger: apiLogger });
        }
        return instance;
    };
})();

/** Response shape for the paginated run list. */
const cronRunListResponseSchema = z.object({
    items: z.array(CronRunSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number()
});

/**
 * GET /api/v1/admin/cron/runs
 * Paginated, filterable cron run history.
 */
export const listCronRunsRoute = createAdminRoute({
    method: 'get',
    path: '/runs',
    summary: 'List cron runs',
    description:
        'Returns recorded cron executions, newest first. Filter by jobName, status, ' +
        'executionMode, and started-at date range. Paginated via page + pageSize.',
    tags: ['Cron'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    requestQuery: CronRunFilterSchema.shape,
    responseSchema: cronRunListResponseSchema,
    handler: async (c, _params, _body, query) => {
        const actor = getActorFromContext(c);
        const filter = CronRunFilterSchema.parse(query ?? {});

        const result = await cronRunService().listRuns({ actor, filter });
        if (result.error) {
            apiLogger.error(result.error, 'listCronRuns failed');
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            total: result.data?.total ?? 0,
            page: filter.page,
            pageSize: filter.pageSize
        };
    }
});

/**
 * GET /api/v1/admin/cron/runs/summary
 * Last run per job + recent failures (SPEC-155 ADMIN card D).
 * Registered before the `/runs/{id}` param route so "summary" is not read as an id.
 */
export const cronRunSummaryRoute = createAdminRoute({
    method: 'get',
    path: '/runs/summary',
    summary: 'Cron run summary',
    description:
        'Aggregated cron health: the latest run per job, the most recent failures, ' +
        'and the count of jobs whose last run was not a success.',
    tags: ['Cron'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    responseSchema: CronRunSummarySchema,
    handler: async (c) => {
        const actor = getActorFromContext(c);
        const result = await cronRunService().getSummary({ actor });
        if (result.error) {
            apiLogger.error(result.error, 'cronRunSummary failed');
            throw new ServiceError(result.error.code, result.error.message);
        }
        return result.data;
    },
    options: { cacheTTL: 30 }
});

/**
 * GET /api/v1/admin/cron/runs/{id}
 * Single run detail.
 */
export const getCronRunByIdRoute = createAdminRoute({
    method: 'get',
    path: '/runs/{id}',
    summary: 'Get cron run by id',
    description: 'Returns a single recorded cron run by its id.',
    tags: ['Cron'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    requestParams: { id: z.string().uuid() },
    responseSchema: CronRunSchema,
    handler: async (c, params) => {
        const actor = getActorFromContext(c);
        const id = params.id as string;

        const result = await cronRunService().getById({ actor, id });
        if (result.error) {
            apiLogger.error(result.error, 'getCronRunById failed');
            throw new ServiceError(result.error.code, result.error.message);
        }
        if (!result.data) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, `Cron run not found: ${id}`);
        }
        return result.data;
    }
});
