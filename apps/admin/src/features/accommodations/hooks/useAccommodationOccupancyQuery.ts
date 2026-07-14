/**
 * useAccommodationOccupancyQuery — TanStack Query hook for the admin
 * read-only occupancy calendar (HOS-43 Phase 1).
 *
 * Hits `GET /api/v1/admin/accommodations/:id/occupancy`, gated server-side
 * by `ACCOMMODATION_OCCUPANCY_VIEW` (enforced by `adminAuthMiddleware`'s
 * `requiredPermissions`). Staff may view ANY accommodation's calendar — no
 * ownership scoping, unlike the protected (host-facing) occupancy endpoint.
 */

import type { AccommodationOccupancy } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';
import { accommodationQueryKeys, type OccupancyRangeFilters } from './accommodationQueryKeys';

/** Options accepted by {@link useAccommodationOccupancyQuery}. */
export interface UseAccommodationOccupancyQueryOptions {
    /** Optional half-open `?from&to` range (`YYYY-MM-DD`). Omit for all rows. */
    readonly range?: OccupancyRangeFilters;
    /** Enable/disable the query (defaults to truthy `accommodationId`). */
    readonly enabled?: boolean;
}

/** Shape of the admin occupancy list response envelope. */
interface AdminOccupancyResponseBody {
    readonly data?: {
        readonly occupancy?: AccommodationOccupancy[];
    };
}

/**
 * Fetches the full (or range-scoped) occupancy row set for an accommodation,
 * for the admin read-only calendar view.
 *
 * @param accommodationId - UUID of the accommodation to inspect.
 * @param options - Optional date range and query enable flag.
 * @returns TanStack Query result whose `data` is an `AccommodationOccupancy[]`.
 */
export function useAccommodationOccupancyQuery(
    accommodationId: string,
    options?: UseAccommodationOccupancyQueryOptions
) {
    const { range } = options ?? {};

    return useQuery({
        queryKey: accommodationQueryKeys.occupancy(accommodationId, range),
        queryFn: async (): Promise<AccommodationOccupancy[]> => {
            const searchParams = new URLSearchParams();
            if (range?.from) searchParams.set('from', range.from);
            if (range?.to) searchParams.set('to', range.to);
            const query = searchParams.toString();

            const response = await fetchApi<unknown>({
                path: `/api/v1/admin/accommodations/${accommodationId}/occupancy${query ? `?${query}` : ''}`
            });

            // API returns { success: true, data: { occupancy: AccommodationOccupancy[] } }
            const body = response.data as AdminOccupancyResponseBody;
            return body.data?.occupancy ?? [];
        },
        enabled: options?.enabled ?? Boolean(accommodationId),
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
            // Don't retry on 403 (missing ACCOMMODATION_OCCUPANCY_VIEW) or 404
            if (isApiError(error) && (error.status === 403 || error.status === 404)) {
                return false;
            }
            return failureCount < 3;
        }
    });
}
