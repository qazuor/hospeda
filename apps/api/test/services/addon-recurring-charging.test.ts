/**
 * HOS-847 — the server, not the client, answers whether buying an add-on today
 * opens a recurring charge.
 *
 * `apps/web` used to derive its "you will be charged every month" notice from
 * `billingType === 'recurring'`, which is a CATALOG label. With the recurring
 * checkout flag off — production's state — that same purchase falls to the
 * one-time branch: charged once, benefit never expires. So the answer is
 * computed here, by the SAME gate the checkout dispatches on, and shipped on
 * the wire as `recurringChargingEnabled`.
 *
 * What each case pins is one of the three conditions of that gate, plus the
 * property that matters operationally: with the flag off nothing is queried.
 *
 * @module test/services/addon-recurring-charging
 */

import type { AddonDefinition } from '@repo/billing';
import { LimitKey } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnv, mockSelectDispatch } = vi.hoisted(() => ({
    mockEnv: { HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED: undefined as boolean | undefined },
    mockSelectDispatch: vi.fn<(addonId: unknown) => Promise<Array<{ billingInterval: unknown }>>>()
}));

vi.mock('../../src/utils/env', () => ({ env: mockEnv }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Partial mock: the resolver imports `billingAddons` / `eq` from the same
// module, and a whole-module `vi.mock` would leave them `undefined` — a failure
// that hides inside the resolver's own try/catch and reads as "fails closed".
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        billingAddons: { id: 'billing_addons.id', billingInterval: 'billing_addons.interval' },
        eq: (_column: unknown, value: unknown) => value,
        getDb: () => ({
            select: () => ({
                from: () => ({
                    where: (addonId: unknown) => ({
                        limit: () => mockSelectDispatch(addonId)
                    })
                })
            })
        })
    };
});

import {
    annotateRecurringCharging,
    annotateRecurringChargingAll
} from '../../src/services/addon-recurring-charging';

const ADDON_UUID = '00000000-0000-4000-8000-0000000adds1';

const RECURRING_ADDON: AddonDefinition = {
    id: ADDON_UUID,
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos.',
    billingType: 'recurring',
    priceArs: 500_000,
    annualPriceArs: 4_800_000,
    durationDays: null,
    affectsLimitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    productDomain: ProductDomainEnum.ACCOMMODATION,
    isActive: true,
    sortOrder: 3
};

const ONE_TIME_ADDON: AddonDefinition = {
    ...RECURRING_ADDON,
    id: '00000000-0000-4000-8000-0000000adds2',
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    billingType: 'one_time',
    annualPriceArs: null,
    durationDays: 7
};

describe('annotateRecurringCharging', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnv.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED = undefined;
        mockSelectDispatch.mockResolvedValue([{ billingInterval: 'month' }]);
    });

    it('answers FALSE for a recurring-labelled add-on while the charging path is off', async () => {
        // Production's state. The catalog says `recurring`; the checkout would
        // still create a one-time Preference, charge once, and never expire the
        // benefit. A client that trusted the label would promise a subscription.
        const result = await annotateRecurringCharging(RECURRING_ADDON);

        expect(result.recurringChargingEnabled).toBe(false);
    });

    it('issues NO query at all while the path is off', async () => {
        // The whole catalog is annotated on every listing, so the cost of this
        // field with the flag off has to be zero, not "one small read each".
        await annotateRecurringChargingAll([RECURRING_ADDON, ONE_TIME_ADDON]);

        expect(mockSelectDispatch).not.toHaveBeenCalled();
    });

    it('answers TRUE once the path is on and the catalog row agrees', async () => {
        mockEnv.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED = true;

        const result = await annotateRecurringCharging(RECURRING_ADDON);

        expect(result.recurringChargingEnabled).toBe(true);
    });

    it('answers FALSE for a one-time add-on even with the path on', async () => {
        mockEnv.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED = true;

        const result = await annotateRecurringCharging(ONE_TIME_ADDON);

        expect(result.recurringChargingEnabled).toBe(false);
    });

    it("answers FALSE when the row's real billing_interval does not say 'month'", async () => {
        // The third condition, and the reason this is not just the flag.
        // `resolveBillingType` returns `'recurring'` by EXCLUSION, so a NULL, an
        // empty string or an operator's typo all present as recurring — and the
        // checkout would fall back to the one-time path on exactly this read.
        mockEnv.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED = true;
        mockSelectDispatch.mockResolvedValue([{ billingInterval: null }]);

        const result = await annotateRecurringCharging(RECURRING_ADDON);

        expect(result.recurringChargingEnabled).toBe(false);
    });

    it('answers FALSE for a catalog entry with no id, which cannot be verified', async () => {
        mockEnv.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED = true;
        const { id: _id, ...withoutId } = RECURRING_ADDON;

        const result = await annotateRecurringCharging(withoutId as AddonDefinition);

        expect(result.recurringChargingEnabled).toBe(false);
    });

    it('preserves every other field and the listing order', async () => {
        mockEnv.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED = true;

        const [first, second] = await annotateRecurringChargingAll([
            ONE_TIME_ADDON,
            RECURRING_ADDON
        ]);

        // Explicit fields rather than `objectContaining`, which is blind to a
        // field the annotation might have dropped.
        expect(first?.slug).toBe(ONE_TIME_ADDON.slug);
        expect(first?.priceArs).toBe(ONE_TIME_ADDON.priceArs);
        expect(first?.durationDays).toBe(7);
        expect(first?.productDomain).toBe(ProductDomainEnum.ACCOMMODATION);
        expect(first?.recurringChargingEnabled).toBe(false);

        expect(second?.slug).toBe(RECURRING_ADDON.slug);
        expect(second?.priceArs).toBe(RECURRING_ADDON.priceArs);
        expect(second?.durationDays).toBeNull();
        expect(second?.affectsLimitKey).toBe(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION);
        expect(second?.recurringChargingEnabled).toBe(true);
    });
});
