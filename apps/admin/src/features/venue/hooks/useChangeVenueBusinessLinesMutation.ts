/**
 * @file useChangeVenueBusinessLinesMutation.ts
 * Mutation for administrative action 27 (ACC:27, HOS-1875): change the business
 * lines of somebody else's venue listing.
 *
 * It calls the dedicated `PATCH /api/v1/admin/venues/{id}/business-lines`. The
 * general admin PATCH stays action 15 and keeps rejecting `businessLines`, so
 * this is the only path a support member or admin has to change a foreign
 * listing's classification. The server records the change on the listing's
 * timeline and notifies the owner.
 *
 * @module useChangeVenueBusinessLinesMutation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { createEntityQueryKeys } from '@/lib/query-keys/factory';

/** The venue query root the hooks factory uses (`entityName: 'venues'`). */
const venueQueryKeys = createEntityQueryKeys('venues');

/** Input of the action 27 mutation. RO-RO. */
export interface ChangeVenueBusinessLinesInput {
    /** UUID of the venue listing whose classification changes. */
    readonly id: string;
    /** The new selection; the server validates it against the venue's type. */
    readonly businessLines: readonly string[];
}

/**
 * Builds the admin path of the business-lines route for one venue.
 *
 * @param input.id - UUID of the venue listing.
 * @returns The `/api/v1/admin/venues/{id}/business-lines` path.
 */
export function buildChangeVenueBusinessLinesPath({ id }: { readonly id: string }): string {
    return `/api/v1/admin/venues/${id}/business-lines`;
}

/**
 * Mutation hook for action 27. On success it invalidates the venue detail and
 * every list, the same caches the general update invalidates.
 *
 * @returns A TanStack Query mutation taking {@link ChangeVenueBusinessLinesInput}.
 */
export function useChangeVenueBusinessLinesMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, businessLines }: ChangeVenueBusinessLinesInput) => {
            const response = await fetchApi<{ data?: unknown }>({
                path: buildChangeVenueBusinessLinesPath({ id }),
                method: 'PATCH',
                body: { businessLines }
            });
            return response.data;
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: venueQueryKeys.detail(variables.id) });
            queryClient.invalidateQueries({ queryKey: venueQueryKeys.lists() });
        }
    });
}
