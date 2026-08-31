import {
    BackfillPaymentRequestSchema,
    type BackfillPaymentResponse,
    BillingDivergenceReportSchema,
    ForceLinkPreapprovalRequestSchema,
    type ForceLinkPreapprovalResponse
} from '@repo/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { fetchApi } from '@/lib/api/client';
import type { DivergenceKind } from './types';

/**
 * TanStack Query hooks for the orphan-payment rescue screen (HOS-765).
 *
 * Follows the `billing-payments/hooks.ts` pattern: `fetchApi` for transport,
 * namespaced query keys, and schema parsing AT THE EDGE
 * (`BillingDivergenceReportSchema.parse(...)`) so a shape divergence from the
 * backend throws here instead of rendering `undefined` deep inside the table.
 *
 * @module features/billing-reconciliation/hooks
 */

/** Query keys for the divergence report. */
export const divergenceQueryKeys = {
    divergences: {
        all: ['billing-reconciliation-divergences'] as const,
        lists: () => [...divergenceQueryKeys.divergences.all, 'list'] as const,
        list: (filters: DivergenceFilterParams) =>
            [...divergenceQueryKeys.divergences.lists(), filters] as const
    }
};

/** Filters accepted by `GET /admin/billing/reconciliation/divergences`. */
export interface DivergenceFilterParams {
    readonly kind?: DivergenceKind;
    readonly since?: string;
    readonly page?: number;
    readonly pageSize?: number;
}

/**
 * Fetch the divergence report.
 *
 * The response follows the standard admin envelope (`{ success, data: { data:
 * {...} } }` — this endpoint is NOT a `createAdminListRoute`, so the payload
 * is wrapped one level deeper than the plain `items`/`pagination` shape;
 * `result.data.data` is the full {@link BillingDivergenceReportSchema} shape,
 * including `truncated`/`mpCallCount`/`mpRateLimitedCount` alongside
 * `items`/`pagination`.
 */
async function fetchDivergences(filters: DivergenceFilterParams = {}) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{ success: boolean; data: unknown }>({
        path: `/api/v1/admin/billing/reconciliation/divergences?${params.toString()}`
    });

    return BillingDivergenceReportSchema.parse(result.data.data);
}

/**
 * Hook to fetch the divergence report.
 *
 * `staleTime` is deliberately high (5 minutes) and `refetchOnWindowFocus` is
 * off: each report costs PACED calls against the real MercadoPago API (see
 * `HOSPEDA_MP_SCAN_*`), so this screen must not refetch on every tab focus.
 */
export const useDivergencesQuery = (filters: DivergenceFilterParams = {}) => {
    return useQuery({
        queryKey: divergenceQueryKeys.divergences.list(filters),
        queryFn: () => fetchDivergences(filters),
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1
    });
};

/** Body accepted by `POST /admin/billing/reconciliation/force-link`. */
type ForceLinkPayload = z.infer<typeof ForceLinkPreapprovalRequestSchema>;

/** Body accepted by `POST /admin/billing/reconciliation/backfill-payment`. */
type BackfillPaymentPayload = z.infer<typeof BackfillPaymentRequestSchema>;

/**
 * Bind an orphan preapproval to a local subscription.
 *
 * The payload is validated with {@link ForceLinkPreapprovalRequestSchema}
 * before it leaves the browser — the same guard the API applies server-side,
 * checked here too so a malformed request never reaches the network.
 */
async function forceLinkPreapproval(payload: ForceLinkPayload) {
    const validated = ForceLinkPreapprovalRequestSchema.parse(payload);
    const result = await fetchApi<{ success: boolean; data: unknown }>({
        path: '/api/v1/admin/billing/reconciliation/force-link',
        method: 'POST',
        body: validated
    });
    return result.data.data as ForceLinkPreapprovalResponse;
}

/**
 * Record a `billing_payments` row for an approved MercadoPago charge that
 * never got one.
 */
async function backfillPayment(payload: BackfillPaymentPayload) {
    const validated = BackfillPaymentRequestSchema.parse(payload);
    const result = await fetchApi<{ success: boolean; data: unknown }>({
        path: '/api/v1/admin/billing/reconciliation/backfill-payment',
        method: 'POST',
        body: validated
    });
    return result.data.data as BackfillPaymentResponse;
}

/**
 * Hook to force-link an orphan preapproval to a local subscription.
 *
 * Invalidates the divergence list on success — a linked preapproval must
 * disappear from (or change state in) the next report.
 */
export const useForceLinkMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: ForceLinkPayload) => forceLinkPreapproval(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: divergenceQueryKeys.divergences.lists() });
        }
    });
};

/**
 * Hook to backfill a `billing_payments` row for an unrecorded MercadoPago charge.
 *
 * Invalidates the divergence list on success, same rationale as
 * {@link useForceLinkMutation}.
 */
export const useBackfillPaymentMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: BackfillPaymentPayload) => backfillPayment(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: divergenceQueryKeys.divergences.lists() });
        }
    });
};
