/**
 * @file entitlements-cache.ts
 * @description Shared client-side cache + fetcher for
 * `GET /api/v1/protected/users/me/entitlements`.
 *
 * Two independent consumers need this same data on the same authenticated
 * page load: `useMyEntitlements` (React hook, drives entitlement-gated UI —
 * `PlanEntitlementGate`, `useAiTextImprove`, `useCompareGuard`, `UserMenu`)
 * and `syncPlanPersonProperties` (PostHog analytics sync, fired from
 * `UserMenu.client.tsx` on every page load). Before this module existed each
 * kept its own module-level cache and its own `fetch`, so an authenticated
 * page load could hit the endpoint twice. Centralizing the cache (60 s TTL,
 * matching the API-side cache) and de-duplicating concurrent in-flight
 * requests means the endpoint is hit at most once per TTL window regardless
 * of how many consumers ask for it.
 *
 * @module lib/entitlements-cache
 */

import { getApiUrl } from '@/lib/env';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed response shape from the entitlements endpoint. */
export interface EntitlementsData {
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
    readonly plan: {
        readonly slug: string;
        readonly name: string;
        readonly status: string;
    } | null;
    readonly asOf: string;
}

// ---------------------------------------------------------------------------
// Cache (module-level singleton — shared across every consumer)
// ---------------------------------------------------------------------------

/** Cache TTL, matching the API-side entitlements cache. */
export const ENTITLEMENTS_CACHE_TTL_MS = 60_000;

interface CacheEntry {
    readonly data: EntitlementsData;
    readonly timestamp: number;
}

let sharedCache: CacheEntry | null = null;

/** A single fetch shared by every caller that races in before it settles. */
let inFlightRequest: Promise<EntitlementsData> | null = null;

function getCachedData(): EntitlementsData | null {
    if (!sharedCache) return null;
    if (Date.now() - sharedCache.timestamp > ENTITLEMENTS_CACHE_TTL_MS) {
        sharedCache = null;
        return null;
    }
    return sharedCache.data;
}

function setCachedData(data: EntitlementsData): void {
    sharedCache = { data, timestamp: Date.now() };
}

/**
 * Clears the module-level entitlements cache and any in-flight request.
 * Exported for test isolation only — not part of the public API.
 */
export function clearEntitlementsCache(): void {
    sharedCache = null;
    inFlightRequest = null;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchEntitlements(): Promise<EntitlementsData> {
    const response = await fetch(`${getApiUrl()}/api/v1/protected/users/me/entitlements`, {
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current user's entitlements, either from cache (fresh within
 * `ENTITLEMENTS_CACHE_TTL_MS`) or a fresh network fetch.
 *
 * Concurrent callers that race in before the network request settles (e.g.
 * `useMyEntitlements` and `syncPlanPersonProperties` both resolving on the
 * same page load) share a single in-flight request instead of each firing
 * their own — this is what keeps the endpoint to one call per TTL window.
 *
 * @returns The cached or freshly-fetched entitlements payload.
 * @throws {Error} If the underlying fetch fails or the response is not ok.
 *
 * @example
 * ```ts
 * const { plan } = await getEntitlementsCached();
 * ```
 */
export function getEntitlementsCached(): Promise<EntitlementsData> {
    const cached = getCachedData();
    if (cached) return Promise.resolve(cached);

    if (!inFlightRequest) {
        inFlightRequest = fetchEntitlements()
            .then((data) => {
                setCachedData(data);
                return data;
            })
            .finally(() => {
                inFlightRequest = null;
            });
    }
    return inFlightRequest;
}
