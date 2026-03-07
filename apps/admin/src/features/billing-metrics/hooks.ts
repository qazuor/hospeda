import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import type {
    ApproachingLimitsResponse,
    CustomerSearchResult,
    CustomerUsageSummary,
    SystemUsageStats
} from './types';

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

    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/metrics?${params.toString()}`
    });
    return result.data.data;
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

    const result = await fetchApi<{ success: boolean; data: Record<string, unknown> }>({
        path: `/api/v1/protected/billing/metrics/activity?${params.toString()}`
    });
    return result.data.data;
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

    const result = await fetchApi<{ success: boolean; data: CustomerSearchResult[] }>({
        path: `/api/v1/protected/billing/customers/search?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetch customer usage summary
 */
async function fetchCustomerUsage(customerId: string): Promise<CustomerUsageSummary> {
    const result = await fetchApi<{ success: boolean; data: CustomerUsageSummary }>({
        path: `/api/v1/protected/billing/customers/${customerId}/usage`
    });
    return result.data.data;
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
        staleTime: 5 * 60_000, // 5 minutes
        retry: 1
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
        staleTime: 60_000, // 1 minute
        retry: 1
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
        staleTime: 60_000,
        retry: 1
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
        staleTime: 30_000, // 30 seconds
        retry: 1
    });
};

/**
 * Fetch system-wide usage statistics
 */
async function fetchSystemUsageStats(): Promise<SystemUsageStats> {
    const result = await fetchApi<{ success: boolean; data: SystemUsageStats }>({
        path: '/api/v1/protected/billing/metrics/system-usage'
    });
    return result.data.data;
}

/**
 * API response shape for a single approaching-limit item
 */
interface ApproachingLimitApiItem {
    readonly customerId: string;
    readonly customerEmail: string;
    readonly limitKey: string;
    readonly currentUsage: number;
    readonly maxAllowed: number;
    readonly usagePercentage: number;
}

/**
 * Fetch customers approaching limits (>90% usage)
 * Transforms API array response into the frontend ApproachingLimitsResponse format
 */
async function fetchApproachingLimits(threshold = 90): Promise<ApproachingLimitsResponse> {
    const params = new URLSearchParams();
    params.append('threshold', String(threshold));

    const result = await fetchApi<{ success: boolean; data: ApproachingLimitApiItem[] }>({
        path: `/api/v1/protected/billing/metrics/approaching-limits?${params.toString()}`
    });

    const apiItems = result.data.data ?? [];

    return {
        threshold,
        totalCustomers: apiItems.length,
        customers: apiItems.map((item) => ({
            customerId: item.customerId,
            customerEmail: item.customerEmail,
            customerName: null,
            category: 'owner' as const,
            planSlug: null,
            planName: null,
            limitKey: item.limitKey,
            limitName: item.limitKey,
            currentValue: item.currentUsage,
            maxValue: item.maxAllowed,
            percentage: item.usagePercentage
        }))
    };
}

/**
 * Hook to fetch system-wide usage statistics
 */
export const useSystemUsageStatsQuery = () => {
    return useQuery({
        queryKey: [...metricsQueryKeys.metrics.all, 'system-usage'] as const,
        queryFn: () => fetchSystemUsageStats(),
        staleTime: 5 * 60_000, // 5 minutes
        retry: 1
    });
};

/**
 * Hook to fetch customers approaching limits
 */
export const useApproachingLimitsQuery = (threshold = 90) => {
    return useQuery({
        queryKey: [...metricsQueryKeys.metrics.all, 'approaching-limits', threshold] as const,
        queryFn: () => fetchApproachingLimits(threshold),
        staleTime: 2 * 60_000, // 2 minutes
        retry: 1
    });
};
