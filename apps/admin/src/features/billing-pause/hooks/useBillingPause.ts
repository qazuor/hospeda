import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Administrative pause preview returned by action 9. */
export interface PausePreview {
    readonly subject?: {
        readonly id: string;
        readonly displayName?: string;
        readonly email?: string;
    };
    readonly currentPlan?: { readonly planName: string; readonly cycle: string };
    readonly subscriptionId: string;
    readonly status: string;
    readonly offered: boolean;
    readonly reason?: string;
    readonly courtesyEndsAt?: string;
    readonly months?: { readonly min: 1; readonly max: number };
    readonly expectedEndAtByMonths?: Readonly<Record<string, string>>;
    readonly addons?: {
        readonly vertical: readonly string[];
        readonly account: readonly { readonly name: string; readonly pauses: boolean }[];
    };
    readonly quota: { readonly pausesLeft: number; readonly monthsLeft: number };
    readonly openPause: {
        readonly reason: 'CUSTOMER_REQUEST' | 'COURTESY';
        readonly expectedEndAt: string | null;
    } | null;
}

/** Action 9 preview endpoint. */
export function pausePreviewPath({ subscriptionId }: { readonly subscriptionId: string }): string {
    return `/api/v1/admin/billing-subscription/${subscriptionId}/pause-preview`;
}

/** Reads pause eligibility and any open customer-request pause. */
export function useBillingPausePreview({
    subscriptionId,
    enabled
}: {
    readonly subscriptionId: string;
    readonly enabled: boolean;
}) {
    return useQuery({
        queryKey: ['billing-subscription', 'pause-preview', subscriptionId],
        queryFn: async (): Promise<PausePreview> => {
            const response = await fetchApi<{ data: PausePreview }>({
                path: pausePreviewPath({ subscriptionId })
            });
            const inspection = await fetchApi<{
                data: {
                    subject?: PausePreview['subject'];
                    currentPlan?: PausePreview['currentPlan'];
                };
            }>({
                path: `/api/v1/admin/billing-subscription/${subscriptionId}`
            });
            return { ...response.data.data, ...inspection.data.data };
        },
        enabled: enabled && subscriptionId.length > 0,
        retry: false
    });
}

/** Confirmed administrative pause or early resume input. */
export interface PauseActionInput {
    readonly subscriptionId: string;
    readonly act: 'pause' | 'resume';
    readonly expectedStatus: 'ACTIVE' | 'PAUSED';
    readonly months?: number;
}

/** Sends an explicitly confirmed action 9 mutation. */
export function useBillingPauseAction() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ subscriptionId, act, expectedStatus, months }: PauseActionInput) => {
            const response = await fetchApi<{
                data: {
                    readonly outcome: string;
                    readonly expectedEndAt?: string;
                    readonly nextCharge?: {
                        readonly at: string;
                        readonly amountMinor: number;
                        readonly currency: string;
                    } | null;
                };
            }>({
                path: `/api/v1/admin/billing-subscription/${subscriptionId}/${act}`,
                method: 'POST',
                body: { confirmed: true, expectedStatus, ...(act === 'pause' ? { months } : {}) }
            });
            return response.data.data;
        },
        onSettled: (_result, _error, { subscriptionId }) =>
            queryClient.invalidateQueries({
                queryKey: ['billing-subscription', 'pause-preview', subscriptionId]
            })
    });
}
