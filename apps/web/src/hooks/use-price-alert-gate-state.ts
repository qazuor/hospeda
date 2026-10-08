/**
 * @file use-price-alert-gate-state.ts
 * @description Resolves the accommodation-detail price-alert state in the
 * browser (HOS-369 WB0-7).
 *
 * The accommodation detail page is edge-cacheable, so the visitor's existing
 * alerts are read here, after hydration, through `priceAlertsApi.list()`.
 *
 * The plan gate this hook also used to resolve — `canCreateAlerts` and
 * `maxReached`, read from the old billing's entitlements — was removed with the
 * old billing client (HOS-1637, AC:B13a:21 / AC:B13a:22). Whether a visitor may
 * create an alert is decided by the API when they try (`POST
 * /protected/price-alerts`), and `PriceAlertButton` surfaces its refusal; the
 * screen no longer repeats that decision.
 */

import { useEffect, useState } from 'react';
import { priceAlertsApi } from '@/lib/api/endpoints-protected';

/** Everything `PriceAlertButton` needs to pick its rendering branch. */
export interface PriceAlertGateSnapshot {
    /** Whether the actor already holds an alert for THIS accommodation. */
    readonly hasAlert: boolean;
    /** Id of that alert (needed to `DELETE` it), `null` when there is none. */
    readonly alertId: string | null;
    /**
     * Whether the lookup is still in flight. `true` from mount until it
     * settles; `false` immediately when `skip` is set, since there is nothing
     * to resolve.
     */
    readonly isResolving: boolean;
}

/** Settled state with no alert: the guest answer and the failed-lookup answer. */
const NO_ALERT: PriceAlertGateSnapshot = {
    hasAlert: false,
    alertId: null,
    isResolving: false
};

/**
 * Resolve the visitor's price-alert state for one accommodation.
 *
 * @param params - `{ accommodationId, skip }` (RO-RO). `skip` short-circuits
 *   the whole resolution (used for a visitor with no session, who has nothing
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
    const [snapshot, setSnapshot] = useState<PriceAlertGateSnapshot>(NO_ALERT);

    useEffect(() => {
        if (skip) {
            setSnapshot(NO_ALERT);
            return;
        }
        let cancelled = false;
        setSnapshot({ ...NO_ALERT, isResolving: true });

        void (async () => {
            let hasAlert = false;
            let alertId: string | null = null;
            try {
                const alertsResult = await priceAlertsApi.list({});
                // The list endpoint returns the actor's full set — there is no
                // `accommodationId` query filter, so match locally.
                if (alertsResult.ok) {
                    const match = (alertsResult.data.items ?? []).find(
                        (item) => item.accommodationId === accommodationId
                    );
                    if (match) {
                        hasAlert = true;
                        alertId = match.id;
                    }
                }
            } catch {
                // A failed lookup reads as "no alert": the create action stays
                // available and the API answers for it.
            }
            if (cancelled) return;
            setSnapshot({ hasAlert, alertId, isResolving: false });
        })();

        return () => {
            cancelled = true;
        };
    }, [accommodationId, skip]);

    return snapshot;
}
