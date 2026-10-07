import type { CreatePartner, Partner, UpdatePartner } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

export const partnerQueryKeys = {
    all: ['partners'] as const,
    lists: () => [...partnerQueryKeys.all, 'list'] as const,
    details: () => [...partnerQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...partnerQueryKeys.details(), id] as const
};

async function fetchPartner(id: string) {
    const result = await fetchApi<{ success: boolean; data: Partner }>({
        path: `/api/v1/admin/partners/${id}`
    });
    return result.data.data;
}

async function createPartner(data: CreatePartner) {
    const result = await fetchApi<{ success: boolean; data: Partner }>({
        path: '/api/v1/admin/partners',
        method: 'POST',
        body: data
    });
    return result.data.data;
}

async function updatePartner(id: string, data: UpdatePartner) {
    const result = await fetchApi<{ success: boolean; data: Partner }>({
        path: `/api/v1/admin/partners/${id}`,
        method: 'PUT',
        body: data
    });
    return result.data.data;
}

async function registerPartnerManualPayment(id: string, note?: string) {
    const result = await fetchApi<{ success: boolean; data: Partner }>({
        path: `/api/v1/admin/partners/${id}/manual-payment`,
        method: 'POST',
        body: { note }
    });
    return result.data.data;
}

export function usePartnerQuery(id: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: partnerQueryKeys.detail(id),
        queryFn: () => fetchPartner(id),
        enabled: options?.enabled !== false && !!id,
        staleTime: 30_000
    });
}

export function useCreatePartnerMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreatePartner) => createPartner(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: partnerQueryKeys.lists() });
        }
    });
}

export function useUpdatePartnerMutation(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: UpdatePartner) => updatePartner(id, data),
        onSuccess: (updated) => {
            queryClient.setQueryData(partnerQueryKeys.detail(id), updated);
            queryClient.invalidateQueries({ queryKey: partnerQueryKeys.lists() });
        }
    });
}

export function useRegisterPartnerManualPaymentMutation(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ note }: { readonly note?: string }) =>
            registerPartnerManualPayment(id, note),
        onSuccess: (updated) => {
            queryClient.setQueryData(partnerQueryKeys.detail(id), updated);
            queryClient.invalidateQueries({ queryKey: partnerQueryKeys.lists() });
        }
    });
}
