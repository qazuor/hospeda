/**
 * @file price-alert-gate.test.ts
 * @description Unit tests for `resolvePriceAlertGateState`, plus the wire-value
 * pin that keeps it honest.
 *
 * ## Why the pin matters more than the logic
 *
 * `price-alert-gate.ts` compares against the string literals `'price_alerts'`
 * and `'max_active_alerts'` rather than importing `EntitlementKey` / `LimitKey`
 * from `@repo/billing`. That is deliberate — since HOS-369 WB0-7 the module runs
 * in the browser, and the billing barrel drags the MercadoPago adapter,
 * `@repo/logger` and the `@repo/config` env registry into the client bundle
 * (the `billing-barrel-client-isolation` guard exists for that, and it caught
 * this exact change).
 *
 * The cost of decoupling is that a rename upstream would no longer be a
 * compile error. It would be SILENT: `entitlements.includes('price_alerts')`
 * would simply stop matching, `canCreateAlerts` would go false for everyone,
 * and every entitled visitor would be shown the "upgrade your plan" upsell for
 * a feature they already pay for. Nothing would throw and nothing would log.
 *
 * A test file may import `@repo/billing` freely — it never reaches a browser —
 * so the pin below buys the compile-time safety back at zero bundle cost. This
 * is not hypothetical: the first draft of `PriceAlertButton.test.tsx` hardcoded
 * `'PRICE_ALERTS'` (the enum MEMBER name, not its value) and every "entitled"
 * case silently resolved to the locked branch.
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';

import type { ApiResult } from '@/lib/api/types';
import { resolvePriceAlertGateState } from '@/lib/price-alert-gate';

type EntitlementsResult = ApiResult<{
    readonly entitlements: ReadonlyArray<string>;
    readonly limits: Readonly<Record<string, number>>;
}>;

function ok(
    entitlements: ReadonlyArray<string>,
    limits: Readonly<Record<string, number>> = {}
): EntitlementsResult {
    return { ok: true, data: { entitlements, limits } } as EntitlementsResult;
}

describe('price-alert-gate — wire values', () => {
    it('matches the literals the module compares against', () => {
        // The pin. If either of these fails, `price-alert-gate.ts` must be
        // updated in the same change — not this test.
        expect(EntitlementKey.PRICE_ALERTS).toBe('price_alerts');
        expect(LimitKey.MAX_ACTIVE_ALERTS).toBe('max_active_alerts');
    });

    it('grants the entitlement when the real enum value is present', () => {
        // Ties the pin to actual behaviour: asserting the constants match is
        // only meaningful if the module truly keys off them.
        const state = resolvePriceAlertGateState(ok([EntitlementKey.PRICE_ALERTS]), 0);
        expect(state.canCreateAlerts).toBe(true);
    });

    it('does not grant it for the enum MEMBER name', () => {
        // The mistake this file exists to prevent, spelled out.
        const state = resolvePriceAlertGateState(ok(['PRICE_ALERTS']), 0);
        expect(state.canCreateAlerts).toBe(false);
    });
});

describe('resolvePriceAlertGateState', () => {
    it('locks and reports no max when the entitlements call failed', () => {
        const failed = { ok: false, error: { status: 500 } } as unknown as EntitlementsResult;
        expect(resolvePriceAlertGateState(failed, 0)).toEqual({
            canCreateAlerts: false,
            maxReached: false
        });
    });

    it('locks when the plan lacks the entitlement', () => {
        expect(resolvePriceAlertGateState(ok([]), 0).canCreateAlerts).toBe(false);
    });

    it('reports maxReached once the count meets the limit', () => {
        const limits = { [LimitKey.MAX_ACTIVE_ALERTS]: 3 };
        const entitlements = [EntitlementKey.PRICE_ALERTS];

        expect(resolvePriceAlertGateState(ok(entitlements, limits), 2).maxReached).toBe(false);
        expect(resolvePriceAlertGateState(ok(entitlements, limits), 3).maxReached).toBe(true);
        expect(resolvePriceAlertGateState(ok(entitlements, limits), 4).maxReached).toBe(true);
    });

    it('treats -1 as unlimited', () => {
        const state = resolvePriceAlertGateState(
            ok([EntitlementKey.PRICE_ALERTS], { [LimitKey.MAX_ACTIVE_ALERTS]: -1 }),
            9999
        );
        expect(state.maxReached).toBe(false);
    });

    it('treats a missing limit as unbounded rather than zero', () => {
        // An absent limit must not read as "0 allowed" — that would max out
        // every visitor on a plan whose limit simply is not published.
        const state = resolvePriceAlertGateState(ok([EntitlementKey.PRICE_ALERTS]), 5);
        expect(state.maxReached).toBe(false);
        expect(state.canCreateAlerts).toBe(true);
    });
});
