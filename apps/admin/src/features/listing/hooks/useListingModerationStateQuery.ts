import { ListingModerationStateSchema } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import {
    PURGE_LISTING_PLURAL,
    type PurgeListingVertical
} from './usePurgeListingOnRequestMutation';

export function buildListingModerationStatePath({
    vertical,
    id
}: {
    readonly vertical: PurgeListingVertical;
    readonly id: string;
}): string {
    return `/api/v1/admin/${PURGE_LISTING_PLURAL[vertical]}/${id}/moderation`;
}

export function useListingModerationStateQuery({
    vertical,
    id
}: {
    readonly vertical: PurgeListingVertical;
    readonly id: string;
}) {
    return useQuery({
        queryKey: [PURGE_LISTING_PLURAL[vertical], id, 'moderation'],
        queryFn: async () => {
            const response = await fetchApi<{ data?: unknown }>({
                path: buildListingModerationStatePath({ vertical, id }),
                method: 'GET'
            });
            return ListingModerationStateSchema.parse(response.data.data);
        }
    });
}
