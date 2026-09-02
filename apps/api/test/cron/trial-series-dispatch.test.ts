/**
 * HOS-1012 T-018/T-019/T-020 — the nine-send trial email series, end to end.
 *
 * The cohort SELECTION is tested in `test/services/billing/trial-series-cohort`;
 * what is tested here is what happens to a candidate once selected:
 *
 * - each offset dispatches ITS OWN notification type (T-016). Nine sends that
 *   all reach for one type is the failure this whole redesign exists to undo;
 * - the durable ledger row carries the SEND, not just the subscription, so a
 *   pre-1-day and a post-1-day mail can never collapse into one (T-019);
 * - live subscription state is re-read immediately before each dispatch, so
 *   someone who paid between selection and send gets nothing (T-018);
 * - a re-run on the same day sends nothing twice.
 *
 * @module test/cron/trial-series-dispatch
 */

import { NotificationType } from '@repo/notifications';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

const { mockGetDb, selectLimit, insertValues } = vi.hoisted(() => {
    const limit = vi.fn().mockResolvedValue([]);
    const values = vi.fn(() => ({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined)
    }));
    return {
        mockGetDb: {
            select: vi.fn(() => ({
                from: vi.fn(() => ({
                    where: vi.fn(() => ({ limit }))
                }))
            })),
            insert: vi.fn(() => ({ values }))
        },
        selectLimit: limit,
        insertValues: values
    };
});

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => mockGetDb),
    billingSubscriptionEvents: {
        id: 'id',
        subscriptionId: 'subscription_id',
        eventType: 'event_type'
    },
    and: vi.fn((...conds: unknown[]) => ({ __and: conds })),
    eq: vi.fn(() => ({ __eq: true }))
}));

vi.mock('../../src/services/billing/trial-series-cohort', () => ({
    findPreExpiryCohorts: vi.fn(),
    findPostExpiryCohorts: vi.fn(),
    customerIsPaying: vi.fn().mockResolvedValue(false)
}));

vi.mock('../../src/utils/customer-lookup', () => ({
    lookupCustomerDetails: vi.fn().mockResolvedValue({
        email: 'anfitrion@example.com',
        name: 'Marta Giménez',
        userId: 'user-1'
    })
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/trial.service', () => ({
    buildTrialUpgradeUrl: vi.fn(
        (input: { siteUrl: string }) => `${input.siteUrl}/es/suscriptores/planes/`
    )
}));

vi.mock('../../src/services/billing/plan-change-reason', () => ({
    planDisplayNameFromPlan: vi.fn(() => 'Plan Anfitrión')
}));

import { dispatchTrialSeries } from '../../src/cron/jobs/trial-series-dispatch';
import {
    customerIsPaying,
    findPostExpiryCohorts,
    findPreExpiryCohorts,
    type TrialSeriesCandidate
} from '../../src/services/billing/trial-series-cohort';
import { lookupCustomerDetails } from '../../src/utils/customer-lookup';
import { sendNotification } from '../../src/utils/notification-helper';

/** A billing stub — only `plans.get` is reached. */
const billing = {
    plans: { get: vi.fn().mockResolvedValue({ name: 'owner-basico', metadata: {} }) }
} as never;

function candidate(id: string): TrialSeriesCandidate {
    return {
        subscriptionId: id,
        customerId: `cust-${id}`,
        planId: 'plan-1',
        trialEnd: new Date('2026-09-26T00:00:00.000Z')
    };
}

function logger(): CronJobContext['logger'] {
    return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

/** Stub the two cohort finders from a plain offset → candidate-ids map. */
function withCohorts(byOffset: Record<number, string[]>): void {
    const pre = new Map<number, TrialSeriesCandidate[]>();
    const post = new Map<number, TrialSeriesCandidate[]>();
    for (const [rawOffset, ids] of Object.entries(byOffset)) {
        const offset = Number(rawOffset);
        (offset < 0 ? pre : post).set(offset, ids.map(candidate));
    }
    vi.mocked(findPreExpiryCohorts).mockResolvedValue(pre);
    vi.mocked(findPostExpiryCohorts).mockResolvedValue(post);
}

/** The notification types actually dispatched, in dispatch order. */
function dispatchedTypes(): NotificationType[] {
    return vi
        .mocked(sendNotification)
        .mock.calls.map((call) => (call[0] as { type: NotificationType }).type);
}

describe('dispatchTrialSeries (HOS-1012)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        selectLimit.mockReset().mockResolvedValue([]);
        vi.mocked(customerIsPaying).mockReset().mockResolvedValue(false);
        vi.mocked(lookupCustomerDetails).mockResolvedValue({
            email: 'anfitrion@example.com',
            name: 'Marta Giménez',
            userId: 'user-1'
        });
        process.env.HOSPEDA_SITE_URL = 'https://hospeda.com.ar';
    });

    it('dispatches each offset with its OWN notification type', async () => {
        // Nine offsets, nine types, no shared template. This is the assertion
        // that fails if any send is ever routed through another send's type.
        withCohorts({
            '-10': ['a'],
            '-5': ['b'],
            '-1': ['c'],
            0: ['d'],
            1: ['e'],
            5: ['f'],
            10: ['g'],
            30: ['h'],
            60: ['i']
        });

        const result = await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(result.sent).toBe(9);
        expect(dispatchedTypes()).toEqual([
            NotificationType.TRIAL_ENDING_10D,
            NotificationType.TRIAL_ENDING_5D,
            NotificationType.TRIAL_ENDING_1D,
            NotificationType.TRIAL_EXPIRED,
            NotificationType.TRIAL_WIN_BACK_1D,
            NotificationType.TRIAL_WIN_BACK_5D,
            NotificationType.TRIAL_WIN_BACK_10D,
            NotificationType.TRIAL_WIN_BACK_30D,
            NotificationType.TRIAL_WIN_BACK_60D
        ]);
    });

    it('gives the pre-1-day and post-1-day sends different ledger rows and keys', async () => {
        // T-019. Both are "one day" from `trial_end` in opposite directions.
        // Under the previous scheme both produced the idempotency suffix `:d1`
        // and were told apart by the notification type alone; a refactor reusing
        // one type across both directions would have silently collapsed them
        // into a single send. Here they are two distinct event types, which the
        // partial UNIQUE index also keys on.
        withCohorts({ '-1': ['same-sub'], 1: ['same-sub'] });

        await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        const eventTypes = (insertValues.mock.calls as unknown as [{ eventType: string }][]).map(
            (call) => call[0].eventType
        );
        expect(eventTypes).toEqual([
            BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_PRE_1D,
            BILLING_EVENT_TYPES.TRIAL_SERIES_NOTIF_POST_1D
        ]);
        expect(new Set(eventTypes).size).toBe(2);

        const idempotencyKeys = vi
            .mocked(sendNotification)
            .mock.calls.map((call) => (call[0] as { idempotencyKey: string }).idempotencyKey);
        expect(new Set(idempotencyKeys).size).toBe(2);
    });

    it('sends nothing twice when the day is re-run', async () => {
        // The ledger already holds this send.
        selectLimit.mockResolvedValue([{ id: 'existing-event' }]);
        withCohorts({ '-5': ['a'], 0: ['b'] });

        const result = await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(result.sent).toBe(0);
        expect(result.deduped).toBe(2);
        expect(sendNotification).not.toHaveBeenCalled();
        expect(insertValues).not.toHaveBeenCalled();
    });

    it('sends nothing to a customer who paid between selection and dispatch', async () => {
        // T-018. The cohort said they were still trialing; by the time this send
        // came up they had bought a plan. Mailing "tu publicación sale del
        // sitio" to someone who paid two minutes ago is the worst thing this
        // series can do.
        vi.mocked(customerIsPaying).mockResolvedValue(true);
        withCohorts({ '-1': ['a'] });

        const result = await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(result.converted).toBe(1);
        expect(result.sent).toBe(0);
        expect(sendNotification).not.toHaveBeenCalled();
        expect(insertValues).not.toHaveBeenCalled();
    });

    it('re-checks the live state ONCE PER CANDIDATE, not once per run', async () => {
        // The mutation this pins: hoisting the paying check out of the
        // per-candidate loop turns it back into the snapshot it was meant to
        // replace. Three candidates must produce three re-reads.
        withCohorts({ '-5': ['a', 'b'], 1: ['c'] });

        await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(customerIsPaying).toHaveBeenCalledTimes(3);
        expect(customerIsPaying).toHaveBeenCalledWith(
            expect.objectContaining({ excludeSubscriptionId: 'a' })
        );
        expect(customerIsPaying).toHaveBeenCalledWith(
            expect.objectContaining({ excludeSubscriptionId: 'c' })
        );
    });

    it('re-checks live state BEFORE handing anything to the mailer', async () => {
        // Ordering, not just presence: a re-check that runs after the send has
        // already been dispatched protects nobody.
        const order: string[] = [];
        vi.mocked(customerIsPaying).mockImplementation(async () => {
            order.push('check');
            return false;
        });
        vi.mocked(sendNotification).mockImplementation(async () => {
            order.push('send');
        });
        withCohorts({ '-5': ['a'] });

        await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(order).toEqual(['check', 'send']);
    });

    it('silences the eight reminders but never the expiry mail when the toggle is off', async () => {
        // The expiry mail is TRANSACTIONAL: a host whose listing left the site
        // has to be told it left the site, and an admin preference about
        // reminders is not consent to withhold that.
        withCohorts({ '-10': ['a'], 0: ['b'], 30: ['c'] });

        const result = await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: false
        });

        expect(result.sent).toBe(1);
        expect(dispatchedTypes()).toEqual([NotificationType.TRIAL_EXPIRED]);
    });

    it('counts the cohorts and dispatches nothing in dry-run mode', async () => {
        withCohorts({ '-10': ['a', 'b'], 0: ['c'] });

        const result = await dispatchTrialSeries({
            billing,
            dryRun: true,
            logger: logger(),
            remindersEnabled: true
        });

        expect(result.cohortSizes[-10]).toBe(2);
        expect(result.cohortSizes[0]).toBe(1);
        expect(result.sent).toBe(0);
        expect(sendNotification).not.toHaveBeenCalled();
        expect(insertValues).not.toHaveBeenCalled();
    });

    it('skips a candidate whose customer cannot be looked up, without failing the run', async () => {
        vi.mocked(lookupCustomerDetails).mockResolvedValue(null);
        withCohorts({ 5: ['a'] });

        const result = await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(result.noCustomer).toBe(1);
        expect(result.errors).toBe(0);
        expect(sendNotification).not.toHaveBeenCalled();
    });

    it('keeps going when one candidate throws, and counts the failure', async () => {
        // A single bad row must not cost the other eight sends their day.
        vi.mocked(customerIsPaying)
            .mockRejectedValueOnce(new Error('connection reset'))
            .mockResolvedValue(false);
        withCohorts({ '-5': ['boom', 'fine'] });

        const result = await dispatchTrialSeries({
            billing,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(result.errors).toBe(1);
        expect(result.sent).toBe(1);
    });

    it('still sends when the plan display name cannot be resolved', async () => {
        // Degraded copy beats withholding the mail that says the listing is
        // coming down.
        const failingBilling = {
            plans: { get: vi.fn().mockRejectedValue(new Error('plan lookup failed')) }
        } as never;
        withCohorts({ '-1': ['a'] });

        const result = await dispatchTrialSeries({
            billing: failingBilling,
            dryRun: false,
            logger: logger(),
            remindersEnabled: true
        });

        expect(result.sent).toBe(1);
        expect(sendNotification).toHaveBeenCalledTimes(1);
    });
});
