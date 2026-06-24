/**
 * @file use-tour-state.ts
 * @description Hook for reading and persisting web tour seen-state via the
 * protected settings API.
 *
 * Mirror of the admin's `useAdminTourState` (SPEC-174), adapted for the web
 * app's data-fetching pattern (no TanStack Query — uses fetch + useState).
 *
 * Tour state is stored in `user_settings.onboarding.webTours` as a map of
 * `Record<string, number>` (tourId → version).
 */

import { getApiUrl } from '@/lib/env';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TourProgressBody {
    readonly tourId: string;
    readonly version: number;
}

export interface UseTourStateReturn {
    readonly isLoading: boolean;
    readonly error: Error | null;
    readonly hasSeen: (input: { tourId: string; version: number }) => boolean;
    readonly markSeen: (input: { tourId: string; version: number }) => void;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

interface TourStateData {
    readonly tours: Record<string, number>;
}

let sharedTourState: { data: TourStateData; timestamp: number } | null = null;

const CACHE_TTL = 60_000;

function getCachedState(): TourStateData | null {
    if (!sharedTourState) return null;
    if (Date.now() - sharedTourState.timestamp > CACHE_TTL) {
        sharedTourState = null;
        return null;
    }
    return sharedTourState.data;
}

function setCachedState(data: TourStateData): void {
    sharedTourState = { data, timestamp: Date.now() };
}

export function clearTourStateCache(): void {
    sharedTourState = null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reads and persists tour seen-state via the protected tour-progress endpoint.
 *
 * @example
 * ```tsx
 * const { isLoading, hasSeen, markSeen } = useTourState();
 *
 * // Check if a tour has been seen
 * if (!hasSeen({ tourId: 'host.welcome', version: 1 })) {
 *   // Start the tour
 * }
 *
 * // Mark as seen when the tour completes
 * markSeen({ tourId: 'host.welcome', version: 1 });
 * ```
 */
export function useTourState(): UseTourStateReturn {
    const [tourState, setTourState] = useState<TourStateData | null>(() => getCachedState());
    const [isLoading, setIsLoading] = useState<boolean>(() => !getCachedState());
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const cached = getCachedState();
        if (cached) {
            setTourState(cached);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        async function fetchTourState(): Promise<void> {
            try {
                const res = await fetch(`${getApiUrl()}/api/v1/protected/users/me/tour-progress`, {
                    credentials: 'include'
                });

                if (cancelled || !mountedRef.current) return;

                if (!res.ok) {
                    throw new Error(`Failed to fetch tour state: ${res.status}`);
                }

                const body = (await res.json()) as {
                    readonly data?: { readonly tours?: Record<string, number> };
                };

                const data: TourStateData = {
                    tours: body.data?.tours ?? {}
                };

                setCachedState(data);
                if (!cancelled && mountedRef.current) {
                    setTourState(data);
                    setError(null);
                    setIsLoading(false);
                }
            } catch (err) {
                if (cancelled || !mountedRef.current) return;
                setError(err instanceof Error ? err : new Error(String(err)));
                setIsLoading(false);
            }
        }

        void fetchTourState();

        return () => {
            cancelled = true;
        };
    }, []);

    const hasSeen = useCallback(
        ({ tourId, version }: { tourId: string; version: number }): boolean => {
            if (!tourState) return false;
            const seenVersion = tourState.tours[tourId];
            if (seenVersion === undefined) return false;
            return seenVersion >= version;
        },
        [tourState]
    );

    const markSeen = useCallback(
        ({ tourId, version }: { tourId: string; version: number }): void => {
            setTourState((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    tours: { ...prev.tours, [tourId]: version }
                };
            });

            const body: TourProgressBody = { tourId, version };

            fetch(`${getApiUrl()}/api/v1/protected/users/me/tour-progress`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }).catch(() => {
                // Optimistic — ignore errors
            });
        },
        []
    );

    return { isLoading, error, hasSeen, markSeen };
}
