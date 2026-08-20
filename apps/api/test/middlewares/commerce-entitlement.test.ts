/**
 * `commerceVerticalEntitlementMiddleware` — the layer that decides the cap
 * (HOS-688 AC-15, AC-31).
 *
 * The end-to-end proof that this middleware is actually MOUNTED lives in
 * `test/commerce/listing-cap.e2e.test.ts` (AC-30). This file proves the number
 * it publishes is the right one, across the branches a request test cannot
 * reach without a real billing provider: an add-on purchase, a plan whose cap
 * differs from the catalogue default, and a billing outage.
 *
 * ## The invariant every case here re-checks
 *
 * **`userLimits` carries the vertical's key, with a NUMBER, on every path.**
 *
 * That is the whole reason this middleware exists. `getRemainingLimit` returns
 * `-1` — "treat as unlimited" — for an ABSENT key, and several
 * `entitlementMiddleware` branches publish an empty limits Map, which is
 * unlimited for every key at once. So "the key is missing" and "the owner may
 * create infinitely many listings" are the same state, and neither logs
 * anything. Half the assertions below are therefore about the key being
 * present at all, not about its value.
 *
 * @module test/middlewares/commerce-entitlement
 */

import { LimitKey } from '@repo/billing';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types.js';

/** Subscriptions the fake billing provider returns for the customer. */
let fakeSubscriptions: Array<Record<string, unknown>> = [];
/** Plans the fake provider resolves by id. */
let fakePlans: Record<string, { limits: Record<string, number> }> = {};
/** Customer-level limit overrides — how a purchased add-on raises a cap. */
let fakeCustomerLimits: Array<{ limitKey: string; maxValue: number }> = [];
/** When set, every provider call throws it. */
let providerThrows: Error | null = null;

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: () => ({
        subscriptions: {
            getByCustomerId: async () => {
                if (providerThrows) throw providerThrows;
                return fakeSubscriptions;
            }
        },
        plans: {
            get: async (id: string) => {
                if (providerThrows) throw providerThrows;
                return fakePlans[id] ?? null;
            }
        },
        limits: {
            getByCustomerId: async () => {
                if (providerThrows) throw providerThrows;
                return fakeCustomerLimits;
            }
        }
    })
}));

/**
 * The catalogue plan each vertical falls back to when the owner has no
 * subscription. Mirrors what `PlanService.getBySlug` returns from the DB.
 */
vi.mock('../../src/services/plan.service', () => ({
    PlanService: class {
        async getBySlug(slug: string) {
            const limits: Record<string, Record<string, number>> = {
                'gastronomy-premium': { max_gastronomies: 1 },
                'experience-premium': { max_experiences: 1 }
            };
            const found = limits[slug];
            if (!found) {
                return { success: false as const, error: { code: 'NOT_FOUND', message: slug } };
            }
            return { success: true as const, data: { limits: found } };
        }
    }
}));

const { commerceVerticalEntitlementMiddleware, _resetCommerceBaseLimitCache } = await import(
    '../../src/middlewares/commerce-entitlement.js'
);

/**
 * Runs the middleware and reports the limits map it published.
 *
 * @param input.vertical - The vertical to gate.
 * @param input.billingCustomerId - The caller's billing customer, when they have one.
 * @returns The published limits as a plain object.
 */
async function runMiddleware(input: {
    vertical: 'gastronomy' | 'experience';
    billingCustomerId?: string;
}): Promise<Record<string, number>> {
    const app = new Hono<AppBindings>();

    app.use('*', async (c, next) => {
        c.set('actor', { id: 'owner-1', roles: [] } as never);
        if (input.billingCustomerId) {
            c.set('billingCustomerId', input.billingCustomerId);
        }
        await next();
    });
    app.use('*', commerceVerticalEntitlementMiddleware(input.vertical));
    app.get('/', (c) => c.json(Object.fromEntries(c.get('userLimits') ?? new Map())));

    const res = await app.request('/');
    return (await res.json()) as Record<string, number>;
}

describe('commerceVerticalEntitlementMiddleware (HOS-688)', () => {
    beforeEach(() => {
        fakeSubscriptions = [];
        fakePlans = {};
        fakeCustomerLimits = [];
        providerThrows = null;
        _resetCommerceBaseLimitCache();
    });

    afterEach(() => {
        _resetCommerceBaseLimitCache();
    });

    it('publishes the catalogue cap for an owner with no subscription (AC-31)', async () => {
        const limits = await runMiddleware({ vertical: 'gastronomy' });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    it('never leaves the key absent, which would read as unlimited', async () => {
        const limits = await runMiddleware({ vertical: 'gastronomy' });

        expect(Object.hasOwn(limits, LimitKey.MAX_GASTRONOMIES)).toBe(true);
        expect(limits[LimitKey.MAX_GASTRONOMIES]).not.toBe(-1);
    });

    it('publishes ONLY this vertical key, never the other one', async () => {
        // The two domains are never merged (SPEC-239's isolation, made explicit
        // at the call site). A gastronomy route publishing `max_experiences`
        // would let one plan's cap answer for the other vertical.
        const limits = await runMiddleware({ vertical: 'gastronomy' });

        expect(Object.keys(limits)).toEqual([LimitKey.MAX_GASTRONOMIES]);
    });

    it("reads the cap off the owner's own vertical subscription", async () => {
        fakeSubscriptions = [
            { id: 's1', status: 'active', planId: 'p-gastro', productDomain: 'gastronomy' }
        ];
        fakePlans = { 'p-gastro': { limits: { max_gastronomies: 3 } } };

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(3);
    });

    it('ignores an ACCOMMODATION subscription when gating a commerce vertical', async () => {
        // The bug SPEC-239's isolation exists to prevent, in the other
        // direction: an accommodation plan must never supply a commerce cap.
        fakeSubscriptions = [
            { id: 's1', status: 'active', planId: 'p-owner', productDomain: 'accommodation' }
        ];
        fakePlans = { 'p-owner': { limits: { max_accommodations: 10 } } };

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        // Falls back to the catalogue cap, NOT to 10 and not to unlimited.
        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    it("raises the cap by the vertical's add-on and leaves the other alone (AC-15)", async () => {
        fakeSubscriptions = [
            { id: 's1', status: 'active', planId: 'p-gastro', productDomain: 'gastronomy' }
        ];
        fakePlans = { 'p-gastro': { limits: { max_gastronomies: 1 } } };
        // What `recalculateAddonLimitsForCustomer` writes after an
        // `extra-gastronomies-1` purchase: plan base + the add-on's increase.
        fakeCustomerLimits = [{ limitKey: 'max_gastronomies', maxValue: 2 }];

        const gastronomy = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });
        _resetCommerceBaseLimitCache();
        const experience = await runMiddleware({
            vertical: 'experience',
            billingCustomerId: 'cus-1'
        });

        expect(gastronomy[LimitKey.MAX_GASTRONOMIES]).toBe(2);
        // The other vertical is untouched — the second half of AC-15, and the
        // half a single pooled cap could not express.
        expect(experience[LimitKey.MAX_EXPERIENCES]).toBe(1);
    });

    it('holds the catalogue cap when the billing provider is down', async () => {
        // Fails to the BASE cap, never to an absent key. An outage may cost an
        // owner the extra listing they bought; it must never hand out an
        // uncapped catalogue.
        providerThrows = new Error('billing unavailable');

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    it('ignores a cancelled subscription and falls back to the catalogue cap', async () => {
        fakeSubscriptions = [
            { id: 's1', status: 'cancelled', planId: 'p-gastro', productDomain: 'gastronomy' }
        ];
        fakePlans = { 'p-gastro': { limits: { max_gastronomies: 9 } } };

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });
});
