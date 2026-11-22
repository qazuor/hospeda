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
const CATALOG_TTL_MS = 60_000;

let cached: { readonly at: number; readonly pending: Promise<FetchPlansResult> } | null = null;

/** Drop the shared catalog read. Tests only: production relies on the TTL. */
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
    const now = Date.now();
    if (!cached || now - cached.at > CATALOG_TTL_MS) {
        const pending = fetchPublicPlans({ vertical: 'tourist' });
        cached = { at: now, pending };
        // A failed read must not be reused for the whole window.
        void pending.then((result) => {
            if (!result.ok && cached?.pending === pending) cached = null;
        });
    }
    return planNamesWithEntitlement({ result: await cached.pending, entitlement });
}
