import type { AccommodationPublic } from '@repo/schemas';
import { accommodationsApi } from '@/lib/api/endpoints';
import type { ApiResult } from '@/lib/api/types';

type ListFilters = Omit<
    NonNullable<Parameters<typeof accommodationsApi.list>[0]>,
    'page' | 'pageSize'
>;

/**
 * Hard ceiling on upstream page reads per map render (100 rows each). The
 * public inventory is far below it; the ceiling bounds the fan-out a crafted
 * filter combination can trigger. Past it the counts cover the pages read.
 */
export const MAP_RESULTS_MAX_PAGES = 10;

interface MapResults {
    readonly items: readonly AccommodationPublic[];
    readonly locatedCount: number;
    readonly unlocatedCount: number;
}

/** Count the complete filtered inventory while retaining only a capped set of located rows. */
export async function loadAccommodationMapResults({
    filters,
    displayCap
}: {
    readonly filters: ListFilters;
    readonly displayCap: number;
}): Promise<ApiResult<MapResults>> {
    const items: AccommodationPublic[] = [];
    let locatedCount = 0;
    let unlocatedCount = 0;
    let totalPages = 1;

    for (let page = 1; page <= Math.min(totalPages, MAP_RESULTS_MAX_PAGES); page += 1) {
        const result = await accommodationsApi.list({ ...filters, page, pageSize: 100 });
        if (!result.ok) return result;
        if (page === 1) totalPages = result.data.pagination.totalPages;

        for (const item of result.data.items) {
            if (item.approximateLocation) {
                locatedCount += 1;
                if (items.length < displayCap) items.push(item);
            } else {
                unlocatedCount += 1;
            }
        }
    }

    return { ok: true, data: { items, locatedCount, unlocatedCount } };
}
