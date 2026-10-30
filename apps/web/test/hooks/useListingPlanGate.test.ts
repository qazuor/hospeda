/**
 * @file useListingPlanGate.test.ts
 * @description The pure resolution behind the commerce-owner plan gate.
 *
 * The load-bearing property is the fail-OPEN direction: a pending or failed
 * effective-set read must never lock a control, because the API still enforces
 * the gate and a wrong lock on a paying owner is invisible in testing.
 */

import { describe, expect, it } from 'vitest';
import { resolveListingPlanGate } from '../../src/hooks/useListingPlanGate';
import type { EntitlementsData } from '../../src/lib/entitlements-cache';

/** A resolved effective set holding exactly `keys`. */
function data(keys: readonly string[], failed = false): EntitlementsData {
    return {
        entitlements: Object.fromEntries(keys.map((key) => [key, 1])),
        limits: {},
        hasLiveNonTrialTitle: false,
        failed
    };
}

const KEY = 'manage_venue_menu';

describe('resolveListingPlanGate', () => {
    it('is open while the read is pending', () => {
        expect(resolveListingPlanGate({ data: null, entitlementKey: KEY })).toEqual({
            gate: 'open'
        });
    });

    it('is open when the read failed, even with nothing held', () => {
        expect(resolveListingPlanGate({ data: data([], true), entitlementKey: KEY })).toEqual({
            gate: 'open'
        });
    });

    it('is open when the key is held, trial or not', () => {
        expect(
            resolveListingPlanGate({ data: data([KEY, 'activate_trial']), entitlementKey: KEY })
        ).toEqual({ gate: 'open' });
    });

    it('reads an unlimited (Infinity) grant as held', () => {
        const unlimited = { ...data([]), entitlements: { [KEY]: Number.POSITIVE_INFINITY } };
        expect(resolveListingPlanGate({ data: unlimited, entitlementKey: KEY })).toEqual({
            gate: 'open'
        });
    });

    it('is preTrial when the key is missing and the trial can still be activated', () => {
        expect(
            resolveListingPlanGate({ data: data(['activate_trial']), entitlementKey: KEY })
        ).toEqual({ gate: 'preTrial' });
    });

    it('is plan when the key is missing and no trial is left', () => {
        expect(
            resolveListingPlanGate({ data: data(['recover_own_listing']), entitlementKey: KEY })
        ).toEqual({ gate: 'plan' });
    });

    it('treats a zero grant as not held', () => {
        const zero = { ...data([]), entitlements: { [KEY]: 0 } };
        expect(resolveListingPlanGate({ data: zero, entitlementKey: KEY })).toEqual({
            gate: 'plan'
        });
    });
});
