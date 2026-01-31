import { useQuery } from '@tanstack/react-query';
import type {
    ApproachingLimitsResponse,
    CustomerSearchResult,
    CustomerUsageSummary,
    SystemUsageStats
} from './types';

const API_BASE = '/api/v1';

/**
 * Query keys for billing metrics queries
 */
export const metricsQueryKeys = {
    metrics: {
        all: ['billing-metrics'] as const,
        overview: (options: Record<string, unknown>) =>
            [...metricsQueryKeys.metrics.all, 'overview', options] as const,
        activity: (options: Record<string, unknown>) =>
            [...metricsQueryKeys.metrics.all, 'activity', options] as const
    },
    customers: {
        all: ['billing-customers'] as const,
        search: (query: string) => [...metricsQueryKeys.customers.all, 'search', query] as const,
        usage: (customerId: string) =>
            [...metricsQueryKeys.customers.all, 'usage', customerId] as const
    }
};

/**
 * Fetch billing metrics (overview + revenue series + breakdown)
 */
async function fetchBillingMetrics(
    options: {
        livemode?: boolean;
        months?: number;
    } = {}
) {
    const params = new URLSearchParams();

    if (options.livemode !== undefined) {
        params.append('livemode', String(options.livemode));
    }
    if (options.months !== undefined) {
        params.append('months', String(options.months));
    }

    const response = await fetch(`${API_BASE}/billing/metrics?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch billing metrics: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch recent billing activity
 */
async function fetchRecentActivity(
    options: {
        livemode?: boolean;
        limit?: number;
    } = {}
) {
    const params = new URLSearchParams();

    if (options.livemode !== undefined) {
        params.append('livemode', String(options.livemode));
    }
    if (options.limit !== undefined) {
        params.append('limit', String(options.limit));
    }

    const response = await fetch(`${API_BASE}/billing/metrics/activity?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch recent activity: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Search for customers by email
 */
async function searchCustomers(query: string): Promise<CustomerSearchResult[]> {
    if (!query || query.trim().length < 2) {
        return [];
    }

    const params = new URLSearchParams();
    params.append('q', query.trim());

    const response = await fetch(`${API_BASE}/billing/customers/search?${params.toString()}`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to search customers: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch customer usage summary
 */
async function fetchCustomerUsage(customerId: string): Promise<CustomerUsageSummary> {
    const response = await fetch(`${API_BASE}/billing/customers/${customerId}/usage`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch customer usage: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch billing metrics
 */
export const useBillingMetricsQuery = (
    options: {
        livemode?: boolean;
        months?: number;
    } = {}
) => {
    return useQuery({
        queryKey: metricsQueryKeys.metrics.overview(options),
        queryFn: () => fetchBillingMetrics(options),
        staleTime: 5 * 60_000 // 5 minutes
    });
};

/**
 * Hook to fetch recent billing activity
 */
export const useRecentActivityQuery = (
    options: {
        livemode?: boolean;
        limit?: number;
    } = {}
) => {
    return useQuery({
        queryKey: metricsQueryKeys.metrics.activity(options),
        queryFn: () => fetchRecentActivity(options),
        staleTime: 60_000 // 1 minute
    });
};

/**
 * Hook to search for customers
 */
export const useCustomerSearchQuery = (query: string) => {
    return useQuery({
        queryKey: metricsQueryKeys.customers.search(query),
        queryFn: () => searchCustomers(query),
        enabled: query.trim().length >= 2,
        staleTime: 60_000
    });
};

/**
 * Hook to fetch customer usage summary
 */
export const useCustomerUsageQuery = (customerId: string | null) => {
    return useQuery({
        queryKey: metricsQueryKeys.customers.usage(customerId || ''),
        queryFn: () => {
            if (!customerId) {
                throw new Error('Customer ID is required');
            }
            return fetchCustomerUsage(customerId);
        },
        enabled: !!customerId,
        staleTime: 30_000 // 30 seconds
    });
};

/**
 * Fetch system-wide usage statistics
 */
async function fetchSystemUsageStats(): Promise<SystemUsageStats> {
    const response = await fetch(`${API_BASE}/billing/metrics/system-usage`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch system usage stats: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Fetch customers approaching limits (>90% usage)
 */
async function fetchApproachingLimits(threshold = 90): Promise<ApproachingLimitsResponse> {
    const params = new URLSearchParams();
    params.append('threshold', String(threshold));

    const response = await fetch(
        `${API_BASE}/billing/metrics/approaching-limits?${params.toString()}`,
        {
            credentials: 'include'
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch approaching limits: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
}

/**
 * Hook to fetch system-wide usage statistics
 */
export const useSystemUsageStatsQuery = () => {
    return useQuery({
        queryKey: [...metricsQueryKeys.metrics.all, 'system-usage'] as const,
        queryFn: () => fetchSystemUsageStats(),
        staleTime: 5 * 60_000 // 5 minutes
    });
};

/**
 * Hook to fetch customers approaching limits
 */
export const useApproachingLimitsQuery = (threshold = 90) => {
    return useQuery({
        queryKey: [...metricsQueryKeys.metrics.all, 'approaching-limits', threshold] as const,
        queryFn: () => fetchApproachingLimits(threshold),
        staleTime: 2 * 60_000 // 2 minutes
    });
};
