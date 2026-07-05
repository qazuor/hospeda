/**
 * @file useAccommodationImportStatusQuery.ts
 * @description TanStack Query hook polling the async accommodation import
 * status endpoint (HOS-50 / SPEC-277 R3 T-014).
 *
 * Modeled on `useCronJobsQuery`'s `refetchInterval` pattern
 * (`apps/admin/src/features/cron-jobs/hooks.ts`): the query is keyed by the
 * run handle, enabled only while a run handle is present, and polls every
 * 5s until the run settles.
 *
 * The import pipeline is stateless (see `use-import-status.ts`, the web
 * twin of this hook) — the caller must echo the full `202` run handle back
 * on every poll.
 */

import type {
    AccommodationImportAsyncStartResponse,
    AccommodationImportStatusResponse
} from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

/** The run handle echoed back from the `202` start response. */
export type ImportRunHandle = AccommodationImportAsyncStartResponse;

const STATUS_PATH = '/api/v1/protected/accommodations/import-from-url/status';

/** Query keys for the import status polling query. */
export const accommodationImportStatusQueryKeys = {
    all: ['accommodation-import-status'] as const,
    status: (runHandle: ImportRunHandle) =>
        [
            ...accommodationImportStatusQueryKeys.all,
            runHandle.runId,
            runHandle.datasetId,
            runHandle.source
        ] as const
};

async function fetchImportStatus(
    runHandle: ImportRunHandle
): Promise<AccommodationImportStatusResponse> {
    const params = new URLSearchParams({
        runId: runHandle.runId,
        datasetId: runHandle.datasetId,
        source: runHandle.source,
        startedAt: runHandle.startedAt,
        url: runHandle.url
    });
    const result = await fetchApi<{
        success: boolean;
        data: AccommodationImportStatusResponse;
    }>({
        path: `${STATUS_PATH}?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Computes the `refetchInterval` for the import status query: 5s while the
 * run hasn't settled yet, `false` (stop polling) once it has.
 */
export const computeImportStatusRefetchInterval = (
    data: AccommodationImportStatusResponse | undefined
): number | false => (data?.settled ? false : 5_000);

/**
 * Polls the async accommodation import status endpoint while an Apify run
 * (started by the `202` branch of `POST .../import-from-url`) is in flight.
 *
 * @param runHandle - The run handle from the `202` response, or `null` when
 *   there's nothing to poll yet (e.g. the import hasn't started, or resolved
 *   synchronously with a `200`).
 */
export const useAccommodationImportStatusQuery = (runHandle: ImportRunHandle | null) => {
    return useQuery({
        queryKey: runHandle
            ? accommodationImportStatusQueryKeys.status(runHandle)
            : accommodationImportStatusQueryKeys.all,
        queryFn: () => {
            if (!runHandle) {
                throw new Error(
                    'useAccommodationImportStatusQuery: runHandle is required when enabled'
                );
            }
            return fetchImportStatus(runHandle);
        },
        enabled: runHandle !== null,
        refetchInterval: (query) => computeImportStatusRefetchInterval(query.state.data),
        retry: false
    });
};
