/**
 * @file use-direct-email-suppressions.ts
 * @description TanStack Query hooks for the direct email suppression list (HOS-2685).
 */

import type {
    CreateDirectEmailSuppression,
    DirectEmailSuppression,
    DirectEmailSuppressionReasonEnum
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import {
    buildListQuery,
    type DirectEmailListFilters,
    type DirectEmailPage
} from './use-direct-emails';

const BASE_PATH = '/api/v1/admin/direct-email-suppressions';

/** Filters of the suppression list. */
export interface DirectEmailSuppressionFilters extends DirectEmailListFilters {
    readonly reason?: DirectEmailSuppressionReasonEnum;
}

/** Query key factory for direct email suppressions. */
export const directEmailSuppressionQueryKeys = {
    all: ['direct-email-suppressions'] as const,
    lists: () => [...directEmailSuppressionQueryKeys.all, 'list'] as const,
    list: (filters: DirectEmailSuppressionFilters) =>
        [...directEmailSuppressionQueryKeys.lists(), filters] as const
};

interface Envelope<T> {
    readonly success: boolean;
    readonly data: T;
}

/** Paginated suppression list, optionally filtered by reason. */
export function useDirectEmailSuppressions(filters: DirectEmailSuppressionFilters = {}) {
    return useQuery({
        queryKey: directEmailSuppressionQueryKeys.list(filters),
        queryFn: async () => {
            const result = await fetchApi<Envelope<DirectEmailPage<DirectEmailSuppression>>>({
                path: `${BASE_PATH}${buildListQuery({ filters, extra: { reason: filters.reason } })}`
            });
            return result.data.data;
        },
        staleTime: 15_000
    });
}

/** Adds an address manually (reason `manual`). */
export function useCreateDirectEmailSuppression() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateDirectEmailSuppression) => {
            const result = await fetchApi<Envelope<DirectEmailSuppression>>({
                path: BASE_PATH,
                method: 'POST',
                body: input
            });
            return result.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: directEmailSuppressionQueryKeys.lists() });
        }
    });
}

/** Removes an address from the list (the API answers 204). */
export function useDeleteDirectEmailSuppression() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { readonly id: string }) => {
            await fetchApi<unknown>({ path: `${BASE_PATH}/${input.id}`, method: 'DELETE' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: directEmailSuppressionQueryKeys.lists() });
        }
    });
}
