import type { VerticalEnum } from '@repo/schemas';
import { effectiveSetApi } from '@/lib/api/endpoints-protected';

/**
 * HOS-1769: This module cache is for browser reads only. Its key is the vertical
 * because a browser module belongs to one user. Server reads must use
 * fetchEntitlementsUncached with their request's cookieHeader.
 */
export const ENTITLEMENTS_CACHE_TTL_MS = 60_000;

/** Effective entitlements and limits returned by the protected API. */
export interface EntitlementsData {
    readonly entitlements: Readonly<Record<string, number>>;
    readonly limits: Readonly<Record<string, number>>;
    readonly hasLiveNonTrialTitle: boolean;
    /** Photo caps a pre-trial owner's DRAFT accepts (HOS-1721); absent otherwise. */
    readonly preTrialDraftLimits?: Readonly<Record<string, number>>;
    readonly failed: boolean;
}

const absent = (): EntitlementsData => ({
    entitlements: {},
    limits: {},
    hasLiveNonTrialTitle: false,
    failed: true
});

interface CacheEntry {
    readonly data: EntitlementsData;
    readonly timestamp: number;
}

const cache = new Map<`${VerticalEnum}`, CacheEntry>();
const inFlight = new Map<`${VerticalEnum}`, Promise<EntitlementsData>>();

/** Reads the effective set once without storing it in a module or request cache. */
export async function fetchEntitlementsUncached({
    vertical,
    cookieHeader
}: {
    readonly vertical: `${VerticalEnum}`;
    readonly cookieHeader?: string;
}): Promise<EntitlementsData> {
    try {
        const result = await effectiveSetApi.get({ vertical, cookieHeader });
        if (!result.ok) return absent();
        return { ...result.data, failed: false };
    } catch {
        return absent();
    }
}

/** Clears the browser-only entitlements cache and in-flight reads. */
export function clearEntitlementsCache(): void {
    cache.clear();
    inFlight.clear();
}

/** Reads and caches effective entitlements for a browser's current user. */
export function getEntitlementsCached({
    vertical
}: {
    readonly vertical: `${VerticalEnum}`;
}): Promise<EntitlementsData> {
    const cached = cache.get(vertical);
    if (cached && Date.now() - cached.timestamp <= ENTITLEMENTS_CACHE_TTL_MS)
        return Promise.resolve(cached.data);
    if (cached) cache.delete(vertical);
    const pending = inFlight.get(vertical);
    if (pending) return pending;
    const request = fetchEntitlementsUncached({ vertical })
        .then((data) => {
            if (!data.failed) cache.set(vertical, { data, timestamp: Date.now() });
            return data;
        })
        .finally(() => {
            inFlight.delete(vertical);
        });
    inFlight.set(vertical, request);
    return request;
}
