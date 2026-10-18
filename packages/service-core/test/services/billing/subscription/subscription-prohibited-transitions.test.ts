import { SUBSCRIPTION_STATUSES } from '@repo/db';
import { describe, expect, it } from 'vitest';
import {
    findSubscriptionProhibition,
    PROHIBITED_SUBSCRIPTION_TRANSITIONS
} from '../../../../src/services/billing/subscription/subscription-prohibited-transitions.js';

const expected = (from: string, to: string) => {
    if (from === 'CANCEL_SCHEDULED' && to === 'ACTIVE') return 'PROH:B:1';
    if (from === 'CANCELLED' && to !== 'CANCELLED') return 'PROH:B:2';
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

    it('does not classify unknown statuses', () => {
        expect(findSubscriptionProhibition({ from: 'NOPE', to: 'ACTIVE' })).toBeNull();
        expect(findSubscriptionProhibition({ from: 'CANCELLED', to: 'NOPE' })).toBeNull();
    });
});
