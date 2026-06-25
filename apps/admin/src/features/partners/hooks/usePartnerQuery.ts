import { fetchApi } from '@/lib/api/client';
import type { CreatePartner, Partner, UpdatePartner } from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface PartnerAdminPlanOption {
    readonly id: string;
    readonly slug: string;
    readonly name: string;
    readonly description: string | null;
    readonly monthlyPriceArs: number | null;
}

export const partnerQueryKeys = {
    all: ['partners'] as const,
    lists: () => [...partnerQueryKeys.all, 'list'] as const,
    details: () => [...partnerQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...partnerQueryKeys.details(), id] as const,
    plans: () => [...partnerQueryKeys.all, 'plans'] as const
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

async function fetchPartnerPlans() {
    const result = await fetchApi<{ success: boolean; data: PartnerAdminPlanOption[] }>({
        path: '/api/v1/admin/partners/plans'
    });
    return result.data.data;
}

async function sendPartnerPaymentLink(id: string) {
    const result = await fetchApi<{
        success: boolean;
        data: { paymentUrl: string; planId: string };
    }>({
        path: `/api/v1/admin/partners/${id}/send-link`,
        method: 'POST'
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

export function usePartnerPlansQuery() {
    return useQuery({
        queryKey: partnerQueryKeys.plans(),
        queryFn: fetchPartnerPlans,
        staleTime: 60_000
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

export function useSendPartnerPaymentLinkMutation(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => sendPartnerPaymentLink(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: partnerQueryKeys.detail(id) });
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
