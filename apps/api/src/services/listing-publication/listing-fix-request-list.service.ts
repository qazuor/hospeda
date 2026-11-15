import type { ListingVertical } from '@repo/db';
import { listOpenFixRequests } from '@repo/db';
import type {
    AdminListingFixRequestListQuery,
    AdminListingFixRequestListResponse
} from '@repo/schemas';
import { VerticalEnum } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { getPaginationResponse } from '../../utils/pagination.js';

const VERTICALS: readonly ListingVertical[] = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
];

function daysBetween(from: string, to: string): number {
    const [fromYear, fromMonth, fromDay] = from.split('-').map(Number) as [number, number, number];
    const [toYear, toMonth, toDay] = to.split('-').map(Number) as [number, number, number];
    return (
        (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) /
        86_400_000
    );
}

/** Lists open fix requests and derives overdue and age fields in market-local days. */
export async function listAdminFixRequests(input: {
    readonly query: AdminListingFixRequestListQuery;
    readonly now: Date;
}): Promise<AdminListingFixRequestListResponse> {
    const { query, now } = input;
    const today = getLocalDateString({ instant: now });
    const result = await listOpenFixRequests({
        verticals: query.vertical ? [query.vertical as ListingVertical] : VERTICALS,
        ...(query.ownerReported ? { ownerReported: query.ownerReported === 'yes' } : {}),
        ...(query.overdue === 'true' ? { suggestedBefore: today } : {}),
        page: query.page,
        pageSize: query.pageSize
    });
    return {
        items: result.items.map((row) => ({
            fixRequestId: row.id,
            vertical: row.vertical,
            listingId: row.listingId,
            listingName: row.listingName,
            listingSlug: row.listingSlug,
            publicationStatus:
                row.publicationStatus as AdminListingFixRequestListResponse['items'][number]['publicationStatus'],
            reason: row.reason,
            suggestedDate: row.suggestedDate,
            overdue: row.suggestedDate !== null && row.suggestedDate < today,
            ageDays: daysBetween(getLocalDateString({ instant: row.openedAt }), today),
            openedAt: row.openedAt.toISOString(),
            ownerReportedFixedAt: row.ownerReportedFixedAt?.toISOString() ?? null
        })),
        pagination: getPaginationResponse(result.total, {
            page: query.page,
            pageSize: query.pageSize
        })
    };
}
