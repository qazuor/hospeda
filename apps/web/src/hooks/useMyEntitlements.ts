/**
 * @file useMyEntitlements.ts
 * @description Hook for fetching the current user's plan entitlements.
 *
 * Calls GET /api/v1/protected/users/me/entitlements and returns a typed
 * convenience object so callers can do `has('can_use_rich_description')`
 * instead of checking raw string arrays.
 *
 * The fetch + 60 s cache (matching the API-side cache TTL) live in the
 * shared `@/lib/entitlements-cache` module — `syncPlanPersonProperties`
 * (PostHog analytics) reads through the same cache, so an authenticated
 * page load hits the endpoint at most once per TTL window instead of once
 * per consumer.
 *
 * @module hooks/useMyEntitlements
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import {
    clearEntitlementsCache as clearSharedEntitlementsCache,
    getEntitlementsCached
} from '@/lib/entitlements-cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input for useMyEntitlements. */
export interface UseMyEntitlementsParams {
    /**
     * Skip resolving entirely (RO-RO, default `false`). For a caller that
     * already knows entitlements are irrelevant for the current actor — e.g.
     * `MobileMenu.client.tsx` (HOS-217) only needs them to refine its
     * HOST-only CTA, so every non-HOST authenticated visitor should never
     * pay for the fetch even though the hook itself must be called
     * unconditionally (rules of hooks). When `true`, `data` stays `null`
     * (so `has()` fails closed, same shape as the guest/no-session case) and
     * `isLoading` resolves to `false` without ever touching the network.
     * Every existing call site omits this and is unaffected.
     */
    readonly skip?: boolean;
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
// Cache
// ---------------------------------------------------------------------------

/**
 * Clear the shared entitlements cache (see `@/lib/entitlements-cache`).
 * Exported for test isolation only — not part of the public API.
 */
export function clearEntitlementsCache(): void {
    clearSharedEntitlementsCache();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches and caches the current user's plan entitlements.
 *
 * @param params - `{ skip? }` (RO-RO). See {@link UseMyEntitlementsParams}.
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
export function useMyEntitlements(params: UseMyEntitlementsParams = {}): UseMyEntitlementsReturn {
    const { skip = false } = params;
    // Initial state is deliberately hydration-safe: it must NOT depend on the
    // shared entitlements cache. During SSR the cache is always empty
    // (isLoading=true), but on the client another island may have already
    // populated it, so a lazy `() => getEntitlementsCached()` initializer
    // would yield a DIFFERENT first render on the client (isLoading=false)
    // and trip React's hydration mismatch on `aria-busy` (HOS-85). Both
    // server and the first client render therefore start from `null`/`true`;
    // the cache is read in the effect below, one tick later, once hydration
    // has already matched.
    const [data, setData] = useState<EntitlementsData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    // The entitlements endpoint lives under /protected and 401s for guests.
    // Gate the fetch on a resolved session so unauthenticated visitors never
    // call it — a guest previously triggered a fetch on every island mount and
    // soft-navigation, and because a 401 is never cached each mount re-fired,
    // climbing the rate limiter until it sustained 429 (HOS-109 T-005).
    const { data: session, isPending: isSessionPending } = useSession();
    const hasSession = !!session;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        // Caller opted out entirely (e.g. a non-HOST actor in MobileMenu) —
        // resolve immediately to the same "fails closed" shape as the
        // guest/no-session branch below, without ever touching the network.
        if (skip) {
            setData(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        // Re-assert the loading state on every meaningful effect re-run (this
        // line only runs when `skip` is false). A caller that un-skips
        // (`skip: true -> false`, e.g. MobileMenu once `role` resolves to
        // HOST) may already have a stale `isLoading=false` left over from the
        // skip branch above — without this, that stale resolved-false would
        // leak into the un-skipped render instead of correctly going back to
        // "loading" while the (now-relevant) session/entitlements resolve.
        // A no-op re-render when already `true` (the common, non-un-skip case).
        setIsLoading(true);

        // Session not resolved yet: stay in the loading state (has() fails
        // closed) and let the effect re-run once it settles. This also keeps
        // the initial render hydration-safe (isLoading=true on both sides).
        if (isSessionPending) {
            return;
        }

        // Guest / no session: never hit the protected endpoint. data stays null
        // so has() returns false (the non-entitled variant), same end-state a
        // guest reached before via the 401 catch — but without the network churn.
        if (!hasSession) {
            setData(null);
            setError(null);
            setIsLoading(false);
            return;
        }

        // getEntitlementsCached() resolves from the shared cache when fresh
        // (skipping the network entirely) or shares a single in-flight fetch
        // with any other consumer racing in at the same time (e.g.
        // `syncPlanPersonProperties`), then populates the cache for both.
        let cancelled = false;

        getEntitlementsCached()
            .then((result) => {
                if (cancelled || !mountedRef.current) return;
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
    }, [isSessionPending, hasSession, skip]);

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
