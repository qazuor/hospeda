/**
 * Admin App Log List Route (SPEC-184)
 *
 * Read-only admin endpoint over the `app_log_entries` table:
 * - GET /api/v1/admin/logs - paginated + filtered WARN/ERROR log entries
 *
 * Gated by SYSTEM_MAINTENANCE_MODE, the same permission as the cron-admin
 * surface — the admin log viewer is co-located under
 * Plataforma → Operaciones del sistema.
 *
 * @module routes/app-logs/list
 */

import { AppLogEntryFilterSchema, AppLogEntrySchema, PermissionEnum } from '@repo/schemas';
import { AppLogEntryService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

/** Lazy singleton — reads are stateless. */
const appLogEntryService = (() => {
    let instance: AppLogEntryService | null = null;
    return () => {
        if (!instance) {
            instance = new AppLogEntryService({ logger: apiLogger });
        }
        return instance;
    };
})();

/** Response shape for the paginated log list. */
const appLogListResponseSchema = z.object({
    items: z.array(AppLogEntrySchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number()
});

/**
 * GET /api/v1/admin/logs
 * Paginated, filterable WARN/ERROR application log entries.
 */
export const listAppLogsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List app log entries',
    description:
        'Returns persisted WARN/ERROR application log entries, newest first. ' +
        'Filter by level, category, and logged-at date range. Paginated via page + pageSize.',
    tags: ['Logs'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    requestQuery: AppLogEntryFilterSchema.shape,
    responseSchema: appLogListResponseSchema,
    handler: async (c, _params, _body, query) => {
        const actor = getActorFromContext(c);
        const filter = AppLogEntryFilterSchema.parse(query ?? {});

        const result = await appLogEntryService().listEntries({ actor, filter });
        if (result.error) {
            apiLogger.error(result.error, 'listAppLogs failed');
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
