import { describe, expect, it } from 'vitest';
import type { EntitlementsData } from '../../src/lib/entitlements-cache';
import { resolvePriceAlertGate, showPriceAlertsLock } from '../../src/lib/price-alert-gate';

const set = (enabled: boolean, limit: number): EntitlementsData => ({
    entitlements: enabled ? { price_alerts: 1 } : {},
    limits: { max_active_alerts: limit },
    hasLiveNonTrialTitle: false,
    failed: false
});

describe('TEST:B13a:25 price alert effective-set gate', () => {
    it('reads distinct tourist capability sets and fails closed on absence or error', () => {
        expect(resolvePriceAlertGate({ effectiveSet: set(true, 5), currentAlertCount: 2 })).toEqual(
            { canCreateAlerts: true, maxReached: false }
        );
        expect(
            resolvePriceAlertGate({ effectiveSet: set(false, 5), currentAlertCount: 2 })
                .canCreateAlerts
        ).toBe(false);
        expect(
            resolvePriceAlertGate({
                effectiveSet: { ...set(true, 5), failed: true },
                currentAlertCount: 2
            }).canCreateAlerts
        ).toBe(false);
    });
    it('blocks the additional alert when count plus one exceeds the limit', () => {
        expect(
            resolvePriceAlertGate({ effectiveSet: set(true, 3), currentAlertCount: 2 }).maxReached
        ).toBe(false);
        expect(
            resolvePriceAlertGate({ effectiveSet: set(true, 3), currentAlertCount: 3 }).maxReached
        ).toBe(true);
        expect(
            resolvePriceAlertGate({ effectiveSet: set(true, 0), currentAlertCount: 0 }).maxReached
        ).toBe(true);
    });
});

describe('HOS-2599 price alerts page: lock instead of an inviting empty state', () => {
    it('locks an empty list when the plan lacks price alerts', () => {
        expect(showPriceAlertsLock({ alertCount: 0, effectiveSet: set(false, 0) })).toBe(true);
    });
    it('keeps the empty state when the plan includes price alerts', () => {
        expect(showPriceAlertsLock({ alertCount: 0, effectiveSet: set(true, 5) })).toBe(false);
    });
    it('keeps listing existing alerts even without the entitlement', () => {
        expect(showPriceAlertsLock({ alertCount: 2, effectiveSet: set(false, 0) })).toBe(false);
    });
    it('does not lock on a failed effective-set read', () => {
        expect(
            showPriceAlertsLock({
                alertCount: 0,
                effectiveSet: { ...set(false, 0), failed: true }
            })
        ).toBe(false);
    });
});
