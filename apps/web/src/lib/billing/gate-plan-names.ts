/**
 * @file billing/gate-plan-names.ts
 * @description Server-only reader of the plan names behind a tourist feature gate, for
 * islands that sit in components rendered many times per page (listing cards) where the
 * page cannot hand the names down one by one. HOS-2554: a gate never names a plan by hand;
 * the names come from the public catalog, which is not per-user, so reading it keeps a
 * cacheable page session-blind. The catalog read is shared across callers for a short
 * window so a page of N cards costs one request, not N.
 */

import { type FetchPlansResult, fetchPublicPlans, planNamesWithEntitlement } from './fetch-plans';

/** How long a successful catalog read is reused. A plan change shows up within this window. */
export const CATALOG_TTL_MS = 60_000;

/**
 * How long a FAILED read is reused. Short, so a recovered API is picked up quickly, but not
 * zero: with the API down, dropping the failure made every card on the page fetch again, N
 * requests (each up to the read timeout) per render.
 */
export const CATALOG_FAILURE_TTL_MS = 15_000;

interface CatalogEntry {
    readonly expiresAt: number;
    readonly pending: Promise<FetchPlansResult>;
    /** Set once the read failed and the entry was cut down to the failure window. */
    readonly failed?: true;
}

let cached: CatalogEntry | null = null;

/** Drop the shared catalog read. Tests only: production relies on the TTLs. */
export function clearGatePlanCatalogCache(): void {
    cached = null;
}

/**
 * Names of the tourist plans that grant `entitlement`, in catalog order. Yields no names when
 * the catalog cannot be read, so the gate's copy names no plan rather than a guessed one.
 */
export async function getGatePlanNames({
    entitlement
}: {
    readonly entitlement: string;
}): Promise<readonly string[]> {
    if (!cached || Date.now() >= cached.expiresAt) {
        const pending = fetchPublicPlans({ vertical: 'tourist' });
        cached = { expiresAt: Date.now() + CATALOG_TTL_MS, pending };
    }
    const entry = cached;
    const result = await entry.pending;
    // A failed read is reused only for the short failure window, counted from when it failed.
    if (!result.ok && cached === entry && !entry.failed) {
        cached = {
            expiresAt: Date.now() + CATALOG_FAILURE_TTL_MS,
            pending: entry.pending,
            failed: true
        };
    }
    return planNamesWithEntitlement({ result, entitlement });
}
