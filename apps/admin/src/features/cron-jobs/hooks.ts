/**
 * Cron Jobs Feature Hooks
 *
 * TanStack Query hooks for cron job management
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CronJobsListResponse, TriggerCronJobError, TriggerCronJobResponse } from './types';

const API_BASE = '/api/v1';

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
    const response = await fetch(`${API_BASE}/cron`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch cron jobs: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data;
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

    const url = `${API_BASE}/cron/${jobName}${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include'
    });

    const json = await response.json();

    if (!response.ok) {
        const error = json as TriggerCronJobError;
        throw new Error(error.error.message);
    }

    return json;
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
