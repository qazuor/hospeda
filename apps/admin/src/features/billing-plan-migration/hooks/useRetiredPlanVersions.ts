import { RetiredPlanVersionListSchema } from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

const path = '/api/v1/admin/plan-migrations/retired-versions';
/** Cache key for the retired versions that still anchor live subscriptions. */
export const RETIRED_PLAN_VERSIONS_KEY = ['admin-plan-migration-retired-versions'] as const;

/** Reads the retired plan versions and their live subscription counts. */
export function useRetiredPlanVersions() {
    return useQuery({
        queryKey: RETIRED_PLAN_VERSIONS_KEY,
        queryFn: async () => {
            const response = await fetchApi<{ data: unknown }>({ path });
            const parsed = RetiredPlanVersionListSchema.safeParse(response.data.data);
            if (!parsed.success) throw new Error('Invalid retired plan versions response');
            return parsed.data;
        },
        retry: false
    });
}
