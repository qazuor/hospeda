import { listPartnerApplicationsForPanel } from '@repo/db';
import type {
    AdminPartnerApplicationPanelQuery,
    AdminPartnerApplicationPanelResponse
} from '@repo/schemas';
import { getPaginationResponse } from '../../utils/pagination';

/** Lists a read-only admin panel page of Partner applications. */
export async function listPartnerApplicationPanel(input: {
    readonly query: AdminPartnerApplicationPanelQuery;
    readonly now: Date;
}): Promise<AdminPartnerApplicationPanelResponse> {
    const result = await listPartnerApplicationsForPanel({
        view: input.query.view,
        now: input.now,
        page: input.query.page,
        pageSize: input.query.pageSize
    });
    return {
        items: result.items.map((item) => ({
            id: item.id,
            email: item.email,
            status: item.status,
            createdAt: new Date(item.createdAt).toISOString(),
            resolvedAt: item.resolvedAt === null ? null : new Date(item.resolvedAt).toISOString(),
            overdue: item.overdue,
            waitEndsAt: item.waitEndsAt === null ? null : new Date(item.waitEndsAt).toISOString(),
            partner: item.partner
        })),
        pagination: getPaginationResponse(result.total, {
            page: input.query.page,
            pageSize: input.query.pageSize
        })
    };
}
