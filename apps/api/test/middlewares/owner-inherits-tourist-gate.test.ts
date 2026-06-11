/**
 * @file owner-inherits-tourist-gate.test.ts
 * @description SPEC-216 integration check — an owner-plan actor now passes a
 * tourist-entitlement gate (`gateFavorites`) that previously returned 403, because
 * owner plans inherit the tourist-VIP set. Exercises the real gate middleware
 * against the real owner-plan config (no DB), and confirms the gate still blocks an
 * actor whose plan lacks the entitlement.
 */

import { EntitlementKey, LimitKey, getPlanBySlug } from '@repo/billing';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { gateAlerts, gateFavorites } from '../../src/middlewares/tourist-entitlements';

/** Minimal Hono context stub — the gate only reads `c.get('userEntitlements')`. */
function contextWithEntitlements(entitlements: Set<EntitlementKey>): Context {
    return {
        get: (key: string) => (key === 'userEntitlements' ? entitlements : undefined)
    } as unknown as Context;
}

/**
 * Minimal Hono context stub for limit-bearing gates.
 *
 * `gateAlerts` reads three keys from context:
 *   - `userEntitlements` — Set<EntitlementKey> checked by `hasEntitlement()`
 *   - `currentActiveAlertsCount` — number injected by the route handler before calling next
 *   - `userLimits` — Map<LimitKey, number> read by `getRemainingLimit()` inside `checkLimit()`
 *
 * We stub all three directly so no database or billing SDK is needed.
 */
function contextWithEntitlementsAndLimits(
    entitlements: Set<EntitlementKey>,
    limits: Map<LimitKey, number>,
    currentActiveAlertsCount: number
): Context {
    return {
        get: (key: string) => {
            if (key === 'userEntitlements') return entitlements;
            if (key === 'userLimits') return limits;
            if (key === 'currentActiveAlertsCount') return currentActiveAlertsCount;
            return undefined;
        }
    } as unknown as Context;
}

describe('SPEC-216 — owner plan passes a tourist gate', () => {
    it('an owner-basico actor passes gateFavorites (previously 403)', async () => {
        const plan = getPlanBySlug('owner-basico');
        expect(plan).toBeDefined();
        expect(plan?.entitlements).toContain(EntitlementKey.SAVE_FAVORITES);

        const c = contextWithEntitlements(new Set(plan?.entitlements));
        const next = vi.fn(async () => {});

        await gateFavorites()(c, next);

        expect(next).toHaveBeenCalledOnce();
    });

    it('every owner/complex plan resolves SAVE_FAVORITES through the gate', async () => {
        const slugs = [
            'owner-basico',
            'owner-pro',
            'owner-premium',
            'complex-basico',
            'complex-pro',
            'complex-premium'
        ];
        for (const slug of slugs) {
            const plan = getPlanBySlug(slug);
            const c = contextWithEntitlements(new Set(plan?.entitlements));
            const next = vi.fn(async () => {});
            await gateFavorites()(c, next);
            expect(next, `${slug} should pass gateFavorites`).toHaveBeenCalledOnce();
        }
    });

    it('gateFavorites still blocks an actor whose plan lacks SAVE_FAVORITES', async () => {
        const c = contextWithEntitlements(new Set());
        const next = vi.fn(async () => {});

        await expect(gateFavorites()(c, next)).rejects.toThrow();
        expect(next).not.toHaveBeenCalled();
    });
});

describe('SPEC-216 — owner plan passes a limit-bearing tourist gate (gateAlerts)', () => {
    /**
     * gateAlerts was chosen because it is the simplest limit-bearing tourist gate:
     * it reads exactly three context keys (userEntitlements, currentActiveAlertsCount,
     * userLimits) with no service calls, making it fully stubbable without mocking
     * any module. gateComparator follows the same pattern; both are equivalent here.
     *
     * owner-basico carries MAX_ACTIVE_ALERTS = -1 (unlimited) via TOURIST_VIP_LIMITS
     * inheritance. Setting currentActiveAlertsCount = 999 proves the unlimited (-1)
     * value lets the gate pass even at an absurdly high count.
     */
    it('an owner-basico actor at high alert count passes gateAlerts via unlimited (-1) limit', async () => {
        const plan = getPlanBySlug('owner-basico');
        expect(plan).toBeDefined();
        // Confirm PRICE_ALERTS is in the inherited entitlement set
        expect(plan?.entitlements).toContain(EntitlementKey.PRICE_ALERTS);

        // Build the limits map from the plan definition
        const limits = new Map<LimitKey, number>(
            plan?.limits.map((l) => [l.key as LimitKey, l.value]) ?? []
        );
        // Confirm the plan carries unlimited alerts
        expect(limits.get(LimitKey.MAX_ACTIVE_ALERTS)).toBe(-1);

        const c = contextWithEntitlementsAndLimits(
            new Set(plan?.entitlements),
            limits,
            999 // current count well above any finite limit — proves -1 means unlimited
        );
        const next = vi.fn(async () => {});

        await gateAlerts()(c, next);

        expect(next).toHaveBeenCalledOnce();
    });

    it('gateAlerts blocks an actor whose plan lacks PRICE_ALERTS', async () => {
        const limits = new Map<LimitKey, number>([[LimitKey.MAX_ACTIVE_ALERTS, 0]]);
        const c = contextWithEntitlementsAndLimits(new Set(), limits, 0);
        const next = vi.fn(async () => {});

        await expect(gateAlerts()(c, next)).rejects.toThrow();
        expect(next).not.toHaveBeenCalled();
    });
});
