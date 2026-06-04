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
 * Response conforms to the standard `createAdminListRoute` envelope:
 *   { success: true, data: { items, pagination: { page, pageSize, total,
 *     totalPages, hasNextPage, hasPreviousPage } }, metadata: { ... } }
 *
 * @module routes/app-logs/list
 */

import { AppLogEntryFilterSchema, AppLogEntrySchema, PermissionEnum } from '@repo/schemas';
import { AppLogEntryService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { getPaginationResponse } from '../../utils/pagination';
import { createAdminListRoute } from '../../utils/route-factory';

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

/**
 * Accepted sort fields. Only these two columns may be used in ORDER BY to
 * prevent arbitrary column injection. Any other value is rejected by the
 * schema-level `sort` regex before reaching this code.
 */
const ALLOWED_SORT_FIELDS = ['loggedAt', 'level'] as const;
type AllowedSortField = (typeof ALLOWED_SORT_FIELDS)[number];

/**
 * Parses the `sort` query param (`field:direction`) into a validated sort input.
 * Returns the default (loggedAt desc) when the param is absent.
 *
 * @param sort - Raw sort string from query params (e.g. "loggedAt:desc").
 * @returns Validated sort input guaranteed to contain a whitelisted field.
 */
function parseSortParam(sort?: string): { field: AllowedSortField; direction: 'asc' | 'desc' } {
    if (!sort) {
        return { field: 'loggedAt', direction: 'desc' };
    }

    const [rawField, rawDirection] = sort.split(':');
    // The schema regex already enforces the allowed values; this cast is safe.
    const field = rawField as AllowedSortField;
    const direction = (rawDirection ?? 'desc') as 'asc' | 'desc';
    return { field, direction };
}

/**
 * GET /api/v1/admin/logs
 * Paginated, filterable WARN/ERROR application log entries.
 *
 * Query params (all optional):
 *   - level: 'WARN' | 'ERROR'
 *   - category: string
 *   - fromDate: ISO date string
 *   - toDate: ISO date string
 *   - requestId: string (max 64)
 *   - userId: UUID
 *   - method: string (max 10)
 *   - path: string (substring match)
 *   - sort: 'loggedAt:asc' | 'loggedAt:desc' | 'level:asc' | 'level:desc'
 *   - page: number (default 1)
 *   - pageSize: number (default 50, max 100)
 */
export const listAppLogsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List app log entries',
    description:
        'Returns persisted WARN/ERROR application log entries with standard pagination envelope. ' +
        'Filter by level, category, date range, and request-context fields. ' +
        'Sort by loggedAt (default desc) or level. Paginated via page + pageSize.',
    tags: ['Logs'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    requestQuery: AppLogEntryFilterSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: AppLogEntrySchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        // Parse through the filter schema first so its defaults (page=1, pageSize=50)
        // take effect before we hand pagination to getPaginationResponse.
        const filter = AppLogEntryFilterSchema.parse(query ?? {});
        const { page, pageSize } = filter;
        const sort = parseSortParam(filter.sort);

        const result = await appLogEntryService().listEntries({ actor, filter, sort });
        if (result.error) {
            apiLogger.error(result.error, 'listAppLogs failed');
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
        };
    }
});
