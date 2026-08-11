/**
 * usePartnerMentions — TanStack Query hooks for the partner mentions log (HOS-377 T-022).
 *
 * Exposes:
 *  - usePartnerMentionsQuery(partnerId)      → list query
 *  - useCreatePartnerMentionsMutation(id)    → BATCH create (N channels, one request)
 *  - useUpdatePartnerMentionMutation(id)     → correct one mention
 *  - useDeletePartnerMentionMutation(id)     → soft-delete one mention
 *
 * Every mutation invalidates the list. The create mutation deliberately takes
 * the WHOLE submission rather than a single mention: N channels are one request
 * that produces one `batchId` and one email to the partner, so a per-channel
 * mutation here would push the caller into the four-emails-per-campaign bug the
 * API is shaped to prevent (AC-7 / AC-9).
 */

import type {
    CreatePartnerMentionBatch,
    PartnerMention,
    UpdatePartnerMention
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Filters the admin list route accepts. `partnerId` is NOT one — it lives in the path. */
export interface PartnerMentionListFilters {
    readonly channel?: string;
    readonly batchId?: string;
    readonly page?: number;
    /** Admin pagination is `page`+`pageSize`; the route rejects `limit`. */
    readonly pageSize?: number;
}

export const partnerMentionQueryKeys = {
    all: (partnerId: string) => ['partner-mentions', partnerId] as const,
    list: (partnerId: string, filters?: PartnerMentionListFilters) =>
        [...partnerMentionQueryKeys.all(partnerId), 'list', filters ?? {}] as const
};

const mentionsEndpoint = (partnerId: string) => `/api/v1/admin/partners/${partnerId}/mentions`;

/**
 * Builds the query string from the declared filters only.
 *
 * Anything the admin search schema does not declare is rejected by
 * `createAdminListRoute`, so sending an undeclared parameter fails the request
 * rather than being quietly ignored — which is why this is an allowlist rather
 * than a spread of whatever the caller passed.
 */
function buildListQuery(filters?: PartnerMentionListFilters): string {
    const params = new URLSearchParams();
    if (filters?.channel) params.set('channel', filters.channel);
    if (filters?.batchId) params.set('batchId', filters.batchId);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
    const query = params.toString();
    return query ? `?${query}` : '';
}

/**
 * One partner's mentions log, newest promotion first.
 *
 * Includes `internalNote` — this is the admin surface. The partner-facing
 * endpoint strips it server-side, so the two payloads are genuinely different
 * and neither depends on the UI hiding a field.
 */
export function usePartnerMentionsQuery(partnerId: string, filters?: PartnerMentionListFilters) {
    return useQuery({
        queryKey: partnerMentionQueryKeys.list(partnerId, filters),
        queryFn: async () => {
            const response = await fetchApi<unknown>({
                path: `${mentionsEndpoint(partnerId)}${buildListQuery(filters)}`
            });
            const body = response.data as {
                data?: { items?: PartnerMention[]; pagination?: { total: number } };
            };
            return {
                items: body.data?.items ?? [],
                total: body.data?.pagination?.total ?? 0
            };
        },
        enabled: Boolean(partnerId),
        staleTime: 30_000
    });
}

/**
 * Logs ONE submission across N channels.
 *
 * Takes the whole batch because the server writes N rows in one transaction
 * under one generated `batchId` and sends exactly one email. `partnerId` is not
 * part of the body: it comes from the path, which is the authoritative scope.
 */
export function useCreatePartnerMentionsMutation(partnerId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: CreatePartnerMentionBatch) => {
            const response = await fetchApi<unknown>({
                path: mentionsEndpoint(partnerId),
                method: 'POST',
                body: payload
            });
            const body = response.data as { data?: { mentions?: PartnerMention[] } };
            const mentions = body.data?.mentions;
            if (!mentions) {
                throw new Error(
                    'Partner mention create response did not include the expected data.mentions payload'
                );
            }
            return mentions;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: partnerMentionQueryKeys.all(partnerId) });
        }
    });
}

/** Corrects one already-logged mention. */
export function useUpdatePartnerMentionMutation(partnerId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            mentionId,
            payload
        }: {
            readonly mentionId: string;
            readonly payload: UpdatePartnerMention;
        }) => {
            const response = await fetchApi<unknown>({
                path: `${mentionsEndpoint(partnerId)}/${mentionId}`,
                method: 'PATCH',
                body: payload
            });
            const body = response.data as { data?: PartnerMention };
            const mention = body.data;
            if (!mention) {
                throw new Error(
                    'Partner mention update response did not include the expected data payload'
                );
            }
            return mention;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: partnerMentionQueryKeys.all(partnerId) });
        }
    });
}

/**
 * Removes one mistakenly logged mention.
 *
 * Soft only — the server never hard-deletes here, so the row survives with the
 * remover recorded on it.
 */
export function useDeletePartnerMentionMutation(partnerId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (mentionId: string) => {
            await fetchApi({
                path: `${mentionsEndpoint(partnerId)}/${mentionId}`,
                method: 'DELETE'
            });
            return mentionId;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: partnerMentionQueryKeys.all(partnerId) });
        }
    });
}
