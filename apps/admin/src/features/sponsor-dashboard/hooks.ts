import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import type { SponsorAnalytics, SponsorInvoice, SponsorSponsorship, SponsorSummary } from './types';

/**
 * Query keys for sponsor dashboard queries
 */
export const sponsorDashboardQueryKeys = {
    summary: ['sponsor-dashboard', 'summary'] as const,
    sponsorships: {
        all: ['sponsor-dashboard', 'sponsorships'] as const,
        list: (filters: Record<string, unknown>) =>
            [...sponsorDashboardQueryKeys.sponsorships.all, filters] as const
    },
    analytics: ['sponsor-dashboard', 'analytics'] as const,
    invoices: ['sponsor-dashboard', 'invoices'] as const,
    activities: ['sponsor-dashboard', 'activities'] as const
};

/**
 * Fetch sponsor summary
 * Calculates summary metrics from active sponsorships
 */
async function fetchSponsorSummary(): Promise<SponsorSummary> {
    // Fetch active sponsorships
    const result = await fetchApi<{
        success: boolean;
        data: { items?: { impressions?: number; clicks?: number; amount?: number }[] };
    }>({
        path: '/api/v1/sponsorships?status=ACTIVE'
    });
    const sponsorships = result.data.data?.items || [];

    // Calculate summary from sponsorships
    const summary = sponsorships.reduce(
        (
            acc: SponsorSummary,
            sponsorship: { impressions?: number; clicks?: number; amount?: number }
        ) => ({
            activeSponsorships: acc.activeSponsorships + 1,
            totalImpressions: acc.totalImpressions + (sponsorship.impressions || 0),
            totalClicks: acc.totalClicks + (sponsorship.clicks || 0),
            revenue: acc.revenue + (sponsorship.amount || 0)
        }),
        {
            activeSponsorships: 0,
            totalImpressions: 0,
            totalClicks: 0,
            revenue: 0
        } as SponsorSummary
    );

    return summary;
}

/**
 * Fetch sponsor sponsorships with filters
 */
async function fetchSponsorSponsorships(
    filters: Record<string, unknown> = {}
): Promise<{ items: SponsorSponsorship[]; pagination: { total: number } }> {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }

    const result = await fetchApi<{
        success: boolean;
        data: { items: SponsorSponsorship[]; pagination: { total: number } };
    }>({
        path: `/api/v1/sponsorships?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetch sponsor analytics
 * Returns an empty array until the analytics API endpoint is implemented.
 * Pending: GET /api/v1/sponsorships/:id/analytics
 */
async function fetchSponsorAnalytics(): Promise<SponsorAnalytics[]> {
    return [];
}

/**
 * Fetch sponsor invoices
 * Expected endpoint: GET /api/v1/billing/invoices?sponsorId=current
 */
async function fetchSponsorInvoices(): Promise<SponsorInvoice[]> {
    const result = await fetchApi<{ success: boolean; data: { items?: SponsorInvoice[] } }>({
        path: '/api/v1/billing/invoices'
    });
    return result.data.data?.items || [];
}

/**
 * Hook to fetch sponsor summary
 */
export const useSponsorSummaryQuery = () => {
    return useQuery({
        queryKey: sponsorDashboardQueryKeys.summary,
        queryFn: fetchSponsorSummary,
        staleTime: 60_000
    });
};

/**
 * Hook to fetch sponsor sponsorships
 */
export const useSponsorSponsorshipsQuery = (filters: Record<string, unknown> = {}) => {
    return useQuery({
        queryKey: sponsorDashboardQueryKeys.sponsorships.list(filters),
        queryFn: () => fetchSponsorSponsorships(filters),
        staleTime: 30_000
    });
};

/**
 * Hook to fetch sponsor analytics
 */
export const useSponsorAnalyticsQuery = () => {
    return useQuery({
        queryKey: sponsorDashboardQueryKeys.analytics,
        queryFn: fetchSponsorAnalytics,
        staleTime: 60_000
    });
};

/**
 * Hook to fetch sponsor invoices
 */
export const useSponsorInvoicesQuery = () => {
    return useQuery({
        queryKey: sponsorDashboardQueryKeys.invoices,
        queryFn: fetchSponsorInvoices,
        staleTime: 60_000
    });
};
