import type {
    AdminSubscriptionPlanChangeOptionsResponse,
    AdminSubscriptionPlanChangeResponse
} from '@repo/schemas';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

export interface PlanChangeInspection {
    readonly status: string;
    readonly billingOptionId: string | null;
    readonly subject?: {
        readonly id: string;
        readonly displayName?: string;
        readonly email?: string;
    };
    readonly currentPlan?: {
        readonly planName: string;
        readonly versionLabel?: string;
        readonly cycle: string;
    };
}

export function planChangeOptionsPath(subscriptionId: string): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}/plan-change-options`;
}

export function useBillingPlanChangeData(subscriptionId: string, enabled: boolean) {
    return useQuery({
        queryKey: ['billing-subscription', 'plan-change-options', subscriptionId],
        enabled,
        retry: false,
        queryFn: async () => {
            const [inspection, options] = await Promise.all([
                fetchApi<{ data: PlanChangeInspection }>({
                    path: `/api/v1/admin/billing-subscription/${subscriptionId}`
                }),
                fetchApi<{ data: AdminSubscriptionPlanChangeOptionsResponse }>({
                    path: planChangeOptionsPath(subscriptionId)
                })
            ]);
            return { inspection: inspection.data.data, options: options.data.data };
        }
    });
}

export function useBillingPlanChangeAction() {
    return useMutation({
        mutationFn: async (input: {
            readonly subscriptionId: string;
            readonly billingOptionId: string;
            readonly expectedStatus: 'ACTIVE';
            readonly note?: string;
        }): Promise<AdminSubscriptionPlanChangeResponse> => {
            const response = await fetchApi<{ data: AdminSubscriptionPlanChangeResponse }>({
                path: `/api/v1/admin/billing-subscription/${input.subscriptionId}/plan-change`,
                method: 'POST',
                body: {
                    billingOptionId: input.billingOptionId,
                    expectedStatus: input.expectedStatus,
                    confirmed: true,
                    ...(input.note ? { note: input.note } : {})
                }
            });
            return response.data.data;
        }
    });
}
