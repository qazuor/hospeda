/**
 * @file use-reputation-status.ts
 * @description Polling hook for per-platform async reputation run status.
 *
 * Polls `GET /api/v1/protected/accommodations/:id/external-reputation/status`
 * every ~10 s while `enabled = true` and `allSettled = false`. Stops polling
 * automatically when `allSettled` becomes true or when the component unmounts.
 *
 * Behaviour on errors:
 *  - Transient fetch errors (network unreachable, non-4xx/5xx): silent retry.
 *  - 4xx/5xx from the endpoint: stops polling, sets `error`.
 *
 * SPEC-250 Phase 7 — Owner UI polling hook.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Run status values that map to the DB `run_status` column. */
export type RunStatus = 'idle' | 'pending' | 'running';

/** Fetch status values that map to the DB `fetch_status` column. */
export type FetchStatus = 'ok' | 'error' | 'blocked' | 'not_found';

/** Per-platform status snapshot returned by the status endpoint. */
export interface ReputationPlatformStatus {
    /** Current async run state for this platform. */
    readonly runStatus: RunStatus;
    /** Last fetch result for this platform. */
    readonly fetchStatus: FetchStatus;
    /** Aggregate rating (0-10 scale), or null if not yet fetched. */
    readonly rating: number | null;
    /** Total number of reviews, or null if not yet fetched. */
    readonly reviewsCount: number | null;
    /** ISO 8601 string of the last successful fetch, or null. */
    readonly aggregateFetchedAt: string | null;
}

/** Return shape of `useReputationStatus`. */
export interface UseReputationStatusResult {
    /** Per-platform status map. Keys are platform identifiers (e.g. 'GOOGLE'). */
    readonly platforms: Readonly<Partial<Record<string, ReputationPlatformStatus>>>;
    /** True when every platform has `runStatus = 'idle'`. */
    readonly allSettled: boolean;
    /** True during the initial fetch (before any data is available). */
    readonly loading: boolean;
    /**
     * Non-null when the status endpoint returns a 4xx/5xx.
     * Polling is stopped at that point; the caller may show this message.
     */
    readonly error: string | null;
}

/** Raw shape of the status endpoint response body. */
interface StatusApiResponse {
    readonly success: boolean;
    readonly data: {
        readonly platforms: Record<
            string,
            {
                readonly runStatus: RunStatus;
                readonly fetchStatus: FetchStatus;
                readonly rating: number | null;
                readonly reviewsCount: number | null;
                readonly aggregateFetchedAt: string | null;
            }
        >;
        readonly allSettled: boolean;
    };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;
const STATUS_BASE = '/api/v1/protected/accommodations';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls the external reputation status endpoint while async Apify runs are in
 * flight for the given accommodation.
 *
 * @param accommodationId - UUID of the accommodation to poll.
 * @param enabled - Whether polling should be active. Pass `false` when the
 *   owner has not triggered a refresh (avoids unnecessary requests on mount).
 *   When set to `true` the hook immediately fetches, then polls every 10 s.
 * @returns Status data, a settled flag, a loading flag, and an error string.
 */
export function useReputationStatus(
    accommodationId: string,
    enabled: boolean
): UseReputationStatusResult {
    const [platforms, setPlatforms] = useState<
        Readonly<Partial<Record<string, ReputationPlatformStatus>>>
    >({});
    const [allSettled, setAllSettled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stable ref to avoid stale closures inside the interval callback.
    const allSettledRef = useRef(allSettled);
    allSettledRef.current = allSettled;

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearPollInterval = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    /**
     * Performs a single fetch of the status endpoint.
     * Returns an object indicating:
     *  - `ok`: false when a hard 4xx/5xx error occurred (polling should stop).
     *  - `settled`: the `allSettled` value from the response (or undefined on error/throw).
     * On transient fetch errors (network throw) returns `{ ok: true, settled: undefined }`.
     */
    const fetchStatus = useCallback(async (): Promise<{ ok: boolean; settled?: boolean }> => {
        try {
            const res = await fetch(
                `${STATUS_BASE}/${accommodationId}/external-reputation/status`,
                { credentials: 'include' }
            );

            if (!res.ok) {
                // Hard error — stop polling.
                setError('status_endpoint_error');
                return { ok: false };
            }

            const body = (await res.json()) as StatusApiResponse;
            const data = body.data;

            setPlatforms(
                data.platforms as Readonly<Partial<Record<string, ReputationPlatformStatus>>>
            );
            setAllSettled(data.allSettled);
            setError(null);

            return { ok: true, settled: data.allSettled };
        } catch {
            // Transient network error — stay silent, retry on next tick.
            return { ok: true };
        }
    }, [accommodationId]);

    useEffect(() => {
        if (!enabled) {
            clearPollInterval();
            return;
        }

        // Initial fetch immediately on enable.
        setLoading(true);
        void fetchStatus().then(({ ok, settled }) => {
            setLoading(false);
            if (!ok) {
                // Hard error on first fetch — don't start interval.
                return;
            }
            // Use the settled value directly from the response, NOT from the ref
            // (the ref reflects the last render and may not have updated yet
            // since React batches state updates asynchronously).
            if (settled === false) {
                intervalRef.current = setInterval(() => {
                    void fetchStatus().then(({ ok: intervalOk }) => {
                        if (!intervalOk || allSettledRef.current) {
                            clearPollInterval();
                        }
                    });
                }, POLL_INTERVAL_MS);
            }
        });

        return () => {
            clearPollInterval();
        };
        // fetchStatus and clearPollInterval are stable via useCallback.
        // We intentionally re-run the effect only when `enabled` or
        // `accommodationId` changes (which are captured in fetchStatus).
    }, [enabled, fetchStatus, clearPollInterval]);

    // Stop interval when allSettled transitions to true mid-poll.
    useEffect(() => {
        if (allSettled) {
            clearPollInterval();
        }
    }, [allSettled, clearPollInterval]);

    return { platforms, allSettled, loading, error };
}
