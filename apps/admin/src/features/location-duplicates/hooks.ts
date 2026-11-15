/**
 * @file hooks.ts
 * TanStack Query hooks of the repeated-address report (HOS-1810): the list of
 * groups of published listings sharing a place key, and the mutation that grants
 * a listing an exception (with a reason).
 *
 * @module location-duplicates/hooks
 */

import type { LocationDuplicatesResponse } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** The two verticals the one-address rule covers. */
export type LocationDuplicatesVertical = 'accommodations' | 'venues';

/** Query-key root of the report. */
export const LOCATION_DUPLICATES_QUERY_KEY = ['location-duplicates'] as const;

/**
 * Builds the admin path of the report or of the exception route.
 *
 * @param input.vertical - `accommodations` or `venues`.
 * @param input.id - Listing id, for the exception route only.
 * @returns The `/api/v1/admin/...` path.
 */
export function buildLocationDuplicatesPath({
    vertical,
    id
}: {
    readonly vertical: LocationDuplicatesVertical;
    readonly id?: string;
}): string {
    return id
        ? `/api/v1/admin/${vertical}/${id}/location-exception`
        : `/api/v1/admin/${vertical}/location-duplicates`;
}

/**
 * Reads one page of the report for a vertical.
 *
 * @param input.vertical - `accommodations` or `venues`.
 * @param input.page - 1-based page.
 * @param input.pageSize - Page size.
 * @returns A TanStack Query result.
 */
export function useLocationDuplicatesQuery({
    vertical,
    page,
    pageSize
}: {
    readonly vertical: LocationDuplicatesVertical;
    readonly page: number;
    readonly pageSize: number;
}) {
    return useQuery({
        queryKey: [...LOCATION_DUPLICATES_QUERY_KEY, vertical, page, pageSize],
        queryFn: async () => {
            const response = await fetchApi<{ data: LocationDuplicatesResponse }>({
                path: `${buildLocationDuplicatesPath({ vertical })}?page=${page}&pageSize=${pageSize}`
            });
            return response.data.data;
        }
    });
}

/**
 * Grants a listing an exception. On success the report is refetched (the listing
 * leaves its group).
 *
 * @returns A mutation taking `{ vertical, id, reason }`.
 */
export function useGrantLocationExceptionMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            readonly vertical: LocationDuplicatesVertical;
            readonly id: string;
            readonly reason: string;
        }) => {
            await fetchApi({
                path: buildLocationDuplicatesPath({ vertical: input.vertical, id: input.id }),
                method: 'POST',
                body: { reason: input.reason }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: LOCATION_DUPLICATES_QUERY_KEY });
        }
    });
}
