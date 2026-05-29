/**
 * Hook layer for the Mi facturación landing page (SPEC-156 PR-4 T-034 / T-036).
 *
 * Reads the protected billing endpoints scoped to the current user:
 *   - GET /api/v1/protected/billing/subscriptions?pageSize=1 -> latest sub
 *   - GET /api/v1/protected/billing/usage                    -> usage snapshot
 *   - GET /api/v1/protected/billing/invoices?pageSize=1      -> latest invoice
 *
 * The hooks are intentionally thin wrappers over `fetchApi` + TanStack Query
 * so the section components (T-034/T-036/T-037) compose them without
 * re-implementing the response-shape parsing. The endpoint contracts mirror
 * the response shapes already defined in
 * `apps/admin/src/lib/dashboard-sources/host.ts` (SPEC-155); the parsing is
 * duplicated here on purpose to keep this module self-contained — Mi
 * facturación is a standalone page, not a dashboard widget consumer.
 *
 * @module use-my-billing
 */

import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Response shapes (mirrored from host.ts — kept local to decouple from D5)
// ---------------------------------------------------------------------------

export interface MyBillingSubscription {
    readonly id: string;
    readonly status: string;
    readonly currentPeriodEnd?: string;
    readonly planId?: string;
    readonly planName?: string;
}

interface SubscriptionsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<MyBillingSubscription>;
        readonly pagination?: { readonly total?: number };
    };
}

export interface MyBillingUsage {
    readonly accommodationsUsed: number;
    readonly accommodationsLimit: number | null;
    readonly usagePercent: number;
}

interface UsageApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly accommodationsUsed?: number;
        readonly accommodationsLimit?: number | null;
        readonly usagePercent?: number;
    };
}

export interface MyBillingInvoice {
    readonly id: string;
    readonly issuedAt?: string;
    readonly pdfUrl?: string | null;
}

interface InvoicesApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly data?: ReadonlyArray<MyBillingInvoice>;
    };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const myBillingQueryKeys = {
    all: ['my-billing'] as const,
    subscription: () => ['my-billing', 'subscription'] as const,
    usage: () => ['my-billing', 'usage'] as const,
    latestInvoice: () => ['my-billing', 'latest-invoice'] as const
} as const;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Reads the latest (or only) own subscription for the current user.
 *
 * Returns `data: null` when the user has no subscriptions at all (paginated
 * envelope with `data.data === []`). Callers tell apart "loading" from
 * "no subscription" via the `isLoading` flag.
 */
export function useMySubscription() {
    return useQuery({
        queryKey: myBillingQueryKeys.subscription(),
        queryFn: async (): Promise<MyBillingSubscription | null> => {
            const response = await fetchApi<unknown>({
                path: '/api/v1/protected/billing/subscriptions?pageSize=1'
            });
            const apiResponse = response.data as SubscriptionsApiResponse;
            const list = apiResponse.data?.data ?? [];
            return list[0] ?? null;
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000
    });
}

/**
 * Reads the usage snapshot for the current user's active plan.
 *
 * Returns `null` when the user does not have an active subscription (the
 * server replies with an empty data object). The section UI shows an empty
 * state in that case.
 */
export function useMyUsage() {
    return useQuery({
        queryKey: myBillingQueryKeys.usage(),
        queryFn: async (): Promise<MyBillingUsage | null> => {
            const response = await fetchApi<unknown>({
                path: '/api/v1/protected/billing/usage'
            });
            const apiResponse = response.data as UsageApiResponse;
            const payload = apiResponse.data;
            if (!payload || payload.accommodationsUsed === undefined) {
                return null;
            }
            return {
                accommodationsUsed: payload.accommodationsUsed,
                accommodationsLimit: payload.accommodationsLimit ?? null,
                usagePercent: payload.usagePercent ?? 0
            };
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000
    });
}

/**
 * Reads the most recent invoice for the current user.
 *
 * Returns `null` when the user has never been invoiced (e.g. free-plan
 * accounts or a trial that has not yet billed). The actions section uses
 * the `pdfUrl` to decide whether to render the download link.
 */
export function useMyLatestInvoice() {
    return useQuery({
        queryKey: myBillingQueryKeys.latestInvoice(),
        queryFn: async (): Promise<MyBillingInvoice | null> => {
            const response = await fetchApi<unknown>({
                path: '/api/v1/protected/billing/invoices?pageSize=1'
            });
            const apiResponse = response.data as InvoicesApiResponse;
            const list = apiResponse.data?.data ?? [];
            return list[0] ?? null;
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000
    });
}
