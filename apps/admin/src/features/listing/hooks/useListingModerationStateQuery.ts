import { ListingModerationStateSchema } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import {
    PURGE_LISTING_PLURAL,
    type PurgeListingVertical
} from './usePurgeListingOnRequestMutation';

/**
 * Builds the admin moderation-state endpoint for a listing.
 *
 * @param args.vertical - Listing vertical used by the admin API.
 * @param args.id - Listing UUID.
 * @returns The moderation-state request path.
 */
export function buildListingModerationStatePath({
    vertical,
    id
}: {
    readonly vertical: PurgeListingVertical;
    readonly id: string;
}): string {
    return `/api/v1/admin/${PURGE_LISTING_PLURAL[vertical]}/${id}/moderation`;
}

/**
 * Reads and validates a listing's moderation state through TanStack Query.
 *
 * @param args.vertical - Listing vertical used by the admin API.
 * @param args.id - Listing UUID.
 * @returns The query result containing the validated moderation state.
 */
export function useListingModerationStateQuery({
    vertical,
    id
}: {
    readonly vertical: PurgeListingVertical;
    readonly id: string;
}) {
    return useQuery({
        queryKey: [
            vertical === 'venue' ? 'gastronomies' : PURGE_LISTING_PLURAL[vertical],
            id,
            'moderation'
        ],
        queryFn: async () => {
            const response = await fetchApi<{ data?: unknown }>({
                path: buildListingModerationStatePath({ vertical, id }),
                method: 'GET'
            });
            return ListingModerationStateSchema.parse(response.data.data);
        }
    });
}
