/**
 * Cron Jobs Feature Hooks
 *
 * TanStack Query hooks for cron job management (SPEC-161 enriched shape).
 */
import type { CronRun } from '@repo/schemas';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import { isApiError } from '@/lib/errors';
import type {
    CronJobResult,
    CronJobsListResponse,
    TriggerCronJobOutcome,
    TriggerCronJobResponse
} from './types';

/**
 * Query keys for cron job queries
 */
export const cronJobQueryKeys = {
    cronJobs: {
        all: ['cron-jobs'] as const,
        list: () => [...cronJobQueryKeys.cronJobs.all, 'list'] as const,
        health: () => [...cronJobQueryKeys.cronJobs.all, 'health'] as const,
        acceptedRun: (jobName: string, runId: string) =>
            [...cronJobQueryKeys.cronJobs.all, 'accepted-run', jobName, runId] as const
    }
};

/**
 * Fetch all registered cron jobs (enriched CronJobAdmin shape).
 */
async function fetchCronJobs(): Promise<CronJobsListResponse> {
    const result = await fetchApi<{ success: boolean; data: CronJobsListResponse }>({
        path: '/api/v1/admin/cron'
    });
    return result.data.data;
}

/** Interval between reads of the run history while an accepted run is pending. */
export const ACCEPTED_RUN_POLL_MS = 3_000;

/**
 * Reads the run holding the cron lock from a 409 body, when the API sent it.
 */
function readHolderRunId(error: unknown): string | null {
    if (!isApiError(error)) return null;
    const body = error.body as { error?: { details?: { holderRunId?: unknown } } } | undefined;
    const holder = body?.error?.details?.holderRunId ?? error.details?.holderRunId;
    return typeof holder === 'string' ? holder : null;
}

/**
 * Trigger a cron job manually and normalise the answer (HOS-1999):
 * 201 completed, 202 accepted (exclusive job running in the background),
 * 409 busy (another run holds the cron lock). Any other error is rethrown.
 */
export async function triggerCronJob({
    jobName,
    dryRun = false
}: {
    jobName: string;
    dryRun?: boolean;
}): Promise<TriggerCronJobOutcome> {
    const params = new URLSearchParams();
    if (dryRun) {
        params.append('dryRun', 'true');
    }
    const url = `/api/v1/admin/cron/${jobName}${params.toString() ? `?${params.toString()}` : ''}`;
    try {
        const result = await fetchApi<{ success: boolean; data: TriggerCronJobResponse }>({
            path: url,
            method: 'POST'
        });
        const data = result.data.data;
        if ('accepted' in data && data.accepted === true) {
            return { kind: 'accepted', accepted: data };
        }
        return { kind: 'completed', result: data as CronJobResult };
    } catch (error) {
        if (isApiError(error) && error.status === 409) {
            return { kind: 'busy', holderRunId: readHolderRunId(error) };
        }
        throw error;
    }
}

/**
 * Maps a recorded `cron_runs` row to the result shape the card renders.
 */
export function cronRunToResult(run: CronRun): CronJobResult {
    return {
        success: run.status === 'success' || run.status === 'partial',
        message: run.errorMessage ?? '',
        processed: run.processed,
        errors: run.errors,
        durationMs: run.durationMs,
        details: run.details ?? undefined,
        jobName: run.jobName,
        dryRun: run.dryRun,
        executedAt: new Date(run.startedAt).toISOString()
    };
}

/**
 * Finds the recorded run of an accepted trigger in the run history
 * (`GET /admin/cron/runs`, newest first), matched by `details.runId`.
 * Returns `null` while the run is still in flight.
 */
async function fetchAcceptedRun({
    jobName,
    runId
}: {
    jobName: string;
    runId: string;
}): Promise<CronJobResult | null> {
    const params = new URLSearchParams({ jobName, executionMode: 'manual', pageSize: '20' });
    const result = await fetchApi<{ success: boolean; data: { items: CronRun[] } }>({
        path: `/api/v1/admin/cron/runs?${params.toString()}`
    });
    const run = result.data.data.items.find((item) => item.details?.runId === runId);
    return run ? cronRunToResult(run) : null;
}

/**
 * Hook to fetch all cron jobs (enriched list with category / lastRun / nextRunAt).
 */
export const useCronJobsQuery = () => {
    return useQuery({
        queryKey: cronJobQueryKeys.cronJobs.list(),
        queryFn: fetchCronJobs,
        staleTime: 5 * 60_000, // 5 minutes
        refetchInterval: 60_000, // Refetch every minute
        retry: 1
    });
};

/**
 * Hook that polls the run history until an accepted (202) run is recorded,
 * then stops. Disabled while `runId` is absent.
 */
export const useAcceptedCronRunQuery = ({
    jobName,
    runId
}: {
    readonly jobName: string;
    readonly runId: string | null;
}) => {
    return useQuery({
        queryKey: cronJobQueryKeys.cronJobs.acceptedRun(jobName, runId ?? ''),
        queryFn: () => fetchAcceptedRun({ jobName, runId: runId ?? '' }),
        enabled: runId !== null,
        staleTime: 0,
        refetchInterval: (query) => (query.state.data ? false : ACCEPTED_RUN_POLL_MS)
    });
};

/**
 * Hook to trigger a cron job manually.
 */
export const useTriggerCronJobMutation = () => {
    return useMutation({
        mutationFn: triggerCronJob
        // NOTE: we intentionally do NOT invalidate the jobs list here. Invalidating
        // immediately refetches and re-sorts (failing-first), which would yank the
        // just-run card to the bottom of its category and hide its inline result
        // panel after ~1s. The inline panel already shows the full outcome
        // (processed/errors/duration); the list's lastRun badge refreshes on the
        // 60s auto-refresh (refetchInterval) once the operator has read the result.
    });
};
