/**
 * Admin list social audit log endpoint — SPEC-254 T-037.
 *
 * GET /api/v1/admin/social/audit-log
 * Returns a paginated list of semantic audit log entries ordered by createdAt DESC.
 */
import {
    PermissionEnum,
    SocialAuditLogAdminSearchSchema,
    SocialAuditLogSchema
} from '@repo/schemas';
import { ServiceError, SocialAuditLogService } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const auditLogService = new SocialAuditLogService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/audit-log
 * List social audit log — Admin endpoint.
 */
export const adminListSocialAuditLogRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List social audit log (admin)',
    description:
        'Returns a paginated list of semantic audit log entries ordered by createdAt DESC. ' +
        'Supports filtering by entityType, entityId, eventType, actorId, and date range.',
    tags: ['Social Audit Log'],
    requiredPermissions: [PermissionEnum.SOCIAL_AUDIT_LOG_VIEW],
    requestQuery: SocialAuditLogAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: SocialAuditLogSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const q = query as Record<string, unknown> | undefined;

        const result = await auditLogService.list({
            actor,
            filters: {
                page,
                pageSize,
                entityType: q?.entityType as string | undefined,
                entityId: q?.entityId as string | undefined,
                eventType: q?.eventType as string | undefined,
                actorId: q?.actorId as string | undefined,
                createdAtFrom: q?.createdAtFrom as Date | undefined,
                createdAtTo: q?.createdAtTo as Date | undefined
            }
        });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
