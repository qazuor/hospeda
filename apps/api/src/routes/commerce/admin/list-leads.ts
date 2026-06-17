/**
 * Admin commerce leads list endpoint (SPEC-239 T-047)
 *
 * Returns a paginated list of commerce leads for admin review.
 * Requires COMMERCE_VIEW_ALL permission (enforced in the service layer).
 * The admin-panel-access gate is applied by the createAdminListRoute factory
 * (ACCESS_PANEL_ADMIN / ACCESS_API_ADMIN), consistent with other admin list routes.
 *
 * @module routes/commerce/admin/list-leads
 */

import { CommerceLeadSchema, PermissionEnum } from '@repo/schemas';
import { CommerceLeadService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminListRoute } from '../../../utils/route-factory';

const commerceLeadService = new CommerceLeadService({ logger: apiLogger });

/**
 * Query parameters accepted by the admin leads list endpoint.
 * All are optional; omitting them returns all leads (paginated).
 */
const ListLeadsQuerySchema = {
    /** Filter by workflow status (pending | reviewing | approved | rejected). */
    status: z.string().optional(),
    /** Filter by commerce domain (e.g. 'gastronomy'). */
    domain: z.string().optional()
} as const;

/** Typed query after Zod coercion. */
type ListLeadsQuery = {
    status?: string;
    domain?: string;
    page?: number | string;
    pageSize?: number | string;
};

/**
 * GET /api/v1/admin/commerce/leads
 *
 * Lists commerce leads with optional status/domain filters and pagination.
 * Permission: COMMERCE_VIEW_ALL (enforced inside CommerceLeadService.listLeads).
 * Admin-panel access is enforced by the route factory middleware.
 */
export const adminListLeadsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List commerce leads (admin)',
    description:
        'Returns a paginated list of commerce listing leads.  ' +
        'Requires COMMERCE_VIEW_ALL permission.',
    tags: ['Commerce'],
    requiredPermissions: [PermissionEnum.COMMERCE_VIEW_ALL],
    requestQuery: ListLeadsQuerySchema,
    responseSchema: CommerceLeadSchema,
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

        const result = await commerceLeadService.listLeads(actor, {
            status: typedQuery.status,
            domain: typedQuery.domain,
            page,
            pageSize
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
