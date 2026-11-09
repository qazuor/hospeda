import { formatCurrency } from '@repo/i18n';
import { describe, expect, it } from 'vitest';
import type { CatalogVersion } from '../addon-version-draft';
import { diffAddonVersion } from '../addon-version-draft';

const current: CatalogVersion = {
    id: '11111111-1111-4111-8111-111111111111',
    addonId: '22222222-2222-4222-8222-222222222222',
    validity: 'WHILE_SUBSCRIPTION_ALIVE',
    validityDays: null,
    scopeType: 'LISTING',
    entitlements: ['keep', 'remove'],
    limits: [
        { key: 'same', value: 1 },
        { key: 'change', value: 2 },
        { key: 'remove_limit', value: 3 }
    ],
    liveInstances: 2
};

describe('TEST:B13b:3 AC:B13b:3 publishing an addon version shows each change against the current version', () => {
    it('reports exact added, removed and changed keys, scope, validity and price', () => {
        expect(
            diffAddonVersion({
                current,
                proposed: {
                    entitlements: ['keep', 'add'],
                    limits: [
                        { key: 'same', value: 1 },
                        { key: 'change', value: 4 },
                        { key: 'add_limit', value: 7 }
                    ],
                    scopeType: 'USER',
                    validity: 'FIXED_DAYS',
                    validityDays: 30
                },
                currentPrice: 100,
                proposedPrice: 120
            })
        ).toEqual([
            { kind: 'added', key: 'entitlement:add', from: null, to: 'add' },
            { kind: 'removed', key: 'entitlement:remove', from: 'remove', to: null },
            { kind: 'added', key: 'limit:add_limit', from: null, to: '7' },
            { kind: 'changed', key: 'limit:change', from: '2', to: '4' },
            { kind: 'removed', key: 'limit:remove_limit', from: '3', to: null },
            {
                kind: 'changed',
                key: 'price',
                from: formatCurrency({ value: 1, locale: 'es-AR', currency: 'ARS' }),
                to: formatCurrency({ value: 1.2, locale: 'es-AR', currency: 'ARS' })
            },
            { kind: 'changed', key: 'scope', from: 'LISTING', to: 'USER' },
            {
                kind: 'changed',
                key: 'validity',
                from: 'WHILE_SUBSCRIPTION_ALIVE:',
                to: 'FIXED_DAYS:30'
            }
        ]);
    });

    it('shows a 250000-cent price as ARS 2500 without changing the draft cents', () => {
        const changes = diffAddonVersion({
            current,
            proposed: current,
            currentPrice: 100,
            proposedPrice: 250000
        });
        expect(changes.find((change) => change.key === 'price')?.to).toBe(
            formatCurrency({ value: 2500, locale: 'es-AR', currency: 'ARS' })
        );
    });
});
