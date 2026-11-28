/**
 * @file use-direct-emails.ts
 * @description TanStack Query hooks for the admin direct email API (HOS-2685):
 * history list and detail, preview, recipient check, test send and send.
 */

import type {
    CheckDirectEmailRecipientsResponse,
    DirectEmailMessageDetail,
    DirectEmailMessageListItem,
    PreviewDirectEmailRequest,
    PreviewDirectEmailResponse,
    SendDirectEmailRequest,
    SendDirectEmailResponse,
    TestSendDirectEmailRequest,
    TestSendDirectEmailResponse
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

const BASE_PATH = '/api/v1/admin/direct-emails';

/** Query key factory for direct email messages. */
export const directEmailQueryKeys = {
    all: ['direct-emails'] as const,
    lists: () => [...directEmailQueryKeys.all, 'list'] as const,
    list: (filters: DirectEmailListFilters) => [...directEmailQueryKeys.lists(), filters] as const,
    details: () => [...directEmailQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...directEmailQueryKeys.details(), id] as const
};

/** Filters accepted by the history list endpoint. */
export interface DirectEmailListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    /** Partial subject match. */
    readonly search?: string;
}

/** Paginated envelope returned by the list endpoint. */
export interface DirectEmailPage<T> {
    readonly items: ReadonlyArray<T>;
    readonly pagination: {
        readonly page: number;
        readonly pageSize: number;
        readonly total: number;
        readonly totalPages: number;
    };
}

interface Envelope<T> {
    readonly success: boolean;
    readonly data: T;
}

/**
 * Builds the `?page=&pageSize=&search=` query string for a list call.
 *
 * @param input.filters - List filters; empty values are omitted.
 * @param input.extra - Additional string params (for example `reason`).
 * @returns The query string with a leading `?`, or an empty string.
 */
export function buildListQuery({
    filters,
    extra = {}
}: {
    readonly filters: DirectEmailListFilters;
    readonly extra?: Readonly<Record<string, string | undefined>>;
}): string {
    const params = new URLSearchParams();
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
    if (filters.search) params.set('search', filters.search);
    for (const [key, value] of Object.entries(extra)) {
        if (value) params.set(key, value);
    }
    const query = params.toString();
    return query ? `?${query}` : '';
}

/** Paginated history of sent direct emails. */
export function useDirectEmails(filters: DirectEmailListFilters = {}) {
    return useQuery({
        queryKey: directEmailQueryKeys.list(filters),
        queryFn: async () => {
            const result = await fetchApi<Envelope<DirectEmailPage<DirectEmailMessageListItem>>>({
                path: `${BASE_PATH}${buildListQuery({ filters })}`
            });
            return result.data.data;
        },
        staleTime: 30_000
    });
}

/** One sent message with each recipient's status. */
export function useDirectEmail(id: string) {
    return useQuery({
        queryKey: directEmailQueryKeys.detail(id),
        queryFn: async () => {
            const result = await fetchApi<Envelope<DirectEmailMessageDetail>>({
                path: `${BASE_PATH}/${id}`
            });
            return result.data.data;
        },
        enabled: !!id,
        staleTime: 30_000
    });
}

/**
 * Server-rendered preview (the exact HTML the recipient gets).
 *
 * A mutation rather than a query: it is a POST with a body and is driven by a
 * debounced editor state, not by a cache key.
 */
export function usePreviewDirectEmail() {
    return useMutation({
        mutationFn: async (input: PreviewDirectEmailRequest) => {
            const result = await fetchApi<Envelope<PreviewDirectEmailResponse>>({
                path: `${BASE_PATH}/preview`,
                method: 'POST',
                body: input
            });
            return result.data.data;
        }
    });
}

/** Asks the API which of the given addresses are on the suppression list. */
export function useCheckDirectEmailRecipients() {
    return useMutation({
        mutationFn: async (input: { readonly emails: ReadonlyArray<string> }) => {
            const result = await fetchApi<Envelope<CheckDirectEmailRecipientsResponse>>({
                path: `${BASE_PATH}/check-recipients`,
                method: 'POST',
                body: { emails: input.emails }
            });
            return result.data.data;
        }
    });
}

/** Sends a `[PRUEBA]` copy to one address. Creates no history row. */
export function useTestSendDirectEmail() {
    return useMutation({
        mutationFn: async (input: TestSendDirectEmailRequest) => {
            const result = await fetchApi<Envelope<TestSendDirectEmailResponse>>({
                path: `${BASE_PATH}/test-send`,
                method: 'POST',
                body: input
            });
            return result.data.data;
        }
    });
}

/** Sends the message, one mail per recipient, and returns the per-recipient results. */
export function useSendDirectEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: SendDirectEmailRequest) => {
            const result = await fetchApi<Envelope<SendDirectEmailResponse>>({
                path: BASE_PATH,
                method: 'POST',
                body: input
            });
            return result.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: directEmailQueryKeys.lists() });
        },
        // A failed request may still have sent (a proxy timeout cuts the response, not the
        // batch): refresh the history so the admin can check it before retrying.
        onError: () => {
            queryClient.invalidateQueries({ queryKey: directEmailQueryKeys.lists() });
        }
    });
}
