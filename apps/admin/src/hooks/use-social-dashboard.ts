/**
 * @file use-social-dashboard.ts
 * @description TanStack Query hook for the admin social pipeline dashboard (SPEC-254 T-041).
 *
 * Extracted from use-social-posts.ts to keep each file within the 500-line limit.
 * Re-exported from use-social-posts.ts for a consistent import surface.
 */

import { fetchApi } from '@/lib/api/client';
import type { SocialDashboardResponse } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { socialPostQueryKeys } from './use-social-posts';

/** Wrapper shape returned by the dashboard endpoint. */
interface SocialDashboardApiResponse {
    readonly success: boolean;
    readonly data: SocialDashboardResponse;
}

async function fetchSocialDashboard(): Promise<SocialDashboardResponse> {
    const result = await fetchApi<SocialDashboardApiResponse>({
        path: '/api/v1/admin/social/dashboard'
    });
    return result.data.data;
}

/**
 * Fetches the social pipeline dashboard data.
 *
 * Returns KPI counters, the quick-approval queue, recent failures, and the
 * Make webhook configuration status.
 *
 * Gate: caller must have SOCIAL_POST_VIEW (enforced server-side).
 */
export function useSocialDashboard() {
    return useQuery({
        queryKey: socialPostQueryKeys.dashboard(),
        queryFn: fetchSocialDashboard,
        staleTime: 30_000
    });
}
