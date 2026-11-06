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

    it('refuses a different vertical', () => {
        expect(() =>
            assertReanchorCompatible({ from: version(), to: version({ vertical: 'venue' }) })
        ).toThrow('different verticals');
    });

    it('refuses a price change on any one of several cycles', () => {
        const two = [
            { id: 'm', cycle: 'monthly', amount: 100, currency: 'ARS' },
            { id: 'a', cycle: 'annual', amount: 1000, currency: 'ARS' }
        ];
        expect(() =>
            assertReanchorCompatible({
                from: version({ options: two }),
                to: version({
                    options: [
                        two[0] as (typeof two)[0],
                        { ...two[1], amount: 999 } as (typeof two)[0]
                    ]
                })
            })
        ).toThrow('prices differ');
    });

    it('refuses a different currency or a missing cycle', () => {
        expect(() =>
            assertReanchorCompatible({
                from: version(),
                to: version({
                    options: [{ id: 'x', cycle: 'monthly', amount: 100, currency: 'USD' }]
                })
            })
        ).toThrow('prices differ');
        expect(() =>
            assertReanchorCompatible({ from: version(), to: version({ options: [] }) })
        ).toThrow('prices differ');
    });

    it('refuses a shrunk entitlement quota and a reduced or removed limit', () => {
        expect(() =>
            assertReanchorCompatible({
                from: version(),
                to: version({ entitlements: [{ key: 'listing', planQuota: 0, trialQuota: 1 }] })
            })
        ).toThrow('removes or reduces an entitlement');
        expect(() =>
            assertReanchorCompatible({
                from: version(),
                to: version({ limits: [{ key: 'photos', value: 9 }] })
            })
        ).toThrow('removes or reduces a limit');
        expect(() =>
            assertReanchorCompatible({ from: version(), to: version({ limits: [] }) })
        ).toThrow('removes or reduces a limit');
    });

    it('refuses a removed entitlement', () => {
        expect(() =>
            assertReanchorCompatible({ from: version(), to: version({ entitlements: [] }) })
        ).toThrow('removes or reduces an entitlement');
    });

    it('throws when no target option matches the old option cycle', () => {
        expect(() =>
            remapBillingOptionId({
                oldOptionId: 'monthly-old',
                fromOptions: version().options,
                toOptions: []
            })
        ).toThrow('No target billing option');
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
        ).resolves.toEqual({ movedCount: 0, remappedScheduledChanges: 0, userIds: [] });
    });
});
