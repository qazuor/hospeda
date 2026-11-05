import { describe, expect, it } from 'vitest';
import {
    assertReanchorCompatible,
    type ReanchorVersionSnapshot,
    reanchorSubscriptionsToVersion,
    remapBillingOptionId
} from '../../src/data-migrations/helpers/reanchorSubscriptionsToVersion.js';

const version = (overrides: Partial<ReanchorVersionSnapshot> = {}): ReanchorVersionSnapshot => ({
    planId: 'basic',
    vertical: 'accommodation',
    options: [{ id: 'monthly-old', cycle: 'monthly', amount: 100, currency: 'ARS' }],
    entitlements: [{ key: 'listing', planQuota: 1, trialQuota: 1 }],
    limits: [{ key: 'photos', value: 10 }],
    ...overrides
});

describe('reanchorSubscriptionsToVersion guards', () => {
    it('refuses a different plan', () => {
        expect(() =>
            assertReanchorCompatible({ from: version(), to: version({ planId: 'pro' }) })
        ).toThrow('different plans');
    });

    it('refuses a price change for the same cycle', () => {
        expect(() =>
            assertReanchorCompatible({
                from: version(),
                to: version({
                    options: [{ id: 'monthly-new', cycle: 'monthly', amount: 101, currency: 'ARS' }]
                })
            })
        ).toThrow('prices differ');
    });

    it('refuses a removed entitlement', () => {
        expect(() =>
            assertReanchorCompatible({ from: version(), to: version({ entitlements: [] }) })
        ).toThrow('removes or reduces an entitlement');
    });

    it('remaps the billing option by cycle and accepts additive entitlements', () => {
        const from = version();
        const to = version({
            options: [{ id: 'monthly-new', cycle: 'monthly', amount: 100, currency: 'ARS' }],
            entitlements: [
                ...from.entitlements,
                { key: 'can_embed_video', planQuota: null, trialQuota: null }
            ]
        });
        expect(() => assertReanchorCompatible({ from, to })).not.toThrow();
        expect(
            remapBillingOptionId({
                oldOptionId: 'monthly-old',
                fromOptions: from.options,
                toOptions: to.options
            })
        ).toBe('monthly-new');
    });

    it('is idempotent when already anchored to the target version', async () => {
        await expect(
            reanchorSubscriptionsToVersion({
                db: undefined as never,
                fromVersionId: 'same-version',
                toVersionId: 'same-version'
            })
        ).resolves.toBe(0);
    });
});
