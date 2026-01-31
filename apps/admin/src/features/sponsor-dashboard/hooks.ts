import { useQuery } from '@tanstack/react-query';
import type { SponsorAnalytics, SponsorInvoice, SponsorSponsorship, SponsorSummary } from './types';

const API_BASE = '/api/v1';

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
    try {
        // Fetch active sponsorships
        const response = await fetch(`${API_BASE}/sponsorships?status=ACTIVE`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch summary: ${response.statusText}`);
        }

        const json = await response.json();
        const sponsorships = json.data?.items || [];

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
    } catch (error) {
        // Return empty summary on error to avoid breaking UI
        console.error('Error fetching sponsor summary:', error);
        return {
            activeSponsorships: 0,
            totalImpressions: 0,
            totalClicks: 0,
            revenue: 0
        };
    }
}

/**
 * Fetch sponsor sponsorships with filters
 */
async function fetchSponsorSponsorships(
    filters: Record<string, unknown> = {}
): Promise<{ items: SponsorSponsorship[]; pagination: { total: number } }> {
    try {
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && value !== '') {
                params.append(key, String(value));
            }
        }

        const response = await fetch(`${API_BASE}/sponsorships?${params.toString()}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch sponsorships: ${response.statusText}`);
        }

        const json = await response.json();
        return json.data;
    } catch (error) {
        // Return empty data on error to avoid breaking UI
        console.error('Error fetching sponsor sponsorships:', error);
        return {
            items: [],
            pagination: { total: 0 }
        };
    }
}

/**
 * Fetch sponsor analytics
 * TODO: Implement when analytics API endpoint is available
 */
async function fetchSponsorAnalytics(): Promise<SponsorAnalytics[]> {
    // Analytics API not yet implemented
    // Will be populated when /api/v1/sponsorships/:id/analytics endpoint is ready
    return [];
}

/**
 * Fetch sponsor invoices
 * TODO: Replace with real billing invoice endpoint when available
 */
async function fetchSponsorInvoices(): Promise<SponsorInvoice[]> {
    try {
        // TODO: Update endpoint when billing invoice API is ready
        // Expected endpoint: GET /api/v1/billing/invoices?sponsorId=current
        const response = await fetch(`${API_BASE}/billing/invoices`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch invoices: ${response.statusText}`);
        }

        const json = await response.json();
        return json.data?.items || [];
    } catch (error) {
        // Return empty array on error to avoid breaking UI
        console.error('Error fetching sponsor invoices:', error);
        return [];
    }
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
