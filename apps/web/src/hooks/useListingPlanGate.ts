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
 * - `preTrial` the key is not held, the effective set grants `activate_trial`
 *              AND the owner holds no live non-trial title. Both conditions are
 *              needed: the pre-trial source is merged into the effective set
 *              whenever no trial row exists, EVEN for a paying owner who never
 *              trialed (`trial-and-base-sources.ts`, `resolve-effective-set.ts`).
 *              So `activate_trial` alone would tell a paid Básico owner, on an
 *              already-published listing, that publishing unlocks the feature.
 *              Only the owner with no title at all is truly pre-trial: the trial
 *              begins at the first publish and grants the top tier's
 *              entitlements, so "publish to unlock" is true for them.
 * - `plan`     the key is not held otherwise: only a plan change unlocks it.
 *
 * Built on `getEntitlementsCached` rather than `useMyEntitlements` because the
 * latter cannot distinguish "no session yet" from "resolved without the key",
 * and only the second may lock a control.
 *
 * ## A cached read never blocks on its own
 *
 * The cache is a browser-module cache with a 60 s TTL that survives ClientRouter
 * soft navigations, and nothing invalidates it when the owner's plan changes. A
 * cached answer that would OPEN the control is used as is (the API still
 * decides). A cached answer that would BLOCK is confirmed with a fresh,
 * uncached read first, and the fresh answer wins. Concurrent islands for the
 * same vertical (one brochure button per listing card) share one fresh read.
 *
 * @module hooks/useListingPlanGate
 */

import { VERTICAL_ACTIVATION_KEY, type VerticalEnum } from '@repo/schemas';
import { useEffect, useState } from 'react';
import type { EntitlementsData } from '@/lib/entitlements-cache';
import { fetchEntitlementsUncached, getEntitlementsCached } from '@/lib/entitlements-cache';

/** Fresh reads in flight, per vertical, so concurrent islands share one request. */
const freshReads = new Map<`${VerticalEnum}`, Promise<EntitlementsData>>();

/**
 * One uncached effective-set read for `vertical`, shared by every caller that
 * asks while it is in flight.
 */
function readFresh({
    vertical
}: {
    readonly vertical: `${VerticalEnum}`;
}): Promise<EntitlementsData> {
    const pending = freshReads.get(vertical);
    if (pending) return pending;
    const request = fetchEntitlementsUncached({ vertical }).finally(() => {
        freshReads.delete(vertical);
    });
    freshReads.set(vertical, request);
    return request;
}

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
    if ((data.entitlements[VERTICAL_ACTIVATION_KEY] ?? 0) > 0 && !data.hasLiveNonTrialTitle) {
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
        void (async () => {
            const cached = await getEntitlementsCached({ vertical });
            if (resolveListingPlanGate({ data: cached, entitlementKey }).gate === 'open') {
                if (!cancelled) setData(cached);
                return;
            }
            // About to block: never on the strength of a cached answer alone.
            const fresh = await readFresh({ vertical });
            if (!cancelled) setData(fresh);
        })();
        return () => {
            cancelled = true;
        };
    }, [vertical, entitlementKey]);

    return resolveListingPlanGate({ data, entitlementKey });
}
