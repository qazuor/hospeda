import { fetchApi } from '@/lib/api/client';
/**
 * Cron Jobs Feature Hooks
 *
 * TanStack Query hooks for cron job management
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CronJobsListResponse, TriggerCronJobResponse } from './types';

/**
 * Query keys for cron job queries
 */
export const cronJobQueryKeys = {
    cronJobs: {
        all: ['cron-jobs'] as const,
        list: () => [...cronJobQueryKeys.cronJobs.all, 'list'] as const,
        health: () => [...cronJobQueryKeys.cronJobs.all, 'health'] as const
    }
};

/**
 * Fetch all registered cron jobs
 */
async function fetchCronJobs(): Promise<CronJobsListResponse> {
    const result = await fetchApi<CronJobsListResponse>({
        path: '/api/v1/cron'
    });
    return result.data;
}

/**
 * Trigger a cron job manually
 */
async function triggerCronJob({
    jobName,
    dryRun = false
}: {
    jobName: string;
    dryRun?: boolean;
}): Promise<TriggerCronJobResponse> {
    const params = new URLSearchParams();
    if (dryRun) {
        params.append('dryRun', 'true');
    }
    const url = `/api/v1/cron/${jobName}${params.toString() ? `?${params.toString()}` : ''}`;
    const result = await fetchApi<TriggerCronJobResponse>({ path: url, method: 'POST' });
    return result.data;
}

/**
 * Hook to fetch all cron jobs
 */
export const useCronJobsQuery = () => {
    return useQuery({
        queryKey: cronJobQueryKeys.cronJobs.list(),
        queryFn: fetchCronJobs,
        staleTime: 5 * 60_000, // 5 minutes
        refetchInterval: 60_000 // Refetch every minute
    });
};

/**
 * Hook to trigger a cron job manually
 */
export const useTriggerCronJobMutation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: triggerCronJob,
        onSuccess: () => {
            // Invalidate jobs list to refresh status
            queryClient.invalidateQueries({ queryKey: cronJobQueryKeys.cronJobs.list() });
        }
    });
};
