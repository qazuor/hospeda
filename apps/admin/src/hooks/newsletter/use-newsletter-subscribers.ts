/**
 * @file use-newsletter-subscribers.ts
 * @description TanStack Query hooks for the admin newsletter subscriber
 * endpoints (SPEC-101 T-101-30). Two queries:
 *
 *   - useNewsletterSubscribers(filters): paginated list with status / locale /
 *     source / channel filters and partial-email substring search.
 *   - useNewsletterSubscriberStats(): aggregated per-status counters used by
 *     the subscribers tile in the admin dashboard.
 *
 * No mutation hooks here — admins cannot create / edit / delete subscribers
 * directly; row state changes flow through the user-facing flow + Brevo
 * webhooks.
 */

import { fetchApi } from '@/lib/api/client';
import type {
    NewsletterChannelEnum,
    NewsletterSourceEnum,
    NewsletterSubscriber,
    NewsletterSubscriberStatsResponse,
    NewsletterSubscriberStatusEnum
} from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const newsletterSubscriberQueryKeys = {
    all: ['newsletter-subscribers'] as const,
    lists: () => [...newsletterSubscriberQueryKeys.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
        [...newsletterSubscriberQueryKeys.lists(), filters] as const,
    stats: () => [...newsletterSubscriberQueryKeys.all, 'stats'] as const
};

// ---------------------------------------------------------------------------
// Wire types — match the API contract
// ---------------------------------------------------------------------------

interface NewsletterSubscriberListResponse {
    readonly success: boolean;
    readonly data: {
        readonly items: NewsletterSubscriber[];
        readonly pagination: {
            readonly page: number;
            readonly pageSize: number;
            readonly total: number;
            readonly totalPages: number;
        };
    };
}

interface NewsletterSubscriberStatsApiResponse {
    readonly success: boolean;
    readonly data: NewsletterSubscriberStatsResponse;
}

/** Filters accepted by the admin subscriber list endpoint. */
export interface NewsletterSubscriberListFilters {
    readonly page?: number;
    readonly pageSize?: number;
    readonly subscriberStatus?: NewsletterSubscriberStatusEnum;
    readonly channel?: NewsletterChannelEnum;
    readonly locale?: 'es' | 'en' | 'pt';
    readonly source?: NewsletterSourceEnum;
    /** Partial email match (case-insensitive). Maximum 255 characters. */
    readonly emailSearch?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function buildSubscriberQueryString(filters: NewsletterSubscriberListFilters): string {
    const params = new URLSearchParams();
    if (filters.page !== undefined) params.set('page', String(filters.page));
    if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
    if (filters.subscriberStatus) params.set('subscriberStatus', filters.subscriberStatus);
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.locale) params.set('locale', filters.locale);
    if (filters.source) params.set('source', filters.source);
    if (filters.emailSearch) params.set('emailSearch', filters.emailSearch);
    return params.toString();
}

async function fetchNewsletterSubscribers(filters: NewsletterSubscriberListFilters) {
    const query = buildSubscriberQueryString(filters);
    const path = `/api/v1/admin/newsletter/subscribers${query ? `?${query}` : ''}`;
    const result = await fetchApi<NewsletterSubscriberListResponse>({ path });
    return result.data.data;
}

async function fetchNewsletterSubscriberStats() {
    const result = await fetchApi<NewsletterSubscriberStatsApiResponse>({
        path: '/api/v1/admin/newsletter/subscribers/stats'
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Paginated list of newsletter subscribers. Filters map 1:1 to the admin
 * search schema in `@repo/schemas`.
 */
export function useNewsletterSubscribers(filters: NewsletterSubscriberListFilters = {}) {
    return useQuery({
        queryKey: newsletterSubscriberQueryKeys.list(filters as Record<string, unknown>),
        queryFn: () => fetchNewsletterSubscribers(filters),
        staleTime: 30_000
    });
}

/**
 * Aggregated counters per lifecycle status — refetched every 60 seconds so
 * the dashboard tile feels live without hammering the API.
 */
export function useNewsletterSubscriberStats() {
    return useQuery({
        queryKey: newsletterSubscriberQueryKeys.stats(),
        queryFn: fetchNewsletterSubscriberStats,
        staleTime: 60_000,
        refetchInterval: 60_000
    });
}
