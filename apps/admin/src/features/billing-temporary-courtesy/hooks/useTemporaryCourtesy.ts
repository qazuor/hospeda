import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** Preview of granting or extending temporary courtesy. */
export interface CourtesyGrantPreview {
    readonly subscriptionId: string;
    readonly status: 'ACTIVE' | 'PAUSED' | null;
    readonly cycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual' | null;
    readonly offered: boolean;
    readonly reason?: string;
    readonly alternatives?: readonly ['PERMANENT_GRANT', 'RENEWAL_PROMO'];
    readonly liveCourtesy: {
        readonly courtesyGrantId: string;
        readonly endsAt: string;
        readonly remainingMonths: number;
    } | null;
    readonly months: number;
    readonly endsAt: string;
    readonly subject?: {
        readonly id: string;
        readonly displayName?: string;
        readonly email?: string;
    };
}

/** Preview of revoking a live temporary courtesy. */
export interface CourtesyRevokePreview {
    readonly subscriptionId: string;
    readonly status: 'PAUSED' | 'ACTIVE' | null;
    readonly inForce: boolean;
    readonly courtesy: {
        readonly courtesyGrantId: string;
        readonly endsAt: string;
        readonly remainingMonths: number;
    } | null;
    readonly predictedNextChargeAt: string | null;
}

/** Reads S9/S34 eligibility and the inspected customer. */
export function useCourtesyGrantPreview({
    subscriptionId,
    months,
    enabled
}: {
    readonly subscriptionId: string;
    readonly months: number;
    readonly enabled: boolean;
}) {
    return useQuery({
        queryKey: ['billing-subscription', 'courtesy-grant-preview', subscriptionId, months],
        queryFn: async (): Promise<CourtesyGrantPreview> => {
            const preview = await fetchApi<{ data: CourtesyGrantPreview }>({
                path: `/api/v1/admin/billing-subscription/${subscriptionId}/courtesy/grant-preview?months=${months}`
            });
            const inspection = await fetchApi<{ data: Pick<CourtesyGrantPreview, 'subject'> }>({
                path: `/api/v1/admin/billing-subscription/${subscriptionId}`
            });
            return { ...preview.data.data, subject: inspection.data.data.subject };
        },
        enabled,
        retry: false
    });
}

/** Reads S10 effects before confirmation. */
export function useCourtesyRevokePreview({
    subscriptionId,
    enabled
}: {
    readonly subscriptionId: string;
    readonly enabled: boolean;
}) {
    return useQuery({
        queryKey: ['billing-subscription', 'courtesy-revoke-preview', subscriptionId],
        queryFn: async (): Promise<CourtesyRevokePreview> => {
            const response = await fetchApi<{ data: CourtesyRevokePreview }>({
                path: `/api/v1/admin/billing-subscription/${subscriptionId}/courtesy/revoke-preview`
            });
            return response.data.data;
        },
        enabled,
        retry: false
    });
}

/** Confirms the observed subscription state and the reason for a grant. */
export function useCourtesyGrant() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({
            subscriptionId,
            expectedStatus,
            months,
            reason
        }: {
            readonly subscriptionId: string;
            readonly expectedStatus: 'ACTIVE' | 'PAUSED';
            readonly months: number;
            readonly reason: string;
        }) => {
            const response = await fetchApi<{
                data: {
                    readonly outcome: 'GRANTED' | 'EXTENDED';
                    readonly courtesyGrantId: string;
                    readonly endsAt: string;
                };
            }>({
                path: `/api/v1/admin/billing-subscription/${subscriptionId}/courtesy/grant`,
                method: 'POST',
                body: { expectedStatus, months, reason, confirmed: true }
            });
            return response.data.data;
        },
        onSettled: (_data, _error, input) =>
            client.invalidateQueries({
                queryKey: ['billing-subscription', 'courtesy-grant-preview', input.subscriptionId]
            })
    });
}

/** Confirms S10 for the observed paused subscription. */
export function useCourtesyRevoke() {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async ({ subscriptionId }: { readonly subscriptionId: string }) => {
            const response = await fetchApi<{
                data: {
                    readonly outcome: 'RESUMED';
                    readonly nextCharge: {
                        readonly at: string;
                        readonly amountMinor: number;
                        readonly currency: string;
                    } | null;
                };
            }>({
                path: `/api/v1/admin/billing-subscription/${subscriptionId}/courtesy/revoke`,
                method: 'POST',
                body: { expectedStatus: 'PAUSED', confirmed: true }
            });
            return response.data.data;
        },
        onSettled: (_data, _error, input) =>
            client.invalidateQueries({
                queryKey: ['billing-subscription', 'courtesy-revoke-preview', input.subscriptionId]
            })
    });
}
