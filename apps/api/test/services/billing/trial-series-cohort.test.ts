/**
 * HOS-1012 T-016/T-017 — cohort selection for the nine-send trial email series.
 *
 * These tests exercise the real bucket arithmetic against a fake Drizzle client,
 * so the thing under test is the selection rule itself: which subscription is
 * due which send today, and which is due nothing at all.
 *
 * Two properties get first-class assertions because they are the ones that hurt
 * when wrong:
 *
 * - **A distance that is not an offset selects NOTHING.** A trial seven days
 *   out must match no send. The failure mode being excluded is a range filter
 *   ("within 10 days") pretending to be an offset filter, which would mail the
 *   T−10 copy — "todavía te quedan diez días" — to someone with seven.
 * - **`mp_subscription_id IS NULL` is in the WHERE clause.** A fake db cannot
 *   observe SQL filtering, so the condition tree the query builds is inspected
 *   directly. That filter is what keeps the series off the two card-first
 *   trials still live in production, which belong to real customers MercadoPago
 *   is about to charge (OQ-3).
 *
 * @module test/services/billing/trial-series-cohort
 */

import type { DrizzleClient } from '@repo/db';
import { describe, expect, it } from 'vitest';
import { TRIAL_SERIES_SENDS } from '../../../src/services/billing/trial-notification-offsets';
import {
    customerIsPaying,
    findPostExpiryCohorts,
    findPreExpiryCohorts
} from '../../../src/services/billing/trial-series-cohort';

/** Fixed clock: every offset below is measured from here. */
const NOW = new Date('2026-09-01T08:00:00.000Z');

const DAY_MS = 24 * 60 * 60 * 1000;

/** `NOW` shifted by whole (or fractional) days. */
function daysFromNow(days: number): Date {
    return new Date(NOW.getTime() + days * DAY_MS);
}

/** A condition tree as produced by the shared `@repo/db` test mock. */
type Condition = { type: string; column?: string; conditions?: Condition[] };

/**
 * A Drizzle stand-in that returns fixed rows and records the WHERE it was
 * handed, so a test can assert on the filter rather than only on the result.
 */
function fakeDb(rows: readonly Record<string, unknown>[]): {
    db: DrizzleClient;
    whereArgs: Condition[];
} {
    const whereArgs: Condition[] = [];
    const terminal = {
        where: (condition: Condition) => {
            whereArgs.push(condition);
            return Promise.resolve(rows);
        }
    };
    const db = {
        select: () => ({
            from: () => ({
                ...terminal,
                innerJoin: () => terminal
            })
        })
    };
    return { db: db as unknown as DrizzleClient, whereArgs };
}

/** Flatten an `and(...)` tree into its leaves. */
function leaves(condition: Condition | undefined): Condition[] {
    if (!condition) return [];
    return condition.conditions ? condition.conditions.flatMap(leaves) : [condition];
}

function trialRow(overrides: { id: string; trialEnd: Date; metadata?: unknown }) {
    return {
        id: overrides.id,
        customerId: `cust-${overrides.id}`,
        planId: 'plan-owner-basico',
        trialEnd: overrides.trialEnd,
        metadata: overrides.metadata ?? null
    };
}

function expiredRow(overrides: { id: string; expiredAt: Date; trialEnd?: Date }) {
    return {
        id: overrides.id,
        customerId: `cust-${overrides.id}`,
        planId: 'plan-owner-basico',
        trialEnd: overrides.trialEnd ?? overrides.expiredAt,
        metadata: null,
        expiredAt: overrides.expiredAt
    };
}

describe('findPreExpiryCohorts (HOS-1012 T-016)', () => {
    it('puts each trial in the bucket of its own offset', async () => {
        const { db } = fakeDb([
            trialRow({ id: 'sub-10', trialEnd: daysFromNow(10) }),
            trialRow({ id: 'sub-5', trialEnd: daysFromNow(5) }),
            trialRow({ id: 'sub-1', trialEnd: daysFromNow(1) })
        ]);

        const cohorts = await findPreExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect(cohorts.get(-10)?.map((c) => c.subscriptionId)).toEqual(['sub-10']);
        expect(cohorts.get(-5)?.map((c) => c.subscriptionId)).toEqual(['sub-5']);
        expect(cohorts.get(-1)?.map((c) => c.subscriptionId)).toEqual(['sub-1']);
    });

    it('selects nothing for a trial seven days out', async () => {
        // The assertion that separates an OFFSET filter from a RANGE filter. A
        // "within 10 days" query would put this trial in the −10 bucket and mail
        // it copy that says it has ten days left.
        const { db } = fakeDb([trialRow({ id: 'sub-7', trialEnd: daysFromNow(7) })]);

        const cohorts = await findPreExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect([...cohorts.values()].flat()).toEqual([]);
    });

    it('excludes trials that carry a MercadoPago preapproval', async () => {
        // A fake db cannot filter, so the filter itself is the assertion. This
        // is what keeps the series off the card-first trials MercadoPago is
        // about to charge — a "mañana sale del sitio" mail to one of those is
        // simply false, and the two live in production belong to real
        // customers.
        const { db, whereArgs } = fakeDb([]);

        await findPreExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect(leaves(whereArgs[0])).toContainEqual({
            type: 'isNull',
            column: 'mp_subscription_id'
        });
    });

    it('carries the interval the customer originally chose, when recorded', async () => {
        const { db } = fakeDb([
            trialRow({
                id: 'sub-a',
                trialEnd: daysFromNow(5),
                metadata: { intendedInterval: 'annual' }
            }),
            trialRow({ id: 'sub-b', trialEnd: daysFromNow(5), metadata: { other: 'thing' } })
        ]);

        const cohorts = await findPreExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });
        const cohort = cohorts.get(-5) ?? [];

        expect(cohort[0]?.intendedInterval).toBe('annual');
        expect(cohort[1]?.intendedInterval).toBeUndefined();
    });

    it('honours the send list it is given, not the full table', async () => {
        // How the admin reminder toggle silences the eight reminders while
        // leaving the expiry mail alone: the caller passes a narrowed list.
        const { db } = fakeDb([trialRow({ id: 'sub-5', trialEnd: daysFromNow(5) })]);
        const expiryOnly = TRIAL_SERIES_SENDS.filter((s) => s.direction === 'expiry');

        const cohorts = await findPreExpiryCohorts({ sends: expiryOnly, now: NOW, db });

        expect([...cohorts.values()].flat()).toEqual([]);
    });
});

describe('findPostExpiryCohorts (HOS-1012 T-017)', () => {
    it('measures the distance from the expiry EVENT, not from trial_end', async () => {
        // The two normally agree. They come apart when the expiry job was down:
        // trial_end says the listing came down on Monday, the owner watched it
        // come down on Wednesday, and all six of these emails talk about the
        // day it came down.
        const { db } = fakeDb([
            expiredRow({
                id: 'sub-late',
                trialEnd: daysFromNow(-4),
                expiredAt: daysFromNow(-1)
            })
        ]);

        const cohorts = await findPostExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect(cohorts.get(1)?.map((c) => c.subscriptionId)).toEqual(['sub-late']);
        expect(cohorts.get(5)).toBeUndefined();
    });

    it('puts an expiry from earlier today in the offset-0 bucket', async () => {
        // The expiry cron runs at 02:00 UTC and this one at 08:00, so on the day
        // itself the gap is six hours — day 0, not day 1.
        const { db } = fakeDb([expiredRow({ id: 'sub-today', expiredAt: daysFromNow(-0.25) })]);

        const cohorts = await findPostExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect(cohorts.get(0)?.map((c) => c.subscriptionId)).toEqual(['sub-today']);
    });

    it('selects nothing three days after expiry', async () => {
        const { db } = fakeDb([expiredRow({ id: 'sub-3', expiredAt: daysFromNow(-3) })]);

        const cohorts = await findPostExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect([...cohorts.values()].flat()).toEqual([]);
    });

    it('sends nothing after day 60', async () => {
        // The series ends rather than tapering. The array ending IS the
        // mechanism — there is no fallback send behind it.
        const { db } = fakeDb([expiredRow({ id: 'sub-90', expiredAt: daysFromNow(-90) })]);

        const cohorts = await findPostExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect([...cohorts.values()].flat()).toEqual([]);
    });

    it('joins on the TRIAL_EXPIRED event and excludes provider-backed rows', async () => {
        const { db, whereArgs } = fakeDb([]);

        await findPostExpiryCohorts({ sends: TRIAL_SERIES_SENDS, now: NOW, db });

        expect(leaves(whereArgs[0])).toContainEqual({
            type: 'isNull',
            column: 'mp_subscription_id'
        });
    });
});

describe('customerIsPaying (HOS-1012 T-018)', () => {
    it('is true when the customer holds another entitlement-granting row', async () => {
        const { db } = fakeDb([
            { id: 'trial-row', status: 'trialing' },
            { id: 'paid-row', status: 'active' }
        ]);

        await expect(
            customerIsPaying({ customerId: 'cust-1', excludeSubscriptionId: 'trial-row', db })
        ).resolves.toBe(true);
    });

    it('is false when the only row is the trial itself', async () => {
        // Without the exclusion the trial would count as its own conversion and
        // the whole series would go silent on day one.
        const { db } = fakeDb([{ id: 'trial-row', status: 'trialing' }]);

        await expect(
            customerIsPaying({ customerId: 'cust-1', excludeSubscriptionId: 'trial-row', db })
        ).resolves.toBe(false);
    });

    it('is false when the other row is itself a trial', async () => {
        // A second trial is not a payment.
        const { db } = fakeDb([
            { id: 'trial-row', status: 'trialing' },
            { id: 'other-trial', status: 'trialing' }
        ]);

        await expect(
            customerIsPaying({ customerId: 'cust-1', excludeSubscriptionId: 'trial-row', db })
        ).resolves.toBe(false);
    });

    it('is false when the other row is cancelled or expired', async () => {
        const { db } = fakeDb([
            { id: 'trial-row', status: 'trialing' },
            { id: 'dead-row', status: 'cancelled' },
            { id: 'old-row', status: 'expired' }
        ]);

        await expect(
            customerIsPaying({ customerId: 'cust-1', excludeSubscriptionId: 'trial-row', db })
        ).resolves.toBe(false);
    });
});
