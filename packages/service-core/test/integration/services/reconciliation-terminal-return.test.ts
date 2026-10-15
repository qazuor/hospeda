/** TEST:B11:14 — AC:B11:15: terminal rows stay swept until their marks, retention or last record closes. */
import {
    and,
    domainEvent,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    providerLinks,
    reconciliationMarks,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import { createStateComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/state-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    resetSeededReconciliationInventory,
    seedCancellationDecision,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { seedRetainedPayment } from './reconciliation-zero-call-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    resetSeededTerminalReturnInventory,
    seedTerminalRow,
    withSeededTerminalReturnInventory
} from './support/terminal-return-fixtures.js';

const DAY = 86_400_000;
const T0 = new Date('2026-11-01T10:00:00.000Z');
let current = new Date(T0);
const clock = { now: () => new Date(current) };
const ids = new Set<string>();

beforeAll(() => getServiceTestDb());
afterAll(closeServiceTestPool);
beforeEach(() => {
    current = new Date(T0);
    ids.clear();
    resetSeededReconciliationInventory();
    resetSeededTerminalReturnInventory();
    vi.restoreAllMocks();
});
afterEach(async () => {
    const db = getServiceTestDb();
    const owned = [...ids];
    if (owned.length === 0) return;
    const rows = await db
        .select({ id: subscriptions.id, userId: subscriptions.userId })
        .from(subscriptions)
        .where(inArray(subscriptions.id, owned));
    const userIds = [
        ...new Set(rows.map(({ userId }) => userId).filter((id): id is string => id !== null))
    ];
    await db
        .delete(successionRetainedPayments)
        .where(inArray(successionRetainedPayments.subscriptionId, owned));
    await db.delete(payments).where(inArray(payments.subscriptionId, owned));
    for (const row of rows)
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: row.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, row.id),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
    await db.delete(providerLinks).where(inArray(providerLinks.subscriptionId, owned));
    await db
        .update(subscriptions)
        .set({ status: 'CANCELLED' })
        .where(inArray(subscriptions.id, owned));
    if (userIds.length > 0)
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, userIds));
});

function newFake(honest = false) {
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        ...(honest
            ? { honestAbout: [{ lie: 'M8', why: 'settle this seeded approval before the sweep' }] }
            : {})
    });
    return { fake, provider: fake as unknown as PaymentProvider };
}

async function sweep(fake: FakePaymentProvider) {
    const beforeCancelNotice = outboxBeforeCancelNotice({ deliver: true });
    return withSeededReconciliationInventory(() =>
        withSeededCancellationRetryInventory(() =>
            withSeededTerminalReturnInventory(() =>
                runReconciliationSweep(
                    { correlationId: crypto.randomUUID() },
                    {
                        provider: fake as unknown as PaymentProvider,
                        clock,
                        comparisons: [
                            createStateComparison(),
                            createPeriodChargesComparison({
                                provider: fake as unknown as PaymentProvider
                            })
                        ],
                        markPayments: createPaymentReconciliationMarkPayments(clock),
                        cancellationRetry: { beforeCancelNotice },
                        terminalReturn: { beforeCancelNotice },
                        cancellationSeen: providerLinkCancellationSeen,
                        livenessPing: { ping: vi.fn() }
                    }
                )
            )
        )
    );
}

async function closeRow(input: {
    fake: FakePaymentProvider;
    id: string;
    providerId: string;
    seenAt?: Date;
    preserveSubscriptionStatus?: boolean;
}) {
    await input.fake.cancel({ authorizationId: input.providerId });
    if (!input.preserveSubscriptionStatus)
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(eq(subscriptions.id, input.id));
    if (input.seenAt)
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: input.seenAt })
            .where(eq(providerLinks.subscriptionId, input.id));
}

async function openReasons(subscriptionId: string) {
    const rows = await getServiceTestDb()
        .select({ reason: reconciliationMarks.reason })
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
    return rows.map(({ reason }) => reason).sort();
}

describe('TEST:B11:14 terminal return and exemption', () => {
    it('TEST:B11:14 (a) keeps comparing an open mark row and accumulates one charge mark', async () => {
        const { fake } = newFake(true);
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(row.subscription.id);
        await fake.charge({
            authorizationId: row.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: row.subscription.id
        });
        await closeRow({ fake, id: row.subscription.id, providerId: row.providerId! });
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'provider' },
            correlationId: crypto.randomUUID()
        });
        const read = vi.spyOn(fake, 'readAuthorization');
        const first = await sweep(fake);
        expect(first.terminalReturn?.stayed.OPEN_MARK).toBe(1);
        expect(read.mock.calls.some(([arg]) => arg.authorizationId === row.providerId)).toBe(true);
        expect(first.rowsFailed).toBe(0);
        expect(
            await getServiceTestDb()
                .select()
                .from(domainEvent)
                .where(
                    and(
                        eq(domainEvent.entityId, row.subscription.id),
                        eq(domainEvent.eventType, 'reconciliation.mark_opened')
                    )
                )
        ).toHaveLength(2);
        expect(
            (
                await getServiceTestDb()
                    .select({ at: providerLinks.cancelledSeenAt })
                    .from(providerLinks)
                    .where(eq(providerLinks.subscriptionId, row.subscription.id))
            )[0]?.at
        ).toBeInstanceOf(Date);
        await sweep(fake);
        expect(
            (await openReasons(row.subscription.id)).filter(
                (reason) => reason === 'COBRO_POSTERIOR_A_LA_BAJA'
            )
        ).toHaveLength(1);
    });

    it('TEST:B11:14 (b) keeps a terminal row with an open S19 retention', async () => {
        const { fake } = newFake();
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(row.subscription.id);
        const payment = await seedRetainedPayment(row.subscription.id);
        await getServiceTestDb().insert(successionRetainedPayments).values({
            subscriptionId: row.subscription.id,
            paymentId: payment.id,
            unpaidSince: T0
        });
        await closeRow({ fake, id: row.subscription.id, providerId: row.providerId!, seenAt: T0 });
        const read = vi.spyOn(fake, 'readAuthorization');
        const summary = await sweep(fake);
        expect(summary.terminalReturn?.stayed.OPEN_RETENTION).toBe(1);
        expect(read.mock.calls.some(([arg]) => arg.authorizationId === row.providerId)).toBe(true);
    });

    it('TEST:B11:14 (c) keeps recycling until expiry and makes one last comparison before exemption', async () => {
        const { fake } = newFake(true);
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(row.subscription.id);
        current = new Date(T0.getTime() - 10 * DAY);
        const approved = await fake.charge({
            authorizationId: row.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: row.subscription.id
        });
        await getServiceTestDb()
            .insert(payments)
            .values({
                subscriptionId: row.subscription.id,
                amount: 250000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'MERCADO_PAGO',
                providerFactId: approved.chargeId,
                factAt: new Date(current)
            });
        await fake.failChargeCycle({
            authorizationId: row.providerId!,
            declineReason: 'test decline'
        });
        current = new Date(T0);
        await closeRow({ fake, id: row.subscription.id, providerId: row.providerId!, seenAt: T0 });
        const first = await sweep(fake);
        expect(first.terminalReturn).toMatchObject({ exempt: 0, stayed: { RECORD_OPEN: 1 } });
        const listed = await fake
            .listCharges({ authorizationId: row.providerId! })
            .then(({ chargeIds }) =>
                Promise.all(chargeIds.map((chargeId) => fake.readCharge({ chargeId })))
            );
        const rejected = listed.find(({ snapshot }) => snapshot.status === 'rejected');
        const expiresAt = rejected?.snapshot.expiresAt;
        if (!expiresAt) throw new Error('The seeded rejection has no expiry');
        current = new Date(Date.parse(expiresAt) + 1);
        const comparisons = vi.fn();
        const second = await withSeededReconciliationInventory(() =>
            withSeededCancellationRetryInventory(() =>
                withSeededTerminalReturnInventory(() =>
                    runReconciliationSweep(
                        {},
                        {
                            provider: fake as unknown as PaymentProvider,
                            clock,
                            comparisons: [
                                async (input) => {
                                    comparisons();
                                    return createStateComparison()(input);
                                },
                                createPeriodChargesComparison({
                                    provider: fake as unknown as PaymentProvider
                                })
                            ],
                            cancellationRetry: { beforeCancelNotice: outboxBeforeCancelNotice() },
                            terminalReturn: { beforeCancelNotice: outboxBeforeCancelNotice() },
                            cancellationSeen: providerLinkCancellationSeen
                        }
                    )
                )
            )
        );
        expect(second.terminalReturn?.exempt).toBe(1);
        expect(comparisons).toHaveBeenCalled();
        current = new Date(T0.getTime() + 32 * DAY);
        const read = vi.spyOn(fake, 'readAuthorization');
        const third = await sweep(fake);
        expect(third.terminalReturn?.rowsRead).toBe(0);
        expect(read).not.toHaveBeenCalled();
    });

    it('TEST:B11:14 (e) observes the seven-day rejection window, then exempts a closed record', async () => {
        const { fake } = newFake();
        const row = await seedTerminalRow({ status: 'CHARGE_DECLINED', fake });
        ids.add(row.subscription.id);
        await closeRow({
            fake,
            id: row.subscription.id,
            providerId: row.providerId!,
            seenAt: T0,
            preserveSubscriptionStatus: true
        });
        current = new Date(T0.getTime() + 3 * DAY);
        expect((await sweep(fake)).terminalReturn?.stayed.REJECTION_WINDOW).toBe(1);
        current = new Date(T0.getTime() + 8 * DAY);
        const cancel = vi.spyOn(fake, 'cancel');
        expect((await sweep(fake)).terminalReturn?.exempt).toBe(1);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('TEST:B11:14 (f) excludes a terminal whose cycle cutoff elapsed', async () => {
        const { fake } = newFake();
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(row.subscription.id);
        await closeRow({
            fake,
            id: row.subscription.id,
            providerId: row.providerId!,
            seenAt: new Date(T0.getTime() - 40 * DAY)
        });
        const read = vi.spyOn(fake, 'readAuthorization');
        expect((await sweep(fake)).terminalReturn?.rowsRead).toBe(0);
        expect(read).not.toHaveBeenCalled();
    });

    it('TEST:B11:14 (g) partitions retry rows and terminal return rows without duplicate reads', async () => {
        const { fake } = newFake();
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(row.subscription.id);
        await seedCancellationDecision({
            subscriptionId: row.subscription.id,
            transition: 'S12',
            decidedAt: T0
        });
        const cancel = vi
            .spyOn(fake, 'cancel')
            .mockRejectedValueOnce(new Error('provider timeout'));
        const read = vi.spyOn(fake, 'readAuthorization');
        await sweep(fake);
        expect(
            read.mock.calls.filter(([arg]) => arg.authorizationId === row.providerId)
        ).toHaveLength(1);

        const confirmed = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(confirmed.subscription.id);
        await seedCancellationDecision({
            subscriptionId: confirmed.subscription.id,
            transition: 'S12',
            decidedAt: T0
        });
        await closeRow({
            fake,
            id: confirmed.subscription.id,
            providerId: confirmed.providerId!,
            seenAt: T0
        });
        read.mockClear();
        await sweep(fake);
        expect(
            read.mock.calls.filter(([arg]) => arg.authorizationId === confirmed.providerId)
        ).toHaveLength(1);

        const seen = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(seen.subscription.id);
        await seedCancellationDecision({
            subscriptionId: seen.subscription.id,
            transition: 'S12',
            decidedAt: T0
        });
        await getServiceTestDb()
            .update(providerLinks)
            .set({ cancelledSeenAt: T0 })
            .where(eq(providerLinks.subscriptionId, seen.subscription.id));
        read.mockClear();
        await sweep(fake);
        expect(
            read.mock.calls.filter(([arg]) => arg.authorizationId === seen.providerId)
        ).toHaveLength(3);

        const marked = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(marked.subscription.id);
        await seedCancellationDecision({
            subscriptionId: marked.subscription.id,
            transition: 'S12',
            decidedAt: T0
        });
        await closeRow({ fake, id: marked.subscription.id, providerId: marked.providerId! });
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: marked.subscription.id },
            reason: 'CANCELACION_SIN_CONFIRMAR',
            actor: { type: 'job' },
            correlationId: crypto.randomUUID()
        });
        read.mockClear();
        cancel.mockClear();
        await sweep(fake);
        expect(
            read.mock.calls.filter(([arg]) => arg.authorizationId === marked.providerId)
        ).toHaveLength(1);
        expect(
            cancel.mock.calls.filter(([arg]) => arg.authorizationId === marked.providerId)
        ).toHaveLength(0);
    });

    it('TEST:B11:14 (h) marks a live common cancellation for a person without calling cancel', async () => {
        const { fake } = newFake();
        const row = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(row.subscription.id);
        await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id },
            reason: 'TRANSICION_NO_DECLARADA',
            actor: { type: 'provider' },
            correlationId: crypto.randomUUID()
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const summary = await sweep(fake);
        expect(summary.terminalReturn?.stayed).toMatchObject({
            OPEN_MARK: 1,
            PREAPPROVAL_ALIVE: 0
        });
        expect(summary.terminalReturn?.handled.divergenceMarked).toBe(1);
        expect(await openReasons(row.subscription.id)).toContain('TRANSICION_NO_DECLARADA');
        expect(cancel).not.toHaveBeenCalled();
    });

    it('TEST:B11:14 (i) counts a failed authorization reread and continues other rows', async () => {
        const { fake } = newFake();
        const failed = await seedTerminalRow({ status: 'CANCELLED', fake });
        const healthy = await seedTerminalRow({ status: 'CANCELLED', fake });
        ids.add(failed.subscription.id);
        ids.add(healthy.subscription.id);
        await closeRow({
            fake,
            id: failed.subscription.id,
            providerId: failed.providerId!,
            seenAt: T0
        });
        await closeRow({
            fake,
            id: healthy.subscription.id,
            providerId: healthy.providerId!,
            seenAt: T0
        });
        const realRead = fake.readAuthorization.bind(fake);
        const read = vi.spyOn(fake, 'readAuthorization').mockImplementation(async (input) => {
            if (input.authorizationId === failed.providerId) throw new Error('failed read');
            return realRead(input);
        });
        const summary = await sweep(fake);
        expect(summary).toMatchObject({ rowsFailed: 1, complete: false, pinged: false });
        expect(summary.terminalReturn?.rowsFailed).toBe(1);
        expect(summary.failures).toContainEqual({
            subscriptionId: failed.subscription.id,
            message: 'Terminal return row failed'
        });
        expect(read.mock.calls.some(([arg]) => arg.authorizationId === healthy.providerId)).toBe(
            true
        );
    });
});
