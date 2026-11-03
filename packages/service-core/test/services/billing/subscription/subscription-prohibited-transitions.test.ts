import { readFileSync } from 'node:fs';
import { SUBSCRIPTION_STATUSES } from '@repo/db';
import { describe, expect, it } from 'vitest';
import {
    findSubscriptionProhibition,
    PROHIBITED_SUBSCRIPTION_TRANSITIONS
} from '../../../../src/services/billing/subscription/subscription-prohibited-transitions.js';

const expected = (from: string, to: string) => {
    if (from === 'CANCEL_SCHEDULED' && to === 'ACTIVE') return 'PROH:B:1';
    if (from === 'CANCELLED' && to !== 'CANCELLED') return 'PROH:B:2';
    if (from === 'PAUSED' && !['ACTIVE', 'CANCELLED', 'PAUSED'].includes(to)) return 'PROH:B:4';
    return null;
};

describe('TEST:1572:1 subscription prohibition table', () => {
    it.each(
        SUBSCRIPTION_STATUSES.flatMap((from) =>
            SUBSCRIPTION_STATUSES.map((to) => [from, to] as const)
        )
    )('classifies %s to %s', (from, to) => {
        expect(findSubscriptionProhibition({ from, to })).toBe(expected(from, to));
    });

    it('lists every status except CANCELLED as a PROH:B:2 destination', () => {
        const cancelled = PROHIBITED_SUBSCRIPTION_TRANSITIONS.find(
            (item) => item.id === 'PROH:B:2'
        );
        expect(cancelled?.to).toEqual(
            SUBSCRIPTION_STATUSES.filter((status) => status !== 'CANCELLED')
        );
    });

    it('restricts each PROH:B:4 exception to its own pair', () => {
        expect(
            findSubscriptionProhibition({
                from: 'PAUSED',
                to: 'SUSPENDED',
                exception: 'S6_CHARGEBACK_ON_COURTESY'
            })
        ).toBeNull();
        expect(
            findSubscriptionProhibition({
                from: 'PAUSED',
                to: 'CANCEL_SCHEDULED',
                exception: 'S22_UNCONSUMED_CREDIT'
            })
        ).toBeNull();
        expect(
            findSubscriptionProhibition({
                from: 'PAUSED',
                to: 'SUSPENDED',
                exception: 'S22_UNCONSUMED_CREDIT'
            })
        ).toBe('PROH:B:4');
        expect(
            findSubscriptionProhibition({
                from: 'PAUSED',
                to: 'CANCEL_SCHEDULED',
                exception: 'S6_CHARGEBACK_ON_COURTESY'
            })
        ).toBe('PROH:B:4');
    });

    it('matches the exact PAUSED destinations declared by the transition corpus', () => {
        const path = new URL(
            '../../../../../../scripts/guards/transition-tables.json',
            import.meta.url
        );
        const corpus = JSON.parse(readFileSync(path, 'utf8')) as {
            transitions: { id: string; machine: string; from: string[]; to: string[] }[];
        };
        const rows = corpus.transitions.filter(
            (row) => row.machine === 'subscription' && row.from.includes('PAUSED')
        );
        const byDestination = new Map<string, string[]>();
        for (const row of rows)
            for (const to of row.to)
                byDestination.set(to, [...(byDestination.get(to) ?? []), row.id]);
        expect(Object.fromEntries([...byDestination].map(([to, ids]) => [to, ids.sort()]))).toEqual(
            {
                ACTIVE: ['TRANS:B:S10', 'TRANS:B:S33'],
                CANCELLED: ['TRANS:B:S17', 'TRANS:B:S22', 'TRANS:B:S36'],
                CANCEL_SCHEDULED: ['TRANS:B:S22'],
                PAUSED: ['TRANS:B:S35'],
                SUSPENDED: ['TRANS:B:S6'],
                '*SAME': ['TRANS:B:S34']
            }
        );
    });

    it('does not classify unknown statuses', () => {
        expect(findSubscriptionProhibition({ from: 'NOPE', to: 'ACTIVE' })).toBeNull();
        expect(findSubscriptionProhibition({ from: 'CANCELLED', to: 'NOPE' })).toBeNull();
    });
});
