import { fetchApi } from '@/lib/api/client';
import type { CreateHostTrade, HostTrade, UpdateHostTrade } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Query key factory for host-trade queries.
 */
export const hostTradeQueryKeys = {
    all: ['host-trades'] as const,
    lists: () => [...hostTradeQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...hostTradeQueryKeys.lists(), filters] as const,
    details: () => [...hostTradeQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...hostTradeQueryKeys.details(), id] as const
};

/** Fetches a single host-trade entry by ID from the admin API. */
async function fetchHostTrade(id: string): Promise<HostTrade> {
    const result = await fetchApi<{ success: boolean; data: { hostTrade: HostTrade } }>({
        path: `/api/v1/admin/host-trades/${id}`
    });
    return result.data.data.hostTrade;
}

/** Creates a new host-trade entry via the admin API. */
async function createHostTrade(data: CreateHostTrade): Promise<HostTrade> {
    const result = await fetchApi<{ success: boolean; data: { hostTrade: HostTrade } }>({
        path: '/api/v1/admin/host-trades',
        method: 'POST',
        body: data
    });
    return result.data.data.hostTrade;
}

/** Partially updates an existing host-trade entry via the admin API. */
async function updateHostTrade(id: string, data: UpdateHostTrade): Promise<HostTrade> {
    const result = await fetchApi<{ success: boolean; data: { hostTrade: HostTrade } }>({
        path: `/api/v1/admin/host-trades/${id}`,
        method: 'PATCH',
        body: data
    });
    return result.data.data.hostTrade;
}

/** Soft-deletes a host-trade entry via the admin API. */
async function deleteHostTrade(id: string): Promise<boolean> {
    await fetchApi<{ success: boolean }>({
        path: `/api/v1/admin/host-trades/${id}`,
        method: 'DELETE'
    });
    return true;
}

/** Restores a soft-deleted host-trade entry via the admin API. */
async function restoreHostTrade(id: string): Promise<HostTrade> {
    const result = await fetchApi<{ success: boolean; data: { hostTrade: HostTrade } }>({
        path: `/api/v1/admin/host-trades/${id}/restore`,
        method: 'POST',
        body: {}
    });
    return result.data.data.hostTrade;
}

/**
 * Hook to fetch a single host-trade entry by ID.
 */
export const useHostTradeQuery = (id: string, options?: { enabled?: boolean }) => {
    return useQuery({
        queryKey: hostTradeQueryKeys.detail(id),
        queryFn: () => fetchHostTrade(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
};

/**
 * Hook to create a new host-trade entry.
 * Invalidates the list cache on success.
 */
export const useCreateHostTradeMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateHostTrade) => createHostTrade(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: hostTradeQueryKeys.lists() });
        }
    });
};

/**
 * Hook to update an existing host-trade entry.
 * Updates the detail cache and invalidates the list cache on success.
 */
export const useUpdateHostTradeMutation = (id: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: UpdateHostTrade) => updateHostTrade(id, data),
        onSuccess: (updatedData) => {
            queryClient.setQueryData(hostTradeQueryKeys.detail(id), updatedData);
            queryClient.invalidateQueries({ queryKey: hostTradeQueryKeys.lists() });
        }
    });
};

/**
 * Hook to soft-delete a host-trade entry.
 * Removes the entry from the detail cache and invalidates the list cache on success.
 */
export const useDeleteHostTradeMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteHostTrade(id),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: hostTradeQueryKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: hostTradeQueryKeys.lists() });
        }
    });
};

/**
 * Hook to restore a soft-deleted host-trade entry.
 * Updates the detail cache and invalidates the list cache on success.
 */
export const useRestoreHostTradeMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => restoreHostTrade(id),
        onSuccess: (restoredData) => {
            queryClient.setQueryData(hostTradeQueryKeys.detail(restoredData.id), restoredData);
            queryClient.invalidateQueries({ queryKey: hostTradeQueryKeys.lists() });
        }
    });
};
