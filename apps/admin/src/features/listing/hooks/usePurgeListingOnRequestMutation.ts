/**
 * @file usePurgeListingOnRequestMutation.ts
 * Mutation for administrative action 23 (HOS-1493): purge a foreign listing at
 * its owner's request, with a mandatory reason.
 *
 * Calls `POST /api/v1/admin/{plural}/{id}/purge` with `{ reason }`. The server
 * runs the listing purge transition over the listing (its lock, the content
 * wipe, the billing push and the confirmation mail) and records the admin as
 * actor, the owner as subject and the reason.
 *
 * @module usePurgeListingOnRequestMutation
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** The three listing verticals the purge route exists for. */
export type PurgeListingVertical = 'accommodation' | 'gastronomy' | 'experience';

/**
 * Admin API plural per vertical. Also the root of each vertical's query cache
 * in the panel, so the same value invalidates the listing's queries.
 */
export const PURGE_LISTING_PLURAL: Readonly<Record<PurgeListingVertical, string>> = {
    accommodation: 'accommodations',
    gastronomy: 'gastronomies',
    experience: 'experiences'
};

/** Input of the action 23 mutation. RO-RO. */
export interface PurgeListingOnRequestInput {
    /** Vertical of the listing. */
    readonly vertical: PurgeListingVertical;
    /** UUID of the listing to purge. */
    readonly id: string;
    /** Why the owner asked for it; it is kept in the audit log. */
    readonly reason: string;
}

/** Body the purge route answers on success. */
export interface PurgeListingOnRequestResult {
    /** Always `true` when the route answers 200. */
    readonly purged: boolean;
}

/**
 * Builds the admin path of the purge route for one listing.
 *
 * @param input - The listing's vertical and id.
 * @returns The `/api/v1/admin/{plural}/{id}/purge` path.
 */
export function buildPurgeListingPath({
    vertical,
    id
}: {
    readonly vertical: PurgeListingVertical;
    readonly id: string;
}): string {
    return `/api/v1/admin/${PURGE_LISTING_PLURAL[vertical]}/${id}/purge`;
}

/**
 * Mutation hook for action 23. On success it invalidates every cached query of
 * the listing's vertical (detail and lists), since the listing is now `PURGED`.
 *
 * @returns A TanStack Query mutation taking {@link PurgeListingOnRequestInput}.
 */
export function usePurgeListingOnRequestMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            vertical,
            id,
            reason
        }: PurgeListingOnRequestInput): Promise<PurgeListingOnRequestResult> => {
            const response = await fetchApi<{ data?: PurgeListingOnRequestResult }>({
                path: buildPurgeListingPath({ vertical, id }),
                method: 'POST',
                body: { reason }
            });
            return { purged: response.data.data?.purged === true };
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [PURGE_LISTING_PLURAL[variables.vertical]]
            });
        }
    });
}
