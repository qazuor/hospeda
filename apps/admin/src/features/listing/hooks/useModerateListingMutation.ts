/**
 * @file useModerateListingMutation.ts
 * Mutation for the administrative listing moderation (HOS-1684): one ACTION
 * with its reason — `REQUEST_FIX`, `TAKE_DOWN`, `LIFT` or `CLOSE_FIX_REQUEST`.
 *
 * Calls `POST /api/v1/admin/{plural}/{id}/moderate` (HOS-1475) with the
 * `ListingModerationAction` body as given, and validates the answer against
 * `ListingModerationResponseSchema`: a malformed answer rejects the mutation
 * instead of showing a state the API never returned. Gated server-side by the
 * single moderation permission.
 *
 * @module useModerateListingMutation
 */

import {
    type ListingModerationAction,
    type ListingModerationResponse,
    ListingModerationResponseSchema
} from '@repo/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import {
    PURGE_LISTING_PLURAL,
    type PurgeListingVertical
} from './usePurgeListingOnRequestMutation';

/** Input of the moderation mutation. RO-RO. */
export interface ModerateListingInput {
    /** Vertical of the listing. */
    readonly vertical: PurgeListingVertical;
    /** UUID of the listing. */
    readonly id: string;
    /** The action and its reason, sent untouched. */
    readonly body: ListingModerationAction;
}

/**
 * Builds the admin path of the moderation route for one listing.
 *
 * @param input - The listing's vertical and id.
 * @returns The `/api/v1/admin/{plural}/{id}/moderate` path.
 */
export function buildModerateListingPath({
    vertical,
    id
}: {
    readonly vertical: PurgeListingVertical;
    readonly id: string;
}): string {
    return `/api/v1/admin/${PURGE_LISTING_PLURAL[vertical]}/${id}/moderate`;
}

/**
 * Mutation hook for the moderation actions. On success it invalidates every
 * cached query of the listing's vertical (detail and lists), since its state
 * or its fix request changed.
 *
 * @returns A TanStack Query mutation taking {@link ModerateListingInput} and
 *   resolving to the `{ publicationStatus, fixRequestOpen }` the API returned.
 */
export function useModerateListingMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            vertical,
            id,
            body
        }: ModerateListingInput): Promise<ListingModerationResponse> => {
            const response = await fetchApi<{ data?: unknown }>({
                path: buildModerateListingPath({ vertical, id }),
                method: 'POST',
                body
            });
            return ListingModerationResponseSchema.parse(response.data.data);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: [PURGE_LISTING_PLURAL[variables.vertical]]
            });
        }
    });
}
