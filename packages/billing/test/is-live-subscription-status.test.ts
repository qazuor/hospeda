/**
 * @file is-live-subscription-status.test.ts
 * @description Unit coverage for `isLiveSubscriptionStatus` /
 * `LIVE_SUBSCRIPTION_STATUSES`.
 *
 * The module was promoted into `@repo/billing` by `112a7ab22` with no unit test
 * of its own — its only assertions were the source-level ones in
 * `apps/api/test/services/billing-status-gate-canonical-predicate.guard.test.ts`,
 * which read the file as text and cannot observe a single answer it gives.
 *
 * Every case here is derived from an enumeration rather than typed out: the
 * Hospeda cases from `SubscriptionStatusEnum`, the qzpay cases from
 * `QZPAY_STORED_STATUS_ALIASES`. A hand-typed list of statuses goes blind the
 * day an eleventh is added, which is the same failure mode as the hand-rolled
 * status sets this predicate exists to replace.
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    isLiveSubscriptionStatus,
    LIVE_SUBSCRIPTION_STATUSES
} from '../src/predicates/is-live-subscription-status.js';
import { QZPAY_STORED_STATUS_ALIASES } from '../src/predicates/subscription-status-normalize.js';

/**
 * The expected answer for EVERY member of `SubscriptionStatusEnum`.
 *
 * Typed as a total record, so adding a status to the enum without deciding its
 * liveness is a TypeScript error rather than a test that silently covers nine
 * of ten values (HOS-1310).
 */
const EXPECTED_BY_HOSPEDA_STATUS: Readonly<Record<SubscriptionStatusEnum, boolean>> = {
    [SubscriptionStatusEnum.ACTIVE]: true,
    [SubscriptionStatusEnum.TRIALING]: true,
    [SubscriptionStatusEnum.COMP]: true,
    [SubscriptionStatusEnum.COURTESY]: true,
    /** The ONE status this set adds to the entitlement-granting four. */
    [SubscriptionStatusEnum.PAST_DUE]: true,
    /** A real pause cuts access AND the relationship; a courtesy does not. */
    [SubscriptionStatusEnum.PAUSED]: false,
    [SubscriptionStatusEnum.CANCELLED]: false,
    [SubscriptionStatusEnum.EXPIRED]: false,
    [SubscriptionStatusEnum.PENDING_PROVIDER]: false,
    [SubscriptionStatusEnum.ABANDONED]: false
};

describe('isLiveSubscriptionStatus — one case per SubscriptionStatusEnum value', () => {
    it('covers the whole enum, with no value left undecided', () => {
        // Guards the table above against the enum growing underneath it. Without
        // this, a new status could be added to the enum and to the predicate's set
        // while every `it.each` below kept passing on the old ten.
        expect(Object.keys(EXPECTED_BY_HOSPEDA_STATUS).sort()).toEqual(
            Object.values(SubscriptionStatusEnum).sort()
        );
    });

    it.each(Object.entries(EXPECTED_BY_HOSPEDA_STATUS))('%s => %s', (status, expected) => {
        expect(isLiveSubscriptionStatus(status)).toBe(expected);
    });
});

describe('isLiveSubscriptionStatus — the qzpay vocabulary reaches the same answer (HOS-1310)', () => {
    /*
     * `billing_subscriptions.status` holds qzpay's vocabulary as well as
     * Hospeda's. An alias and the status it means ARE one state — that is what
     * the alias map asserts — so the predicate must answer identically for both
     * or it answers differently about one row depending on which layer wrote it.
     *
     * Derived from the map, so a ninth alias is covered the day it is added.
     */
    it.each(
        Object.entries(QZPAY_STORED_STATUS_ALIASES)
    )('answers the same for the qzpay spelling %s as for %s', (alias, hospedaStatus) => {
        expect(isLiveSubscriptionStatus(alias)).toBe(isLiveSubscriptionStatus(hospedaStatus));
    });

    it("REGRESSION: 'unpaid' is live, because it IS past_due under another name", () => {
        // The bug this file's fix closed. `unpaid` answered false while
        // `past_due` answered true, so `start-paid.ts` would open a SECOND
        // MercadoPago preapproval over an unpaid one. Asserted as a value, not
        // as equality with past_due, so the pair cannot both drift to false and
        // still pass.
        expect(isLiveSubscriptionStatus('unpaid')).toBe(true);
        expect(isLiveSubscriptionStatus(SubscriptionStatusEnum.PAST_DUE)).toBe(true);
    });

    it("'canceled' (qzpay, 1 L) is NOT live, matching 'cancelled' (Hospeda, 2 L's)", () => {
        // The OPPOSITE direction of the same fix: normalization must not widen
        // this set. A cancelled subscription is finished at the provider in both
        // spellings; the date-aware grace for a period already paid for belongs
        // to `isSubscriptionLive`, not here.
        expect(isLiveSubscriptionStatus('canceled')).toBe(false);
        expect(isLiveSubscriptionStatus(SubscriptionStatusEnum.CANCELLED)).toBe(false);
    });
});

describe('isLiveSubscriptionStatus — unknown input fails closed', () => {
    it.each([
        '',
        'ACTIVE',
        'Past_Due',
        'whatever',
        'active ',
        ' active'
    ])('%o is not live', (status) => {
        expect(isLiveSubscriptionStatus(status)).toBe(false);
    });
});

describe('LIVE_SUBSCRIPTION_STATUSES', () => {
    it('holds exactly the five live statuses, in Hospeda vocabulary', () => {
        expect([...LIVE_SUBSCRIPTION_STATUSES].sort()).toEqual([
            'active',
            'comp',
            'courtesy',
            'past_due',
            'trialing'
        ]);
    });

    it('contains no qzpay alias — the set is Hospeda vocabulary, the PREDICATE translates', () => {
        /*
         * The fix deliberately normalizes the input instead of widening the set.
         * Adding `'unpaid'` to the set would have worked for this one alias and
         * left the other seven — and whatever the ninth turns out to be —
         * exactly as blind. This pins the shape of the fix, not just its effect.
         */
        const aliasesThatAreNotHospedaStatuses = Object.keys(QZPAY_STORED_STATUS_ALIASES).filter(
            (alias) =>
                !Object.values(SubscriptionStatusEnum).includes(alias as SubscriptionStatusEnum)
        );
        // Sanity: there IS at least one such alias, so the assertion below is not vacuous.
        expect(aliasesThatAreNotHospedaStatuses.length).toBeGreaterThan(0);
        for (const alias of aliasesThatAreNotHospedaStatuses) {
            expect(LIVE_SUBSCRIPTION_STATUSES.has(alias)).toBe(false);
        }
    });
});
