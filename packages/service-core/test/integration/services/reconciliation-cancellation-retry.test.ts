/**
 * TEST:B11:6 — the 3-day retry of our decided cancellations (AC:B11:6), and the sweep's half
 * of TEST:B11:4 (a probe's tombstone is never sent to cancel). HOS-1603.
 */
import {
    and,
    emailOutbox,
    eq,
    inArray,
    payments,
    providerLinks,
    reconciliationMarks,
    refunds,
    subscriptions
} from '@repo/db';
import { type PaymentProvider, parseProbeManifest } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderCancellationTransition } from '../../../src/services/billing/reconciliation/provider-cancellation-decision.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import type { BeforeCancelNotice } from '../../../src/services/billing/subscription/start-subscription.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    seedCancellationDecision,
    seedSubscription,
    trackSeededReconciliationRow,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import {
    handleCharge,
    markOpenedEvents,
    unknownCharge
} from './reconciliation-tombstone-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-01T10:00:00.000Z');
let current = T0;
const clock = { now: () => current };

beforeAll(() => {
    getServiceTestDb();
});
afterAll(closeServiceTestPool);
beforeEach(() => {
    current = T0;
    vi.restoreAllMocks();
    resetSeededReconciliationInventory();
});

/** One fake for every row, on the mutable clock, so each read is fresh for its act. */
function newFake() {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        honestAbout: [{ lie: 'M8', why: 'the receipt tombstone of a late debit is charged' }]
    });
    return { fake, provider: fake as unknown as PaymentProvider };
}

type Notice = Awaited<ReturnType<BeforeCancelNotice['beforeCancel']>>;

/** Spies that keep every preapproval alive and record the notice/cancel order. */
function harness(fake: FakePaymentProvider, answer: Notice = 'SENT') {
    const events: string[] = [];
    const realCancel = fake.cancel.bind(fake);
    const realRead = fake.readAuthorization.bind(fake);
    const beforeCancel = vi.fn<BeforeCancelNotice['beforeCancel']>(async (input) => {
        events.push(`notice:${input.subscriptionId}`);
        return answer;
    });
    const cancel = vi.spyOn(fake, 'cancel').mockImplementation(async (input) => {
        events.push(`cancel:${input.authorizationId}`);
        throw new Error('timeout');
    });
    const read = vi.spyOn(fake, 'readAuthorization');
    const money = ['changeAmount', 'pause', 'resume', 'charge', 'refund'].map((method) =>
        vi.spyOn(fake, method as 'changeAmount')
    );
    return { events, realCancel, realRead, beforeCancel, cancel, read, money };
}

async function runDay(
    day: number,
    fake: FakePaymentProvider,
    beforeCancel: BeforeCancelNotice['beforeCancel'] | null
) {
    current = new Date(T0.getTime() + day * DAY + 60_000);
    const correlationId = crypto.randomUUID();
    const summary = await withSeededReconciliationInventory(() =>
        withSeededCancellationRetryInventory(() =>
            runReconciliationSweep(
                { correlationId },
                {
                    provider: fake as unknown as PaymentProvider,
                    clock,
                    ...(beforeCancel
                        ? { cancellationRetry: { beforeCancelNotice: { beforeCancel } } }
                        : {})
                }
            )
        )
    );
    return { summary, correlationId };
}

async function decided(input: {
    readonly fake: FakePaymentProvider;
    readonly status: string;
    readonly transition: ProviderCancellationTransition;
    readonly class?: 'PRINCIPAL' | 'COMPLEMENTO';
    readonly vertical?: 'accommodation' | 'tourist';
}) {
    const seeded = await seedSubscription({
        status: input.status,
        class: input.class,
        vertical: input.vertical,
        withLink: true,
        fake: input.fake
    });
    await seedCancellationDecision({
        subscriptionId: seeded.subscription.id,
        transition: input.transition,
        decidedAt: T0
    });
    return {
        id: seeded.subscription.id,
        userId: seeded.subscription.userId,
        providerId: seeded.providerId!
    };
}

async function openMarks16(subscriptionIds: readonly string[]) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            and(
                inArray(reconciliationMarks.subscriptionId, [...subscriptionIds]),
                eq(reconciliationMarks.reason, 'CANCELACION_SIN_CONFIRMAR')
            )
        );
}

async function moneyAndRows(subscriptionIds: readonly string[]) {
    const db = getServiceTestDb();
    const subs = await db
        .select()
        .from(subscriptions)
        .where(inArray(subscriptions.id, [...subscriptionIds]));
    const links = await db
        .select()
        .from(providerLinks)
        .where(inArray(providerLinks.subscriptionId, [...subscriptionIds]));
    const paymentRows = await db
        .select()
        .from(payments)
        .where(inArray(payments.subscriptionId, [...subscriptionIds]));
    const refundRows =
        paymentRows.length === 0
            ? []
            : await db
                  .select()
                  .from(refunds)
                  .where(
                      inArray(
                          refunds.paymentId,
                          paymentRows.map(({ id }) => id)
                      )
                  );
    const byId = <T extends { id: string }>(rows: T[]) =>
        [...rows].sort((a, b) => a.id.localeCompare(b.id));
    return {
        subs: byId(subs),
        links: byId(links),
        payments: byId(paymentRows),
        refunds: byId(refundRows)
    };
}

function calledWith(spy: { mock: { calls: unknown[][] } }, authorizationId: string) {
    return spy.mock.calls.filter(
        ([input]) => (input as { authorizationId?: string }).authorizationId === authorizationId
    ).length;
}

describe('TEST:B11:6 el reintento de 3 días', () => {
    it('TEST:B11:6 (a) one row of each population is retried with the notice first on days 0-2, marked 16 on day 3 and stopped on day 4, without touching money', async () => {
        const { fake, provider } = newFake();
        const h = harness(fake);
        const s3 = await decided({ fake, status: 'ABANDONED', transition: 'S3' });
        const s16 = await decided({ fake, status: 'CHARGE_DECLINED', transition: 'S16' });
        const s36 = await decided({ fake, status: 'CANCELLED', transition: 'S36' });
        const a3 = await decided({
            fake,
            status: 'CANCELLED',
            class: 'COMPLEMENTO',
            transition: 'A3'
        });
        const s11 = await decided({ fake, status: 'CANCEL_SCHEDULED', transition: 'S11' });
        const vip = await decided({
            fake,
            status: 'CANCELLED',
            vertical: 'tourist',
            transition: 'TOURIST_VIP_INHERITED'
        });
        // The receipt tombstone goes through the real handler, whose own call times out.
        const debit = await unknownCharge(fake);
        const { result } = await handleCharge(debit, { provider, clock });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        expect(result.cancellation).toBe('CALL_FAILED');
        trackSeededReconciliationRow(result.subscriptionId);
        const tombstone = {
            id: result.subscriptionId,
            userId: null,
            providerId: debit.authorizationId
        };
        const rows = [s3, s16, s36, a3, s11, vip, tombstone];
        const withUser = rows.filter((row) => row.userId !== null);
        const ids = rows.map(({ id }) => id);
        const before = await moneyAndRows(ids);
        for (const spy of h.money) spy.mockClear();
        h.cancel.mockClear();
        h.events.length = 0;

        for (const day of [0, 1, 2]) {
            h.cancel.mockClear();
            h.beforeCancel.mockClear();
            h.events.length = 0;
            const { summary } = await runDay(day, fake, h.beforeCancel);
            expect(summary.rowsFailed, `day ${day}`).toBe(0);
            expect(summary.cancellationRetry).toMatchObject({ callFailed: rows.length, marked: 0 });
            for (const row of rows)
                expect(calledWith(h.cancel, row.providerId), `day ${day}`).toBe(1);
            expect(h.beforeCancel).toHaveBeenCalledTimes(withUser.length);
            for (const row of withUser) {
                // Same occurrence every day (the subscription id), never an occurrenceId of the run;
                // the VIP's row repeats its clause's kind (the template is in the dedupe key).
                expect(h.beforeCancel).toHaveBeenCalledWith({
                    subscriptionId: row.id,
                    userId: row.userId,
                    ...(row === vip ? { kind: 'TOURIST_VIP_INHERITED' } : {})
                });
                expect(h.events.indexOf(`notice:${row.id}`)).toBeLessThan(
                    h.events.indexOf(`cancel:${row.providerId}`)
                );
            }
            expect(h.events).not.toContain(`notice:${tombstone.id}`);
            expect(await openMarks16(ids)).toEqual([]);
        }

        h.cancel.mockClear();
        const day3 = await runDay(3, fake, h.beforeCancel);
        expect(day3.summary.cancellationRetry).toMatchObject({ marked: rows.length });
        expect(h.cancel).not.toHaveBeenCalled();
        const marks = await openMarks16(ids);
        expect(marks.map((mark) => mark.subscriptionId).sort()).toEqual([...ids].sort());
        expect(marks.every((mark) => mark.liftedAt === null)).toBe(true);
        expect(await markOpenedEvents(day3.correlationId)).toHaveLength(rows.length);

        h.cancel.mockClear();
        h.read.mockClear();
        h.beforeCancel.mockClear();
        const day4 = await runDay(4, fake, h.beforeCancel);
        expect(day4.summary.cancellationRetry).toMatchObject({ stopped: rows.length, marked: 0 });
        expect(h.cancel).not.toHaveBeenCalled();
        expect(h.beforeCancel).not.toHaveBeenCalled();
        // The live loop still reads the CANCEL_SCHEDULED row for its own comparisons; the retry
        // reads none of them.
        for (const row of rows)
            expect(calledWith(h.read, row.providerId), row.id).toBe(row === s11 ? 1 : 0);
        expect(await openMarks16(ids)).toHaveLength(rows.length);

        expect(await moneyAndRows(ids)).toEqual(before);
        for (const spy of h.money) expect(spy).not.toHaveBeenCalled();
    });

    it('TEST:B11:6 (b) a cancellation applied on day 1 is CONFIRMED, not called on day 2 and never marked', async () => {
        const { fake } = newFake();
        const h = harness(fake);
        const row = await decided({ fake, status: 'CANCELLED', transition: 'S36' });
        h.cancel.mockImplementation(async (input) => {
            if (current.getTime() < T0.getTime() + DAY) throw new Error('timeout');
            return h.realCancel(input);
        });
        expect((await runDay(0, fake, h.beforeCancel)).summary.cancellationRetry).toMatchObject({
            callFailed: 1
        });
        expect((await runDay(1, fake, h.beforeCancel)).summary.cancellationRetry).toMatchObject({
            confirmed: 1
        });
        h.cancel.mockClear();
        expect((await runDay(2, fake, h.beforeCancel)).summary.cancellationRetry).toMatchObject({
            confirmed: 1
        });
        expect(h.cancel).not.toHaveBeenCalled();
        expect((await runDay(3, fake, h.beforeCancel)).summary.cancellationRetry).toMatchObject({
            confirmed: 1,
            marked: 0
        });
        expect(await openMarks16([row.id])).toEqual([]);
    });

    it('TEST:B11:6 (c) a notice NOT_YET_SENT for three days never calls, and day 3 marks anyway', async () => {
        const { fake } = newFake();
        const h = harness(fake, 'NOT_YET_SENT');
        const row = await decided({ fake, status: 'ABANDONED', transition: 'S3' });
        for (const day of [0, 1, 2]) {
            const { summary } = await runDay(day, fake, h.beforeCancel);
            expect(summary.cancellationRetry).toMatchObject({ noticePending: 1 });
        }
        expect(h.cancel).not.toHaveBeenCalled();
        expect((await runDay(3, fake, h.beforeCancel)).summary.cancellationRetry).toMatchObject({
            marked: 1
        });
        expect(await openMarks16([row.id])).toHaveLength(1);
    });

    it('TEST:B11:6 (d) a CANCELLED row we never sent to cancel is not read by the pass, not cancelled and gets no mark 16', async () => {
        // The state mark for this row ("abre la de estado") is AC:B11:8, the state comparison of
        // HOS-1604; this leaf only asserts that it is not retried and does not open mark 16.
        const { fake } = newFake();
        const h = harness(fake);
        const mirror = await seedSubscription({ status: 'CANCELLED', withLink: true, fake });
        for (const day of [0, 3]) await runDay(day, fake, h.beforeCancel);
        expect(calledWith(h.read, mirror.providerId!)).toBe(0);
        expect(calledWith(h.cancel, mirror.providerId!)).toBe(0);
        expect(h.beforeCancel).not.toHaveBeenCalled();
        expect(await openMarks16([mirror.subscription.id])).toEqual([]);
    });

    it('TEST:B11:4 (e) the sweep never sends a manifest probe tombstone to cancel nor marks it 16', async () => {
        const { fake, provider } = newFake();
        const h = harness(fake);
        const probe = await unknownCharge(fake);
        const { manifest } = parseProbeManifest({ input: { ids: [probe.authorizationId] } });
        const { result } = await handleCharge(probe, { provider, clock, probeManifest: manifest });
        if (result.outcome !== 'MARKED') throw new Error('Expected a probe tombstone');
        expect(result.cancellation).toBe('PROBE_SKIPPED');
        trackSeededReconciliationRow(result.subscriptionId);
        for (const day of [0, 1, 2, 3, 4]) await runDay(day, fake, h.beforeCancel);
        expect(calledWith(h.cancel, probe.authorizationId)).toBe(0);
        expect(await openMarks16([result.subscriptionId])).toEqual([]);
        expect(
            (await fake.readAuthorization({ authorizationId: probe.authorizationId })).snapshot
                .status
        ).toBe('active');
    });

    it('TEST:B11:6 (f) a read error on one row of the pass fails that row only', async () => {
        const { fake } = newFake();
        const h = harness(fake);
        const broken = await decided({ fake, status: 'ABANDONED', transition: 'S3' });
        const healthy = await decided({ fake, status: 'CHARGE_DECLINED', transition: 'S16' });
        h.read.mockImplementation(async (input) => {
            if (input.authorizationId === broken.providerId) throw new Error('read failed');
            return h.realRead(input);
        });
        const { summary } = await runDay(0, fake, h.beforeCancel);
        expect(summary.rowsFailed).toBe(1);
        expect(summary.complete).toBe(false);
        expect(summary.failures).toEqual([{ subscriptionId: broken.id, message: 'read failed' }]);
        expect(summary.cancellationRetry).toMatchObject({
            rowsFailed: 1,
            rowsRead: 1,
            callFailed: 1
        });
        expect(calledWith(h.cancel, healthy.providerId)).toBe(1);
        expect(calledWith(h.cancel, broken.providerId)).toBe(0);
    });

    it('TEST:B11:6 (g) without the cancellationRetry port the sweep does what it did before', async () => {
        const { fake } = newFake();
        const h = harness(fake);
        const terminal = await decided({ fake, status: 'CANCELLED', transition: 'S36' });
        const scheduled = await decided({ fake, status: 'CANCEL_SCHEDULED', transition: 'S11' });
        for (const day of [0, 3]) {
            const { summary } = await runDay(day, fake, null);
            expect(summary).not.toHaveProperty('cancellationRetry');
        }
        expect(h.cancel).not.toHaveBeenCalled();
        expect(await openMarks16([terminal.id, scheduled.id])).toEqual([]);
    });

    it('TEST:B11:6 (h) the Tourist VIP retry asks for the notice with its kind; an S3 retry asks without one', async () => {
        const { fake } = newFake();
        const h = harness(fake);
        const vip = await decided({
            fake,
            status: 'CANCELLED',
            vertical: 'tourist',
            transition: 'TOURIST_VIP_INHERITED'
        });
        const s3 = await decided({ fake, status: 'ABANDONED', transition: 'S3' });
        await runDay(0, fake, h.beforeCancel);
        const sentFor = (subscriptionId: string) =>
            h.beforeCancel.mock.calls
                .map(([input]) => input)
                .filter((input) => input.subscriptionId === subscriptionId);
        // toStrictEqual: no occurrenceId and, for S3, no kind key at all.
        expect(sentFor(vip.id)).toStrictEqual([
            { subscriptionId: vip.id, userId: vip.userId, kind: 'TOURIST_VIP_INHERITED' }
        ]);
        expect(sentFor(s3.id)).toStrictEqual([{ subscriptionId: s3.id, userId: s3.userId }]);
    });

    it('HOS-1545 TEST:B5:13 AC:B5:27 — an A5 retry on a terminal complement enqueues billing.addon-cancelled and no billing.before-cancel', async () => {
        // Arrange
        const { fake } = newFake();
        const h = harness(fake);
        const complement = await decided({
            fake,
            status: 'CANCELLED',
            class: 'COMPLEMENTO',
            transition: 'A5'
        });
        const notice = outboxBeforeCancelNotice();

        // Act
        await runDay(0, fake, notice.beforeCancel);

        // Assert
        const enqueued = await getServiceTestDb()
            .select({ template: emailOutbox.template, payload: emailOutbox.payload })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, complement.userId!));
        expect(enqueued).toStrictEqual([
            { template: 'billing.addon-cancelled', payload: { subscriptionId: complement.id } }
        ]);
        // The notice is not sent yet, so the retry defers the call.
        expect(calledWith(h.cancel, complement.providerId)).toBe(0);
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, complement.userId!));
    });
});
