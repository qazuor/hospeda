/**
 * HOS-2599: pure decisions behind the add-on screen's vertical filter and its empty states.
 */
import { describe, expect, it } from 'vitest';
import {
    accountVerticalsFrom,
    noSubscriptionReason,
    offersForAccountVerticals,
    publicationStatusTone
} from '../../../src/lib/billing/addon-account-verticals';

const offer = (id: string, compatibleVerticals: readonly string[]) => ({ id, compatibleVerticals });
const OFFERS = [
    offer('pack-accommodation', ['accommodation']),
    offer('slot-venue', ['venue']),
    offer('boost-experience', ['experience']),
    offer('multi', ['accommodation', 'venue'])
];

describe('accountVerticalsFrom', () => {
    it('lists each subscription vertical once, whatever the status', () => {
        expect(
            accountVerticalsFrom({
                subscriptions: [
                    { vertical: 'accommodation', status: 'ACTIVE' },
                    { vertical: 'accommodation', status: 'CANCEL_SCHEDULED' },
                    { vertical: 'venue', status: 'PAUSED' }
                ]
            })
        ).toEqual(['accommodation', 'venue']);
    });
});

describe('offersForAccountVerticals', () => {
    it('keeps only the offers compatible with one of the account verticals', () => {
        expect(
            offersForAccountVerticals({ offers: OFFERS, accountVerticals: ['experience'] }).map(
                (item) => item.id
            )
        ).toEqual(['boost-experience']);
        expect(
            offersForAccountVerticals({ offers: OFFERS, accountVerticals: ['venue'] }).map(
                (item) => item.id
            )
        ).toEqual(['slot-venue', 'multi']);
    });

    it('keeps every offer when the account verticals are unknown', () => {
        expect(offersForAccountVerticals({ offers: OFFERS, accountVerticals: null })).toHaveLength(
            4
        );
    });

    it('offers nothing to an account with no vertical, and keeps a catalog row with none', () => {
        expect(offersForAccountVerticals({ offers: OFFERS, accountVerticals: [] })).toEqual([]);
        expect(
            offersForAccountVerticals({ offers: [offer('any', [])], accountVerticals: ['venue'] })
        ).toHaveLength(1);
    });
});

describe('noSubscriptionReason', () => {
    it('is INACTIVE when a compatible subscription exists but is not active', () => {
        expect(
            noSubscriptionReason({
                subscriptions: [{ vertical: 'accommodation', status: 'GRACE_PERIOD' }],
                compatibleVerticals: ['accommodation']
            })
        ).toBe('INACTIVE');
    });

    it('is NONE when no compatible subscription exists', () => {
        expect(
            noSubscriptionReason({
                subscriptions: [{ vertical: 'venue', status: 'PAUSED' }],
                compatibleVerticals: ['accommodation']
            })
        ).toBe('NONE');
        expect(noSubscriptionReason({ subscriptions: [], compatibleVerticals: ['venue'] })).toBe(
            'NONE'
        );
    });
});

describe('publicationStatusTone', () => {
    it('maps the publication states to pill tones, neutral when unknown', () => {
        expect(publicationStatusTone({ status: 'PUBLISHED' })).toBe('success');
        expect(publicationStatusTone({ status: 'UNPUBLISHED_BY_BILLING' })).toBe('warning');
        expect(publicationStatusTone({ status: 'DRAFT' })).toBe('neutral');
        expect(publicationStatusTone({ status: 'toString' })).toBe('neutral');
    });
});
