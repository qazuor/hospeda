/**
 * @file use-price-alert-gate-state.ts
 * @description Resolves the accommodation-detail price-alert gate in the
 * browser (HOS-369 WB0-7).
 *
 * The accommodation detail page used to compute this during SSR — one
 * `priceAlertsApi.list()` for the actor's existing alerts plus one
 * `billingApi.getEntitlements()` for the plan gate — and hand the four
 * resulting booleans to `PriceAlertButton` as props. All four are per-visitor,
 * so none can survive in an edge-cached document; the pair of calls moves here.
 *
 * Both endpoints are already browser-safe: their `cookieHeader` parameter is
 * the SSR-only escape hatch, and `apiClient.getProtected` sends
 * `credentials: 'include'`, so a browser call carries the session on its own.
 *
 * Failure and the not-yet-resolved window both degrade to the LOCKED state
 * (`canCreateAlerts: false`), matching `resolvePriceAlertGateState`'s own
 * fail-closed contract: offering a create button the plan does not allow would
 * bounce the visitor off a 403.
 */

import { useEffect, useState } from 'react';
import { billingApi, priceAlertsApi } from '@/lib/api/endpoints-protected';
import { type PriceAlertGateState, resolvePriceAlertGateState } from '@/lib/price-alert-gate';

/** Everything `PriceAlertButton` needs to pick its rendering branch. */
export interface PriceAlertGateSnapshot extends PriceAlertGateState {
    /** Whether the actor already holds an alert for THIS accommodation. */
    readonly hasAlert: boolean;
    /** Id of that alert (needed to `DELETE` it), `null` when there is none. */
    readonly alertId: string | null;
    /**
     * Whether the two lookups are still in flight. `true` from mount until they
     * settle; `false` immediately when `skip` is set, since there is nothing to
     * resolve.
     */
    readonly isResolving: boolean;
}

/** Locked, settled state: the fail-closed answer and the guest answer. */
const LOCKED: PriceAlertGateSnapshot = {
    hasAlert: false,
    alertId: null,
    canCreateAlerts: false,
    maxReached: false,
    isResolving: false
};

/**
 * Resolve the visitor's price-alert gate for one accommodation.
 *
 * @param params - `{ accommodationId, skip }` (RO-RO). `skip` short-circuits
 *   the whole resolution (used for a visitor with no session, who has no gate
 *   to resolve and must not be charged a protected round-trip).
 * @returns The current {@link PriceAlertGateSnapshot}.
 */
export function usePriceAlertGateState({
    accommodationId,
    skip = false
}: {
    readonly accommodationId: string;
    readonly skip?: boolean;
}): PriceAlertGateSnapshot {
    const [snapshot, setSnapshot] = useState<PriceAlertGateSnapshot>(LOCKED);

    useEffect(() => {
        if (skip) {
            setSnapshot(LOCKED);
            return;
        }
        let cancelled = false;
        setSnapshot({ ...LOCKED, isResolving: true });

        void (async () => {
            const [alertsResult, entitlementsResult] = await Promise.allSettled([
                priceAlertsApi.list({}),
                billingApi.getEntitlements({})
            ]);
            if (cancelled) return;

            // The list endpoint is ungated and returns the actor's full set —
            // there is no `accommodationId` query filter, so match locally.
            let existingAlertsCount = 0;
            let hasAlert = false;
            let alertId: string | null = null;
            if (alertsResult.status === 'fulfilled' && alertsResult.value.ok) {
                const items = alertsResult.value.data.items ?? [];
                existingAlertsCount = items.length;
                const match = items.find((item) => item.accommodationId === accommodationId);
                if (match) {
                    hasAlert = true;
                    alertId = match.id;
                }
            }

            const gate =
                entitlementsResult.status === 'fulfilled'
                    ? resolvePriceAlertGateState(entitlementsResult.value, existingAlertsCount)
                    : { canCreateAlerts: false, maxReached: false };

            setSnapshot({ ...gate, hasAlert, alertId, isResolving: false });
        })();

        return () => {
            cancelled = true;
        };
    }, [accommodationId, skip]);

    return snapshot;
}
