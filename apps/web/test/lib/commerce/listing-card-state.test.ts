/**
 * @file listing-card-state.test.ts
 * @description Unit tests for the commerce owner listing-card state machine
 * (HOS-166 §8 point 6). Pure function — no DB, no mocks needed.
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveCommerceListingCardState } from '../../../src/lib/commerce/listing-card-state';

describe('resolveCommerceListingCardState', () => {
    it('returns published when the listing is public, regardless of completeness', () => {
        const state = resolveCommerceListingCardState({
            isPublic: true,
            completeness: null
        });

        expect(state).toEqual({ kind: 'published' });
    });

    it('returns draft-incomplete with the missing list when not public and incomplete', () => {
        const state = resolveCommerceListingCardState({
            isPublic: false,
            completeness: { complete: false, missing: ['summary', 'contactInfo'] }
        });

        expect(state).toEqual({
            kind: 'draft-incomplete',
            missing: ['summary', 'contactInfo']
        });
    });

    it('returns draft-complete when not public and complete', () => {
        const state = resolveCommerceListingCardState({
            isPublic: false,
            completeness: { complete: true, missing: [] }
        });

        expect(state).toEqual({ kind: 'draft-complete' });
    });

    it('returns unknown when completeness could not be determined', () => {
        const state = resolveCommerceListingCardState({
            isPublic: false,
            completeness: null
        });

        expect(state).toEqual({ kind: 'unknown' });
    });

    it('returns pending-payment when a checkout is in flight, overriding draft states', () => {
        const state = resolveCommerceListingCardState({
            isPublic: false,
            completeness: { complete: true, missing: [] },
            isCheckoutStarting: true
        });

        expect(state).toEqual({ kind: 'pending-payment' });
    });

    it('never returns pending-payment once the listing is already published', () => {
        const state = resolveCommerceListingCardState({
            isPublic: true,
            completeness: null,
            isCheckoutStarting: true
        });

        expect(state).toEqual({ kind: 'published' });
    });

    describe('suspended (HOS-166 judgment-day W1)', () => {
        it('returns suspended when subscriptionStatus is past_due and the listing is not public', () => {
            const state = resolveCommerceListingCardState({
                isPublic: false,
                completeness: { complete: true, missing: [] },
                subscriptionStatus: SubscriptionStatusEnum.PAST_DUE
            });

            expect(state).toEqual({ kind: 'suspended' });
        });

        it('prefers published over suspended when isPublic is still true (reconciliation-lag window)', () => {
            const state = resolveCommerceListingCardState({
                isPublic: true,
                completeness: null,
                subscriptionStatus: SubscriptionStatusEnum.PAST_DUE
            });

            expect(state).toEqual({ kind: 'published' });
        });

        it('does not treat other non-active statuses (e.g. paused) as suspended — falls through to the honest draft state', () => {
            const state = resolveCommerceListingCardState({
                isPublic: false,
                completeness: { complete: true, missing: [] },
                subscriptionStatus: SubscriptionStatusEnum.PAUSED
            });

            expect(state).toEqual({ kind: 'draft-complete' });
        });

        it('ignores a missing subscriptionStatus (never provided) — falls through to completeness-based states', () => {
            const state = resolveCommerceListingCardState({
                isPublic: false,
                completeness: { complete: false, missing: ['summary'] }
            });

            expect(state).toEqual({ kind: 'draft-incomplete', missing: ['summary'] });
        });
    });
});
