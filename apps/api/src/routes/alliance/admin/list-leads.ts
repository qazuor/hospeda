/**
 * Admin alliance leads list endpoint (HOS-277 §6.3)
 *
 * Returns a paginated list of alliance leads for admin review, filterable
 * by `kind` and `status`. Requires ALLIANCE_LEAD_VIEW_ALL permission
 * (enforced in the service layer). The admin-panel-access gate is applied
 * by the createAdminListRoute factory (ACCESS_PANEL_ADMIN / ACCESS_API_ADMIN),
 * consistent with other admin list routes.
 *
 * @module routes/alliance/admin/list-leads
 */

import { AllianceLeadSchema, PermissionEnum } from '@repo/schemas';
import { AllianceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminListRoute } from '../../../utils/route-factory';

const allianceLeadService = new AllianceLeadService({ logger: apiLogger });

/**
 * Query parameters accepted by the admin leads list endpoint.
 * All are optional; omitting them returns all leads (paginated).
 */
const ListLeadsQuerySchema = {
    /** Filter by alliance kind (partner | sponsor | editor | service_provider). */
    kind: z.string().optional(),
    /** Filter by workflow status (pending | reviewing | approved | rejected). */
    status: z.string().optional()
} as const;

/** Typed query after Zod coercion. */
type ListLeadsQuery = {
    kind?: string;
    status?: string;
    page?: number | string;
    pageSize?: number | string;
};

/**
 * GET /api/v1/admin/alliance/leads
 *
 * Lists alliance leads with optional kind/status filters and pagination.
 * Permission: ALLIANCE_LEAD_VIEW_ALL (enforced inside AllianceLeadService.listForAdmin).
 * Admin-panel access is enforced by the route factory middleware.
 */
export const adminListAllianceLeadsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List alliance leads (admin)',
    description:
        'Returns a paginated list of alliance leads (partner/sponsor/editor/' +
        'service_provider). Requires ALLIANCE_LEAD_VIEW_ALL permission.',
    tags: ['Alliance'],
    requiredPermissions: [PermissionEnum.ALLIANCE_LEAD_VIEW_ALL],
    requestQuery: ListLeadsQuerySchema,
    responseSchema: AllianceLeadSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        _body: Record<string, unknown>,
        query?: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const typedQuery = (query ?? {}) as ListLeadsQuery;

        const page = typedQuery.page ? Number(typedQuery.page) : 1;
        const pageSize = typedQuery.pageSize ? Number(typedQuery.pageSize) : 20;

        const result = await allianceLeadService.listForAdmin({
            actor,
            query: {
                kind: typedQuery.kind,
                status: typedQuery.status,
                page,
                pageSize
            }
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const listData = result.data;
        return {
            items: listData?.items ?? [],
            pagination: {
                total: listData?.total ?? 0,
                page,
                pageSize,
                totalPages: Math.ceil((listData?.total ?? 0) / pageSize)
            }
        };
    }
});
