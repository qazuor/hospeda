/**
 * Admin Audit & Security Log List Routes (SPEC-162)
 *
 * Read-only admin endpoints over the `audit_log_entries` table:
 * - GET /api/v1/admin/audit-logs    - admin-action events (AUDIT_LOG_VIEW)
 * - GET /api/v1/admin/security-logs - auth/security events (SECURITY_LOG_VIEW)
 *
 * Both share one table; the `logType` discriminator is injected by the route
 * (never read from the client query), so a SUPER_ADMIN holding only one of the
 * two VIEW permissions can never reach the other family.
 *
 * Response conforms to the standard `createAdminListRoute` envelope:
 *   { success: true, data: { items, pagination: { ... } }, metadata: { ... } }
 *
 * @module routes/audit-logs/list
 */

import {
    AuditLogEntryFilterSchema,
    AuditLogEntrySchema,
    type AuditLogType,
    PermissionEnum
} from '@repo/schemas';
import { AuditLogEntryService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { getPaginationResponse } from '../../utils/pagination';
import { createAdminListRoute } from '../../utils/route-factory';

/** Lazy singleton — reads are stateless. */
const auditLogEntryService = (() => {
    let instance: AuditLogEntryService | null = null;
    return () => {
        if (!instance) {
            instance = new AuditLogEntryService({ logger: apiLogger });
        }
        return instance;
    };
})();

/**
 * Accepted sort fields. Only these two columns may be used in ORDER BY to
 * prevent arbitrary column injection. Any other value is rejected by the
 * schema-level `sort` regex before reaching this code.
 */
const ALLOWED_SORT_FIELDS = ['loggedAt', 'severity'] as const;
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
 * Builds an admin list route for one audit log family.
 *
 * @param config.logType - The log family to expose ('audit' | 'security').
 * @param config.permission - The permission gating this route.
 * @param config.summary - OpenAPI summary.
 * @param config.description - OpenAPI description.
 * @returns A configured `createAdminListRoute` route.
 */
function createAuditLogListRoute(config: {
    logType: AuditLogType;
    permission: PermissionEnum;
    summary: string;
    description: string;
}) {
    return createAdminListRoute({
        method: 'get',
        path: '/',
        summary: config.summary,
        description: config.description,
        tags: ['Audit'],
        requiredPermissions: [config.permission],
        requestQuery: AuditLogEntryFilterSchema.omit({ page: true, pageSize: true }).shape,
        responseSchema: AuditLogEntrySchema,
        handler: async (ctx, _params, _body, query) => {
            const actor = getActorFromContext(ctx);
            // Parse through the filter schema first so its defaults (page=1,
            // pageSize=50) take effect before we hand pagination to getPaginationResponse.
            const filter = AuditLogEntryFilterSchema.parse(query ?? {});
            const { page, pageSize } = filter;
            const sort = parseSortParam(filter.sort);

            const result = await auditLogEntryService().listEntries({
                actor,
                // logType is route-injected, never client-supplied.
                logType: config.logType,
                filter,
                sort
            });
            if (result.error) {
                apiLogger.error(result.error, `list ${config.logType} logs failed`);
                throw new ServiceError(result.error.code, result.error.message);
            }

            return {
                items: result.data?.items ?? [],
                pagination: getPaginationResponse(result.data?.total ?? 0, { page, pageSize })
            };
        }
    });
}

/**
 * GET /api/v1/admin/audit-logs
 * Paginated, filterable admin-action audit events.
 */
export const listAuditLogsRoute = createAuditLogListRoute({
    logType: 'audit',
    permission: PermissionEnum.AUDIT_LOG_VIEW,
    summary: 'List audit log entries',
    description:
        'Returns persisted admin-action audit events with the standard pagination envelope. ' +
        'Filter by event type, severity, actor, and date range. ' +
        'Sort by loggedAt (default desc) or severity. Paginated via page + pageSize.'
});

/**
 * GET /api/v1/admin/security-logs
 * Paginated, filterable auth/security events.
 */
export const listSecurityLogsRoute = createAuditLogListRoute({
    logType: 'security',
    permission: PermissionEnum.SECURITY_LOG_VIEW,
    summary: 'List security log entries',
    description:
        'Returns persisted auth/security events (login failures, lockouts, access denied, ' +
        'signouts) with the standard pagination envelope. Filter by event type, severity, ' +
        'actor, and date range. Sort by loggedAt (default desc) or severity.'
});
