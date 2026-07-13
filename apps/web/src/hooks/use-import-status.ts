/**
 * @file use-import-status.ts
 * @description Polling hook for the async accommodation import 202+poll flow
 * (HOS-50 / SPEC-277 R3 T-012).
 *
 * Polls `GET /api/v1/protected/accommodations/import-from-url/status` every
 * ~5s while `enabled = true` and the run has not settled. Stops automatically
 * when the run settles, when the component unmounts, or on a hard 4xx/5xx
 * from the endpoint.
 *
 * Adapted from `use-reputation-status.ts`'s hand-rolled `setInterval` pattern
 * (SPEC-250 Phase 7) — same stop conditions and silent-retry-on-transient-error
 * behavior. Interval is 5s (vs reputation's 10s) because here the host is
 * actively watching the import form, not backgrounding a refresh.
 */

import type {
    AccommodationImportAsyncStartResponse,
    AccommodationImportResponse,
    ImportFailureCode
} from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { accommodationsImportApi } from '@/lib/api/endpoints-protected';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The run handle echoed back from the `202` start response. */
export type ImportRunHandle = AccommodationImportAsyncStartResponse;

/** Return shape of `useImportStatus`. */
export interface UseImportStatusResult {
    /** The finalized draft, populated only once `settled` is `true` and the run succeeded. */
    readonly draft: AccommodationImportResponse | null;
    /** Machine-readable failure, populated only once `settled` is `true` and the run failed. */
    readonly failureCode: ImportFailureCode | null;
    /** Whether the Apify run has reached a terminal state. */
    readonly settled: boolean;
    /** True while the hook is actively polling (from the first fetch until settle/error/disable). */
    readonly isPolling: boolean;
    /**
     * Non-null when the status endpoint returns a 4xx/5xx.
     * Polling is stopped at that point; the caller may show this message.
     */
    readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls the async accommodation import status endpoint while an Apify run
 * (started by the `202` branch of `POST .../import-from-url`) is in flight.
 *
 * @param runHandle - The run handle from the `202` response, or `null` when
 *   there's nothing to poll yet (e.g. the import hasn't started, or resolved
 *   synchronously with a `200`).
 * @param enabled - Whether polling should be active. Pass `false` until a
 *   `202` response is received.
 * @returns The finalized draft/failure once settled, a polling flag, and an
 *   error string.
 */
export function useImportStatus(
    runHandle: ImportRunHandle | null,
    enabled: boolean
): UseImportStatusResult {
    const [draft, setDraft] = useState<AccommodationImportResponse | null>(null);
    const [failureCode, setFailureCode] = useState<ImportFailureCode | null>(null);
    const [settled, setSettled] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stable ref to avoid stale closures inside the interval callback.
    const settledRef = useRef(settled);
    settledRef.current = settled;

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearPollInterval = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsPolling(false);
    }, []);

    /**
     * Performs a single poll of the status endpoint for the given run handle,
     * via {@link accommodationsImportApi.getStatus} (the shared `apiClient` —
     * NEVER a direct `fetch()`, which would resolve a root-relative path
     * against the web app's own origin instead of the API host).
     *
     * Returns `{ ok: false }` on a hard 4xx/5xx from the endpoint (polling
     * should stop), or `{ ok: true, settled }` on success. Transient failures
     * — network errors and client-side timeouts, surfaced by `apiClient` as
     * `error.status === 0` / `408` — resolve to `{ ok: true }` and stay
     * silent, retrying on the next tick.
     */
    const fetchStatus = useCallback(
        async (handle: ImportRunHandle): Promise<{ ok: boolean; settled?: boolean }> => {
            const result = await accommodationsImportApi.getStatus(handle);

            if (!result.ok) {
                if (result.error.status === 0 || result.error.status === 408) {
                    // Transient network error / timeout — stay silent, retry on next tick.
                    return { ok: true };
                }
                setError('status_endpoint_error');
                return { ok: false };
            }

            const { data } = result;
            setSettled(data.settled);
            if (data.settled) {
                setDraft(data.draft ?? null);
                setFailureCode(data.failureCode ?? null);
            }
            setError(null);

            return { ok: true, settled: data.settled };
        },
        []
    );

    useEffect(() => {
        if (!enabled || runHandle === null) {
            clearPollInterval();
            return;
        }

        // Reset any settled state left over from a PREVIOUS run handle so a
        // caller reusing this hook across sequential imports doesn't briefly
        // see stale settle data before the fresh fetch resolves (HOS-50 T-013).
        setSettled(false);
        setDraft(null);
        setFailureCode(null);
        setError(null);

        // Initial fetch immediately on enable.
        setIsPolling(true);
        void fetchStatus(runHandle).then(({ ok, settled: firstSettled }) => {
            if (!ok) {
                // Hard error on first fetch — don't start interval.
                setIsPolling(false);
                return;
            }
            // Use the settled value directly from the response, NOT from the
            // ref (the ref reflects the last render and may not have updated
            // yet since React batches state updates asynchronously).
            if (firstSettled === false) {
                intervalRef.current = setInterval(() => {
                    void fetchStatus(runHandle).then(({ ok: intervalOk }) => {
                        if (!intervalOk || settledRef.current) {
                            clearPollInterval();
                        }
                    });
                }, POLL_INTERVAL_MS);
            } else {
                setIsPolling(false);
            }
        });

        return () => {
            clearPollInterval();
        };
        // fetchStatus and clearPollInterval are stable via useCallback.
        // We intentionally re-run the effect only when `enabled` or
        // `runHandle` changes.
    }, [enabled, runHandle, fetchStatus, clearPollInterval]);

    // Stop the interval as soon as `settled` transitions to true mid-poll.
    useEffect(() => {
        if (settled) {
            clearPollInterval();
        }
    }, [settled, clearPollInterval]);

    return { draft, failureCode, settled, isPolling, error };
}
