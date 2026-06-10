/**
 * @file useMyEntitlements.ts
 * @description Hook for fetching the current user's plan entitlements.
 *
 * Calls GET /api/v1/protected/users/me/entitlements and returns a typed
 * convenience object so callers can do `has('can_use_rich_description')`
 * instead of checking raw string arrays.
 *
 * Caches the result for 60 s (matching the API-side cache TTL) so that
 * all entitlement-gated fields on the same page share a single in-flight
 * request.
 *
 * @module hooks/useMyEntitlements
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed response shape from the entitlements endpoint. */
interface EntitlementsData {
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
    readonly plan: {
        readonly slug: string;
        readonly name: string;
        readonly status: string;
    } | null;
    readonly asOf: string;
}

/** Return type for useMyEntitlements. */
export interface UseMyEntitlementsReturn {
    /**
     * Returns true if the current user's plan includes the given entitlement
     * key. Returns false while loading or on error (fail-closed).
     */
    readonly has: (key: string) => boolean;
    /**
     * Returns the numeric limit for a given limit key, or -1 (unlimited) when
     * the key is absent from the plan.
     */
    readonly limit: (key: string) => number;
    /** Raw plan metadata (null when the user has no active subscription). */
    readonly plan: EntitlementsData['plan'];
    readonly isLoading: boolean;
    readonly error: Error | null;
}

// ---------------------------------------------------------------------------
// Cache (module-level singleton — shared across all hook instances)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
    readonly data: EntitlementsData;
    readonly timestamp: number;
}

let sharedCache: CacheEntry | null = null;

function getCachedData(): EntitlementsData | null {
    if (!sharedCache) return null;
    if (Date.now() - sharedCache.timestamp > CACHE_TTL_MS) {
        sharedCache = null;
        return null;
    }
    return sharedCache.data;
}

function setCachedData(data: EntitlementsData): void {
    sharedCache = { data, timestamp: Date.now() };
}

/**
 * Clear the module-level entitlements cache.
 * Exported for test isolation only — not part of the public API.
 */
export function clearEntitlementsCache(): void {
    sharedCache = null;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchEntitlements(): Promise<EntitlementsData> {
    const response = await fetch('/api/v1/protected/users/me/entitlements', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
            body && typeof body === 'object' && 'error' in body
                ? (body as { error: { message: string } }).error.message
                : `Entitlements request failed with status ${response.status}`;
        throw new Error(message);
    }

    const raw = await response.json();
    // API wraps in { success, data } — unwrap
    const payload = raw?.data ?? raw;
    return {
        entitlements: payload.entitlements ?? [],
        limits: payload.limits ?? {},
        plan: payload.plan ?? null,
        asOf: payload.asOf ?? ''
    };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches and caches the current user's plan entitlements.
 *
 * @returns A typed convenience object for checking entitlement flags and
 *   limit values.
 *
 * @example
 * ```tsx
 * const { has, isLoading } = useMyEntitlements();
 * if (!isLoading && !has('can_use_rich_description')) {
 *   return <PlainTextarea />;
 * }
 * return <RichEditor />;
 * ```
 */
export function useMyEntitlements(): UseMyEntitlementsReturn {
    const [data, setData] = useState<EntitlementsData | null>(() => getCachedData());
    const [isLoading, setIsLoading] = useState<boolean>(() => !getCachedData());
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        // If we have cached data, skip fetch
        const cached = getCachedData();
        if (cached) {
            setData(cached);
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        fetchEntitlements()
            .then((result) => {
                if (cancelled || !mountedRef.current) return;
                setCachedData(result);
                setData(result);
                setError(null);
                setIsLoading(false);
            })
            .catch((err: unknown) => {
                if (cancelled || !mountedRef.current) return;
                setError(err instanceof Error ? err : new Error(String(err)));
                setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const entitlementSet = new Set(data?.entitlements ?? []);

    const has = useCallback(
        (key: string): boolean => {
            // Fail-closed: return false while loading or on error
            if (!data) return false;
            return entitlementSet.has(key);
        },
        [data, entitlementSet]
    );

    const limit = useCallback(
        (key: string): number => {
            if (!data) return -1;
            return data.limits[key] ?? -1;
        },
        [data]
    );

    return {
        has,
        limit,
        plan: data?.plan ?? null,
        isLoading,
        error
    };
}
