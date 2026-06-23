/**
 * @file use-campaign-metrics.ts
 * @description Live-metrics + failed-deliveries hooks for the campaign
 * editor / metrics panel (SPEC-101 T-101-30, AC-101-11.2).
 *
 *   useCampaignMetrics(id, status?)
 *     Polls every 10 seconds when the campaign is in `sending` state so
 *     the metrics panel feels live. Switches off polling once the
 *     campaign reaches a terminal state (sent / cancelled).
 *
 *   useCampaignErrors(id, page, pageSize)
 *     Paginated failed-delivery rows with masked recipient email. Used
 *     by the "View errors" drawer on the campaign metrics panel.
 *
 * Errors emails arrive masked from the API (jo***@example.com) — the
 * route is responsible for masking, the hook just passes through.
 */

import { fetchApi } from '@/lib/api/client';
import type { NewsletterCampaignStatusEnum } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { newsletterCampaignQueryKeys } from './use-newsletter-campaigns';

// ---------------------------------------------------------------------------
// Query keys (extend the campaign factory)
// ---------------------------------------------------------------------------

export const campaignMetricsQueryKeys = {
    metrics: (id: string) => [...newsletterCampaignQueryKeys.detail(id), 'metrics'] as const,
    errors: (id: string, page: number, pageSize: number) =>
        [...newsletterCampaignQueryKeys.detail(id), 'errors', { page, pageSize }] as const
};

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/**
 * Per-status counters for a campaign. Mirrors the service-side
 * `computeMetrics()` shape from NewsletterCampaignService §4.2.
 */
export interface CampaignMetrics {
    readonly totalRecipients: number;
    readonly totalSoftcapped: number;
    readonly delivered: number;
    readonly failed: number;
    readonly skipped: number;
    readonly opened: number;
    readonly clicked: number;
    /** Computed open rate (opened / delivered), 0 when no deliveries. */
    readonly openRate: number;
    /** Computed click rate (clicked / delivered), 0 when no deliveries. */
    readonly clickRate: number;
}

interface CampaignMetricsResponse {
    readonly success: boolean;
    readonly data: CampaignMetrics;
}

/** Failed-delivery row as returned by the errors endpoint (masked email). */
export interface CampaignFailedDelivery {
    readonly id: string;
    readonly maskedEmail: string;
    readonly errorMessage: string | null;
    readonly retryCount: number;
    readonly updatedAt: string;
}

interface CampaignErrorsResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: CampaignFailedDelivery[];
        readonly pagination: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
        };
    };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Fetches the metrics for a campaign from the admin API.
 *
 * Exported as a plain async function (no React hooks) so that non-hook
 * callers — such as dashboard data-source resolvers — can reuse the same
 * fetch without violating the "no hooks inside queryFn" rule.
 *
 * @param id  campaign UUID
 * @returns   resolved `CampaignMetrics` object
 */
export async function fetchCampaignMetrics(id: string): Promise<CampaignMetrics> {
    const result = await fetchApi<CampaignMetricsResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}/metrics`
    });
    return result.data.data;
}

async function fetchCampaignErrors(id: string, page: number, pageSize: number) {
    const result = await fetchApi<CampaignErrorsResponse>({
        path: `/api/v1/admin/newsletter/campaigns/${id}/errors?page=${page}&pageSize=${pageSize}`
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches the live metrics for a campaign.
 *
 * Polling: when the optional `status` argument is `'sending'` the hook
 * refetches every 10 seconds so the metrics panel updates as deliveries
 * land. Other statuses (`draft`, `sent`, `cancelled`) skip polling — the
 * data is essentially static.
 *
 * @param id      campaign UUID
 * @param status  current campaign status; pass it through from the parent
 *                so the polling toggles automatically when the user clicks
 *                "Send" and the campaign transitions to `sending`.
 */
export function useCampaignMetrics(id: string, status?: NewsletterCampaignStatusEnum) {
    const isSending = status === ('sending' as NewsletterCampaignStatusEnum);
    return useQuery({
        queryKey: campaignMetricsQueryKeys.metrics(id),
        queryFn: () => fetchCampaignMetrics(id),
        enabled: !!id,
        // Always treat metrics as fresh-on-fetch — the API returns live
        // counters and ships a Cache-Control: no-store header anyway.
        staleTime: 0,
        refetchInterval: isSending ? 10_000 : false,
        // Pause polling when the tab is in the background to be a polite
        // citizen (browsers throttle anyway, but this is explicit).
        refetchIntervalInBackground: false
    });
}

/**
 * Paginated failed-delivery list for a campaign. The API returns the
 * recipient email already masked (e.g. `jo***@example.com`). Used by the
 * "View errors" drawer on the campaign metrics panel.
 */
export function useCampaignErrors(id: string, page = 1, pageSize = 20) {
    return useQuery({
        queryKey: campaignMetricsQueryKeys.errors(id, page, pageSize),
        queryFn: () => fetchCampaignErrors(id, page, pageSize),
        enabled: !!id,
        staleTime: 30_000
    });
}
