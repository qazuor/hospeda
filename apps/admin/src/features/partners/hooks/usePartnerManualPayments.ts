import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { partnerQueryKeys } from './usePartnerQuery';

type SubscriptionList = {
    items: Array<{
        id: string;
        status: string;
        vertical: string | null;
        paymentMethod: string | null;
    }>;
};
type SubscriptionDetail = {
    id: string;
    status: string;
    plan?: { planName: string } | null;
    cycle?: string | null;
    price?: { amountMinor: number; currency: string; cycle: string } | null;
};
type Installment = { id: string; periodStart: string; status: string };

const LIVE_STATUSES = new Set([
    'PENDING_AUTHORIZATION',
    'ACTIVE',
    'GRACE_PERIOD',
    'PAUSED',
    'SUSPENDED',
    'CANCEL_SCHEDULED'
]);

function requireSubscriptionId(id: string | undefined): string {
    if (!id) throw new Error('A live Partner subscription is required for this action.');
    return id;
}

/** Reads the live Partner manual subscription and its open installments. */
export function usePartnerManualPayments(partnerId: string, ownerUserId: string) {
    const queryClient = useQueryClient();
    const list = useQuery({
        queryKey: ['partner-manual-subscription', ownerUserId],
        enabled: !!ownerUserId,
        queryFn: async () => {
            const response = await fetchApi<{ success: boolean; data: SubscriptionList }>({
                path: `/api/v1/admin/billing-subscription?page=1&pageSize=100&q=${encodeURIComponent(ownerUserId)}&vertical=partner`
            });
            return (
                response.data.data.items.find(
                    (item) =>
                        item.vertical === 'partner' &&
                        item.paymentMethod === 'MANUAL' &&
                        LIVE_STATUSES.has(item.status)
                ) ?? null
            );
        }
    });
    const subscription = useQuery({
        queryKey: ['partner-manual-subscription-detail', list.data?.id],
        enabled: !!list.data?.id,
        queryFn: async () => {
            const response = await fetchApi<{ success: boolean; data: SubscriptionDetail }>({
                path: `/api/v1/admin/billing-subscription/${requireSubscriptionId(list.data?.id)}/overview`
            });
            return response.data.data;
        }
    });
    const installments = useQuery({
        queryKey: ['partner-manual-installments', list.data?.id],
        enabled: !!list.data?.id,
        queryFn: async () => {
            const response = await fetchApi<{ success: boolean; data: Installment[] }>({
                path: `/api/v1/admin/billing-subscription/${requireSubscriptionId(list.data?.id)}/manual-payments`
            });
            return response.data.data.filter((payment) => payment.status === 'AWAITING');
        }
    });
    const register = useMutation({
        mutationFn: async ({
            manualPaymentId,
            note
        }: {
            manualPaymentId: string;
            note?: string;
        }) => {
            const response = await fetchApi({
                path: `/api/v1/admin/billing-subscription/${requireSubscriptionId(list.data?.id)}/manual-payments/${manualPaymentId}/register`,
                method: 'POST',
                body: { note }
            });
            return response.data;
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ['partner-manual-installments', list.data?.id]
                }),
                queryClient.invalidateQueries({
                    queryKey: ['partner-manual-subscription-detail', list.data?.id]
                }),
                queryClient.invalidateQueries({
                    queryKey: ['partner-manual-subscription', ownerUserId]
                }),
                queryClient.invalidateQueries({ queryKey: partnerQueryKeys.detail(partnerId) })
            ]);
        }
    });
    return {
        isLoading:
            list.isLoading || (!!list.data && (subscription.isLoading || installments.isLoading)),
        isError: list.isError || subscription.isError || installments.isError,
        isRegisterError: register.isError,
        subscription:
            list.data && subscription.data ? { ...subscription.data, id: list.data.id } : null,
        installments: installments.data ?? [],
        register
    };
}
