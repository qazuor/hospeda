/**
 * Tests for {@link PENDING_PROVIDER_STORED_STATUSES} (HOS-1326).
 *
 * The set answers one question — "which stored spellings mean *this checkout was
 * created locally and the provider never confirmed it*?" — and two writers use it
 * as the `WHERE status IN (...)` precondition of a write that means "this
 * checkout never started": the `abandoned-pending-subs` reaper and the
 * unlinkable-preapproval cleanup in `paid-subscription-create`.
 *
 * These assertions are deliberately about the DERIVATION, not about the two
 * strings the set happens to hold today. A test that listed `['incomplete',
 * 'pending_provider']` back would pass just as happily over a hand-typed
 * constant, and would go blind on the day a third alias is added — which is the
 * exact failure mode this column keeps producing (HOS-108, HOS-282, HOS-1310).
 *
 * @module test/pending-provider-stored-statuses
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    normalizeStoredSubscriptionStatus,
    PENDING_PROVIDER_STORED_STATUSES,
    QZPAY_STORED_STATUS_ALIASES
} from '../src/predicates/index.js';

describe('PENDING_PROVIDER_STORED_STATUSES', () => {
    // The defining property. Every member must normalize to PENDING_PROVIDER —
    // otherwise a write guarded on this set would admit a row that means
    // something else entirely.
    it('every member normalizes to PENDING_PROVIDER', () => {
        expect(PENDING_PROVIDER_STORED_STATUSES.length).toBeGreaterThan(0);
        for (const status of PENDING_PROVIDER_STORED_STATUSES) {
            expect(normalizeStoredSubscriptionStatus(status)).toBe(
                SubscriptionStatusEnum.PENDING_PROVIDER
            );
        }
    });

    // The converse, and the half that catches an ADDED alias: a qzpay spelling
    // that normalizes to PENDING_PROVIDER and is missing from the set would let
    // a genuinely-abandoned row escape both writers silently.
    it('contains EVERY qzpay alias that normalizes to PENDING_PROVIDER', () => {
        const expected = Object.entries(QZPAY_STORED_STATUS_ALIASES)
            .filter(([, mapped]) => mapped === SubscriptionStatusEnum.PENDING_PROVIDER)
            .map(([alias]) => alias);

        expect(expected.length).toBeGreaterThan(0);
        for (const alias of expected) {
            expect(PENDING_PROVIDER_STORED_STATUSES).toContain(alias);
        }
    });

    it('contains the Hospeda-vocabulary spelling itself', () => {
        expect(PENDING_PROVIDER_STORED_STATUSES).toContain(SubscriptionStatusEnum.PENDING_PROVIDER);
    });

    // The one thing that must never be admitted. `canceled`/`cancelled` mean a
    // relationship that existed and ended; letting either in would let the
    // abandon writers rewrite a real cancellation as an abandonment — a strictly
    // worse bug than the one HOS-1326 fixed, because it would destroy true data
    // rather than mislabel absent data.
    it.each([
        SubscriptionStatusEnum.CANCELLED,
        'canceled',
        SubscriptionStatusEnum.ACTIVE,
        SubscriptionStatusEnum.TRIALING,
        SubscriptionStatusEnum.ABANDONED,
        SubscriptionStatusEnum.EXPIRED,
        SubscriptionStatusEnum.PAST_DUE,
        SubscriptionStatusEnum.COMP
    ])('excludes %s', (status) => {
        expect(PENDING_PROVIDER_STORED_STATUSES).not.toContain(status);
    });

    it('is frozen, so a consumer cannot widen the shared precondition in place', () => {
        expect(Object.isFrozen(PENDING_PROVIDER_STORED_STATUSES)).toBe(true);
    });
});
