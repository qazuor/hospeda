/**
 * @file liveness-predicate-divergence.test.ts
 * @description HOS-1310: the three "is this subscription live?" predicates in
 * `@repo/billing`, side by side, one case per status value and one per qzpay
 * alias.
 *
 * ## Why a table and not three unit suites
 *
 * Each predicate already has (or now has) its own suite, and each passes. The
 * defect HOS-1310 names is not inside any one of them — it is that two of them
 * answer the SAME question differently, and that which one a caller reached for
 * came down to which vertical they were working in. A defect in the relationship
 * between three functions cannot be asserted from inside one of them.
 *
 * So this file asserts the relationship: for every status, what all three say.
 * Any change to either set, or to the date arithmetic, lands here as a diff
 * somebody has to read and justify — which is the property the epic wants, given
 * that deciding which criterion is CORRECT is a product decision and is
 * deliberately left open.
 *
 * ## What is design and what is the open question
 *
 * - `past_due` in the live set and in neither other: **design.** Mid-dunning at
 *   the provider (do not duplicate) and granting nothing (dunning exists). The
 *   7-day grace on it belongs to `pastDueGraceMiddleware`.
 * - `cancelled` answered only by the date-aware predicate: **design.** Only a
 *   date separates "already paid through" from "out"; no set of strings can.
 * - `active` / `trialing` / `courtesy` past their end date: the **open
 *   question.** `isEntitlementGrantingStatus` says live, `isSubscriptionLive`
 *   says not. Both claim in their own docblocks to answer "does this grant
 *   access". The cases below pin the disagreement; they do not bless it.
 *
 * ## What this file does NOT prove
 *
 * That each call site picked the right predicate. These are pure functions with
 * no notion of a product domain, so nothing here can see that the commerce
 * visibility reconciler and the accommodation publish gate resolve the same
 * question through different ones. That asymmetry lives at the call sites and is
 * asserted there (`liveness-predicate-call-site.guard.test.ts`).
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { isEntitlementGrantingStatus } from '../src/predicates/is-entitlement-granting-status.js';
import { isLiveSubscriptionStatus } from '../src/predicates/is-live-subscription-status.js';
import { isSubscriptionLive } from '../src/predicates/is-subscription-live.js';
import { QZPAY_STORED_STATUS_ALIASES } from '../src/predicates/subscription-status-normalize.js';

/** Fixed clock. Never `Date.now()` — the 6 h grace boundary must not depend on CI speed. */
const NOW_MS = Date.UTC(2026, 8, 10, 12, 0, 0);
const HOUR_MS = 3_600_000;

/** Every date input `isSubscriptionLive` reads, set to the same instant. */
function datesAt(ms: number | null) {
    const date = ms === null ? null : new Date(ms);
    return { trialEnd: date, currentPeriodEnd: date, courtesyEndsAt: date };
}

/** The three answers for one status under one clock. */
function answersFor(status: string, dateMs: number | null) {
    return {
        granting: isEntitlementGrantingStatus(status),
        liveStatus: isLiveSubscriptionStatus(status),
        dateAware: isSubscriptionLive({ status, ...datesAt(dateMs), nowMs: NOW_MS })
    };
}

type Answers = ReturnType<typeof answersFor>;

/**
 * Dates absent — the fail-open shape. A row with no period/trial end at all is a
 * data anomaly, and every date-aware branch treats it as live on purpose.
 */
const NO_DATES: Readonly<Record<SubscriptionStatusEnum, Answers>> = {
    [SubscriptionStatusEnum.ACTIVE]: { granting: true, liveStatus: true, dateAware: true },
    [SubscriptionStatusEnum.TRIALING]: { granting: true, liveStatus: true, dateAware: true },
    [SubscriptionStatusEnum.COMP]: { granting: true, liveStatus: true, dateAware: true },
    [SubscriptionStatusEnum.COURTESY]: { granting: true, liveStatus: true, dateAware: true },
    /** The one status the live set adds, and that neither other accepts. */
    [SubscriptionStatusEnum.PAST_DUE]: { granting: false, liveStatus: true, dateAware: false },
    /** The one status only the date-aware predicate can answer — fail-open here. */
    [SubscriptionStatusEnum.CANCELLED]: { granting: false, liveStatus: false, dateAware: true },
    [SubscriptionStatusEnum.PAUSED]: { granting: false, liveStatus: false, dateAware: false },
    [SubscriptionStatusEnum.EXPIRED]: { granting: false, liveStatus: false, dateAware: false },
    [SubscriptionStatusEnum.PENDING_PROVIDER]: {
        granting: false,
        liveStatus: false,
        dateAware: false
    },
    [SubscriptionStatusEnum.ABANDONED]: { granting: false, liveStatus: false, dateAware: false }
};

/**
 * Dates 1 h in the past — inside the 6 h cron-lag window. The three agree again
 * on the granting four, because the grace is exactly what keeps them agreeing
 * while a webhook is late.
 */
const ONE_HOUR_ELAPSED: Readonly<Record<SubscriptionStatusEnum, Answers>> = {
    ...NO_DATES,
    /** Soft-cancel grace has NO extra window: 1 h past the period end is out. */
    [SubscriptionStatusEnum.CANCELLED]: { granting: false, liveStatus: false, dateAware: false }
};

/**
 * Dates 48 h in the past — outside every grace window. **This is HOS-1310's
 * disagreement, written out.** Three statuses answer `true` to "does this grant
 * entitlements" and `false` to "is this live given the clock".
 */
const FORTY_EIGHT_HOURS_ELAPSED: Readonly<Record<SubscriptionStatusEnum, Answers>> = {
    ...ONE_HOUR_ELAPSED,
    [SubscriptionStatusEnum.ACTIVE]: { granting: true, liveStatus: true, dateAware: false },
    [SubscriptionStatusEnum.TRIALING]: { granting: true, liveStatus: true, dateAware: false },
    [SubscriptionStatusEnum.COURTESY]: { granting: true, liveStatus: true, dateAware: false },
    /** `comp` is never charged and has nothing to expire against (HOS-239). */
    [SubscriptionStatusEnum.COMP]: { granting: true, liveStatus: true, dateAware: true }
};

const CLOCKS = [
    { label: 'no dates at all (fail-open)', dateMs: null, table: NO_DATES },
    {
        label: '1 h elapsed (inside the 6 h cron-lag grace)',
        dateMs: NOW_MS - HOUR_MS,
        table: ONE_HOUR_ELAPSED
    },
    {
        label: '48 h elapsed (outside every grace window)',
        dateMs: NOW_MS - 48 * HOUR_MS,
        table: FORTY_EIGHT_HOURS_ELAPSED
    }
] as const;

describe.each(CLOCKS)('HOS-1310 divergence table — $label', ({ dateMs, table }) => {
    it('decides every SubscriptionStatusEnum value, with none left out', () => {
        expect(Object.keys(table).sort()).toEqual(Object.values(SubscriptionStatusEnum).sort());
    });

    it.each(Object.entries(table))('%s', (status, expected) => {
        expect(answersFor(status, dateMs)).toEqual(expected);
    });
});

describe('HOS-1310: the elapsed-period disagreement is real, and it is the open question', () => {
    const elapsed = NOW_MS - 48 * HOUR_MS;

    it.each([
        SubscriptionStatusEnum.ACTIVE,
        SubscriptionStatusEnum.TRIALING,
        SubscriptionStatusEnum.COURTESY
    ])('%s past its end date: isEntitlementGrantingStatus says live, isSubscriptionLive says not', (status) => {
        const { granting, dateAware } = answersFor(status, elapsed);
        expect(
            granting,
            'the status-only predicate grants entitlements regardless of the clock'
        ).toBe(true);
        expect(dateAware, 'the date-aware predicate refuses once the grace has run out').toBe(
            false
        );
        // Stated as an inequality too, so a change that makes them agree
        // fails HERE rather than quietly flipping one table row. Unifying
        // them is a product decision (see this file's docblock), and it must
        // not happen by accident.
        expect(granting).not.toBe(dateAware);
    });

    it('and comp is the one status on which they cannot disagree', () => {
        const { granting, liveStatus, dateAware } = answersFor(
            SubscriptionStatusEnum.COMP,
            elapsed
        );
        expect([granting, liveStatus, dateAware]).toEqual([true, true, true]);
    });
});

describe('HOS-1310: all three agree across the qzpay vocabulary', () => {
    /*
     * Derived from the alias map, not typed out. Before the fix, each predicate
     * compared raw literals, so every alias fell through as an unknown string —
     * and the two that mattered (`unpaid`, `canceled`) disagreed with the state
     * they mean.
     */
    it.each(
        Object.entries(QZPAY_STORED_STATUS_ALIASES)
    )('the qzpay spelling %s answers exactly as %s does, in all three', (alias, hospedaStatus) => {
        expect(answersFor(alias, null)).toEqual(answersFor(hospedaStatus, null));
        expect(answersFor(alias, NOW_MS - 48 * HOUR_MS)).toEqual(
            answersFor(hospedaStatus, NOW_MS - 48 * HOUR_MS)
        );
    });

    it("REGRESSION: 'unpaid' is live-at-the-provider and grants nothing", () => {
        expect(answersFor('unpaid', null)).toEqual({
            granting: false,
            liveStatus: true,
            dateAware: false
        });
    });

    it("REGRESSION: 'canceled' gets the soft-cancel grace the British spelling gets", () => {
        // A period still in the future: live for the date-aware predicate, for
        // both spellings. Before the fix the American one answered false here,
        // so the answer depended on whether a deploy had folded the column.
        const future = NOW_MS + 10 * 24 * HOUR_MS;
        expect(
            isSubscriptionLive({
                status: 'canceled',
                currentPeriodEnd: new Date(future),
                nowMs: NOW_MS
            })
        ).toBe(true);
        expect(
            isSubscriptionLive({
                status: SubscriptionStatusEnum.CANCELLED,
                currentPeriodEnd: new Date(future),
                nowMs: NOW_MS
            })
        ).toBe(true);
    });

    it('and an unknown spelling still fails closed in all three', () => {
        expect(answersFor('finished', null)).toEqual({
            granting: false,
            liveStatus: false,
            dateAware: false
        });
    });
});
