import type { VerticalEnum } from '@repo/schemas';
import { effectiveSetApi } from '@/lib/api/endpoints-protected';

export const ENTITLEMENTS_CACHE_TTL_MS = 60_000;
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

export function clearEntitlementsCache(): void {
    cache.clear();
    inFlight.clear();
}

export function getEntitlementsCached({
    vertical,
    cookieHeader
}: {
    readonly vertical: `${VerticalEnum}`;
    readonly cookieHeader?: string;
}): Promise<EntitlementsData> {
    const cached = cache.get(vertical);
    if (cached && Date.now() - cached.timestamp <= ENTITLEMENTS_CACHE_TTL_MS)
        return Promise.resolve(cached.data);
    if (cached) cache.delete(vertical);
    const pending = inFlight.get(vertical);
    if (pending) return pending;
    const request = effectiveSetApi
        .get({ vertical, cookieHeader })
        .then((result) => {
            if (!result.ok) return absent();
            const data: EntitlementsData = { ...result.data, failed: false };
            cache.set(vertical, { data, timestamp: Date.now() });
            return data;
        })
        .catch(() => absent())
        .finally(() => {
            inFlight.delete(vertical);
        });
    inFlight.set(vertical, request);
    return request;
}
