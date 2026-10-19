import type {
    AdminPromoCode,
    AdminPromoCodeCloseResponse,
    AdminPromoCodeCreateRequest
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

type PromoCodeListResponse = {
    readonly items: AdminPromoCode[];
    readonly pagination: {
        readonly page: number;
        readonly pageSize: number;
        readonly total: number;
        readonly totalPages: number;
    };
};

const promoCodesQueryKey = ['billing-promo-codes'] as const;

/** Reads one page of promo codes and the API-resolved availability values. */
export function usePromoCodes({
    page,
    pageSize
}: {
    readonly page: number;
    readonly pageSize: number;
}) {
    return useQuery({
        queryKey: [...promoCodesQueryKey, page, pageSize],
        queryFn: async (): Promise<PromoCodeListResponse> => {
            const response = await fetchApi<{ data: PromoCodeListResponse }>({
                path: `/api/v1/admin/billing-promo-codes?page=${page}&pageSize=${pageSize}`
            });
            return response.data.data;
        },
        retry: false
    });
}

/** Creates a promo code and invalidates every cached page after success. */
export function useCreatePromoCodeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (body: AdminPromoCodeCreateRequest): Promise<AdminPromoCode> => {
            const response = await fetchApi<{ data: AdminPromoCode }>({
                path: '/api/v1/admin/billing-promo-codes',
                method: 'POST',
                body
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: promoCodesQueryKey })
    });
}

/** Closes one promo code and invalidates every cached page after success. */
export function useClosePromoCodeMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({
            promoCodeId
        }: {
            readonly promoCodeId: string;
        }): Promise<AdminPromoCodeCloseResponse> => {
            const response = await fetchApi<{ data: AdminPromoCodeCloseResponse }>({
                path: `/api/v1/admin/billing-promo-codes/${promoCodeId}/close`,
                method: 'POST'
            });
            return response.data.data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: promoCodesQueryKey })
    });
}
