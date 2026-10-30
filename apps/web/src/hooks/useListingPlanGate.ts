/**
 * @file useListingPlanGate.ts
 * @description Tells a venue or experience owner island, BEFORE the owner clicks, whether
 * one entitlement-gated action will work, and if not, why.
 *
 * The venue/experience owner surfaces used to learn about a missing
 * entitlement from the API's `403 ENTITLEMENT_REQUIRED`, after the owner had
 * already picked a file or pressed a button. This hook reads the same source
 * the API's listing-access gate reads (the owner's effective set for the
 * vertical, `GET /protected/users/me/effective-set`) so the island can render
 * the control disabled, or as an upsell, from the start.
 *
 * Three answers, because "you do not have it" splits in two for the owner:
 *
 * - `open`     the key is held, OR the read is still pending, OR it failed.
 *              The last two fail OPEN on purpose: the API still enforces the
 *              gate, so the worst case is the old behaviour (a refusal after
 *              the click), never a Premium owner shown a lock they do not have.
 * - `preTrial` the key is not held and the effective set still grants
 *              `activate_trial`: the owner has never started the vertical's
 *              trial, which begins when the listing is first published and
 *              grants the top tier's entitlements. "Publish to unlock" is true.
 * - `plan`     the key is not held and no trial is available: only a plan
 *              change unlocks it.
 *
 * Built on `getEntitlementsCached` rather than `useMyEntitlements` because the
 * latter cannot distinguish "no session yet" from "resolved without the key",
 * and only the second may lock a control.
 *
 * @module hooks/useListingPlanGate
 */

import type { VerticalEnum } from '@repo/schemas';
import { useEffect, useState } from 'react';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import { getEntitlementsCached } from '@/lib/entitlements-cache';

/** Entitlement the pre-trial plan grants; its presence means "trial not started yet". */
const ACTIVATE_TRIAL_KEY = 'activate_trial';

/** What the gate answers for one entitlement key. */
export type ListingPlanGate = 'open' | 'preTrial' | 'plan';

/**
 * Pure resolution of {@link ListingPlanGate} from an effective-set read.
 *
 * @param input.data - The effective set, or `null` while it is still loading.
 * @param input.entitlementKey - The entitlement the action requires.
 * @returns `{ gate }` — see the module docblock for each value.
 */
export function resolveListingPlanGate({
    data,
    entitlementKey
}: {
    readonly data: EntitlementsData | null;
    readonly entitlementKey: string;
}): { readonly gate: ListingPlanGate } {
    if (data === null || data.failed) {
        return { gate: 'open' };
    }
    if ((data.entitlements[entitlementKey] ?? 0) > 0) {
        return { gate: 'open' };
    }
    if ((data.entitlements[ACTIVATE_TRIAL_KEY] ?? 0) > 0) {
        return { gate: 'preTrial' };
    }
    return { gate: 'plan' };
}

/**
 * React hook over {@link resolveListingPlanGate}. Starts `open` (hydration-safe,
 * no lock flashes in for an owner who holds the key) and settles once the
 * cached effective set arrives.
 *
 * @param input.vertical - The vertical whose effective set to read.
 * @param input.entitlementKey - The entitlement the action requires.
 * @returns `{ gate }`.
 */
export function useListingPlanGate({
    vertical,
    entitlementKey
}: {
    readonly vertical: `${VerticalEnum}`;
    readonly entitlementKey: string;
}): { readonly gate: ListingPlanGate } {
    const [data, setData] = useState<EntitlementsData | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getEntitlementsCached({ vertical }).then((result) => {
            if (!cancelled) {
                setData(result);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [vertical]);

    return resolveListingPlanGate({ data, entitlementKey });
}
