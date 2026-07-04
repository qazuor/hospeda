/**
 * @file use-social-dashboard.ts
 * @description TanStack Query hook for the admin social pipeline dashboard (SPEC-254 T-041).
 *
 * Extracted from use-social-posts.ts to keep each file within the 500-line limit.
 * Re-exported from use-social-posts.ts for a consistent import surface.
 */

import type { SocialDashboardResponse } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { SocialDashboardFilters } from './use-social-posts';
import { socialPostQueryKeys } from './use-social-posts';

/** Wrapper shape returned by the dashboard endpoint. */
interface SocialDashboardApiResponse {
    readonly success: boolean;
    readonly data: SocialDashboardResponse;
}

async function fetchSocialDashboard(
    filters?: SocialDashboardFilters
): Promise<SocialDashboardResponse> {
    const params = new URLSearchParams();
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    const query = params.toString();
    const result = await fetchApi<SocialDashboardApiResponse>({
        path: `/api/v1/admin/social/dashboard${query ? `?${query}` : ''}`
    });
    return result.data.data;
}

/**
 * Fetches the social pipeline dashboard data.
 *
 * Returns KPI counters, the quick-approval queue, recent failures, and the
 * Make webhook configuration status. Optional `dateFrom`/`dateTo` (ISO
 * `YYYY-MM-DD`, HOS-66 T-009) scope every metric to that range; omitting
 * both preserves the all-time totals.
 *
 * Gate: caller must have SOCIAL_POST_VIEW (enforced server-side).
 */
export function useSocialDashboard(filters?: SocialDashboardFilters) {
    return useQuery({
        queryKey: socialPostQueryKeys.dashboard(filters),
        queryFn: () => fetchSocialDashboard(filters),
        staleTime: 30_000
    });
}
