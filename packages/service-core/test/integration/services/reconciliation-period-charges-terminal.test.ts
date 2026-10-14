import {
    domainEventModel,
    eq,
    payments,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedCancellationDecision,
    seedSubscription,
    trackSeededReconciliationRow,
    withSeededCancellationRetryInventory,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import {
    createChargingFake,
    handleCharge,
    unknownCharge
} from './reconciliation-tombstone-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];

function track(
    subscriptionId: string,
    userId: string | null,
    fallbackUserId?: string | null
): void {
    const ownerId = userId ?? fallbackUserId;
    if (!ownerId) throw new Error('Fixture has no user for mark cleanup');
    owned.push({ subscriptionId, userId: ownerId });
}

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        const marks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscriptionId }
        });
        for (const mark of marks) {
            await db
                .update(reconciliationMarkPayments)
                .set({ resolvedAt: new Date() })
                .where(eq(reconciliationMarkPayments.markId, mark.id));
            await reconciliationMarkModel.lift({
                markId: mark.id,
                expectedVersion: mark.version,
                liftedBy: row.userId,
                now: new Date()
            });
        }
        await db
            .update(payments)
            .set({ status: 'FAILED' })
            .where(eq(payments.subscriptionId, row.subscriptionId));
        const [subscription] = await db
            .select({ class: subscriptions.class })
            .from(subscriptions)
            .where(eq(subscriptions.id, row.subscriptionId));
        if (subscription?.class !== 'LAPIDA') {
            await db
                .delete(providerLinks)
                .where(eq(providerLinks.subscriptionId, row.subscriptionId));
            await db
                .update(subscriptions)
                .set({ status: 'ABANDONED' })
                .where(eq(subscriptions.id, row.subscriptionId));
        }
    }
});

describe('TEST:B11:9 AC:B11:10 terminal, cancellation-retry, and tombstone charge handling', () => {
    it.each([
        ['(d)', 'S12', 'COBRO_POSTERIOR_A_LA_BAJA'],
        ['(e)', 'S13', 'COBRO_POSTERIOR_AL_GRANT']
    ] as const)('TEST:B11:9 %s compares terminal rows in the cancellation retry pass', async (_case, transition, reason) => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock,
            honestAbout: [
                { lie: 'M8', why: 'terminal comparison requires an immediately approved charge' }
            ]
        });
        const seeded = await seedSubscription({ status: 'CANCELLED', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        await fake.charge({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: seeded.subscription.id
        });
        await fake.cancel({ authorizationId: seeded.providerId! });
        await seedCancellationDecision({
            subscriptionId: seeded.subscription.id,
            transition,
            decidedAt: reconciliationClock.now()
        });
        const summary = await withSeededReconciliationInventory(() =>
            withSeededCancellationRetryInventory(() =>
                runReconciliationSweep(
                    {},
                    {
                        provider: fake as unknown as PaymentProvider,
                        clock: reconciliationClock,
                        cancellationRetry: { beforeCancelNotice: outboxBeforeCancelNotice() },
                        markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                        comparisons: [
                            createPeriodChargesComparison({
                                provider: fake as unknown as PaymentProvider
                            })
                        ]
                    }
                )
            )
        );
        expect(summary).toMatchObject({ divergences: 1, marksOpened: 1, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
            })
        ).toMatchObject([{ reason }]);
        expect(
            await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.subscriptionId, seeded.subscription.id))
        ).toEqual([]);
    });

    it('TEST:B11:9 (g) compares live CANCEL_SCHEDULED once before its cancellation retry', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock,
            honestAbout: [
                { lie: 'M8', why: 'S11 comparison requires an immediately approved charge' }
            ]
        });
        const prior = await seedSubscription({ status: 'CANCEL_SCHEDULED', withLink: true, fake });
        const later = await seedSubscription({ status: 'CANCEL_SCHEDULED', withLink: true, fake });
        track(prior.subscription.id, prior.subscription.userId);
        track(later.subscription.id, later.subscription.userId);
        const priorCharge = await fake.charge({
            authorizationId: prior.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: prior.subscription.id
        });
        const laterCharge = await fake.charge({
            authorizationId: later.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: later.subscription.id
        });
        const now = reconciliationClock.now().getTime();
        await seedCancellationDecision({
            subscriptionId: prior.subscription.id,
            transition: 'S11',
            decidedAt: new Date(now + 60_000)
        });
        await seedCancellationDecision({
            subscriptionId: later.subscription.id,
            transition: 'S11',
            decidedAt: new Date(now - 60_000)
        });
        const correlationId = crypto.randomUUID();
        const summary = await withSeededReconciliationInventory(() =>
            withSeededCancellationRetryInventory(() =>
                runReconciliationSweep(
                    { correlationId },
                    {
                        provider: fake as unknown as PaymentProvider,
                        clock: reconciliationClock,
                        cancellationRetry: { beforeCancelNotice: outboxBeforeCancelNotice() },
                        markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                        comparisons: [
                            createPeriodChargesComparison({
                                provider: fake as unknown as PaymentProvider
                            })
                        ]
                    }
                )
            )
        );
        expect(summary).toMatchObject({
            divergences: 2,
            marksOpened: 2,
            marksAccumulated: 0,
            rowsFailed: 0
        });
        const events = (await domainEventModel.findByCorrelationId({ correlationId })).filter(
            (event) => event.eventType === 'reconciliation.mark_opened'
        );
        expect(events).toHaveLength(2);
        const chargeIds = events
            .flatMap((event) => event.changes)
            .filter((change) => change.field === 'provider.charge_id')
            .map((change) => change.new);
        expect(new Set(chargeIds)).toEqual(new Set([priorCharge.chargeId, laterCharge.chargeId]));
        expect(
            await reconciliationMarkModel.findOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: prior.subscription.id },
                reason: 'COBRO_SIN_REGISTRAR'
            })
        ).not.toBeNull();
        expect(
            await reconciliationMarkModel.findOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: later.subscription.id },
                reason: 'COBRO_POSTERIOR_A_LA_BAJA'
            })
        ).not.toBeNull();
    });

    it('TEST:B11:9 (i) applies the late-payment conditions to SUSPENDED rows', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock,
            honestAbout: [
                { lie: 'M8', why: 'SUSPENDED late-payment conditions need approved charges' }
            ]
        });
        const eligible = await seedSubscription({ status: 'SUSPENDED', withLink: true, fake });
        const ineligible = await seedSubscription({ status: 'SUSPENDED', withLink: true, fake });
        const liveSibling = await seedSubscription({ status: 'ACTIVE' });
        const predecessor = await seedSubscription({ status: 'ABANDONED' });
        track(eligible.subscription.id, eligible.subscription.userId);
        track(ineligible.subscription.id, ineligible.subscription.userId);
        track(liveSibling.subscription.id, liveSibling.subscription.userId);
        track(predecessor.subscription.id, predecessor.subscription.userId);
        if (!eligible.subscription.userId || !ineligible.subscription.userId) {
            throw new Error('Fixture subscription has no user');
        }
        await getServiceTestDb()
            .update(subscriptions)
            .set({
                userId: ineligible.subscription.userId,
                succeedsId: predecessor.subscription.id
            })
            .where(eq(subscriptions.id, liveSibling.subscription.id));
        await getServiceTestDb()
            .update(subscriptions)
            .set({
                userId: ineligible.subscription.userId,
                succeededById: liveSibling.subscription.id
            })
            .where(eq(subscriptions.id, predecessor.subscription.id));
        for (const row of [eligible, ineligible]) {
            await getServiceTestDb()
                .update(subscriptions)
                .set({
                    graceStartedAt: new Date('2026-10-01T00:00:00.000Z'),
                    graceEndsAt: new Date('2026-10-30T00:00:00.000Z')
                })
                .where(eq(subscriptions.id, row.subscription.id));
            await fake.charge({
                authorizationId: row.providerId!,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: row.subscription.id
            });
        }
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {},
                {
                    provider: fake as unknown as PaymentProvider,
                    clock: reconciliationClock,
                    comparisons: [
                        createPeriodChargesComparison({
                            provider: fake as unknown as PaymentProvider
                        })
                    ]
                }
            )
        );
        expect(summary).toMatchObject({ divergences: 2, marksOpened: 2, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.findOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: eligible.subscription.id },
                reason: 'COBRO_SIN_REGISTRAR'
            })
        ).not.toBeNull();
        expect(
            await reconciliationMarkModel.findOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: ineligible.subscription.id },
                reason: 'PAGO_TARDIO_RECHAZADO'
            })
        ).not.toBeNull();
    });

    it('TEST:B11:9 (l) skips reversed money, both charged back and refunded in full', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock,
            honestAbout: [{ lie: 'M8', why: 'test approved charges with reversed money' }]
        });
        const chargedBack = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const refunded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        track(chargedBack.subscription.id, chargedBack.subscription.userId);
        track(refunded.subscription.id, refunded.subscription.userId);
        const first = await fake.charge({
            authorizationId: chargedBack.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: chargedBack.subscription.id
        });
        const second = await fake.charge({
            authorizationId: refunded.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: refunded.subscription.id
        });
        await fake.chargeBack({ chargeId: first.chargeId });
        await fake.refund({
            chargeId: second.chargeId,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: `external-${second.chargeId}`
        });
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {},
                {
                    provider: fake as unknown as PaymentProvider,
                    clock: reconciliationClock,
                    comparisons: [
                        createPeriodChargesComparison({
                            provider: fake as unknown as PaymentProvider
                        })
                    ]
                }
            )
        );
        expect(summary).toMatchObject({ divergences: 0, rowsFailed: 0 });
        for (const row of [chargedBack, refunded]) {
            expect(
                await reconciliationMarkModel.listOpen({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id }
                })
            ).toEqual([]);
        }
    });

    it('TEST:B11:9 (f) accumulates reason 7 on a receipt tombstone with the second charge detail', async () => {
        const { fake, provider } = createChargingFake();
        const cleanupActor = await seedSubscription({ status: 'ABANDONED' });
        track(cleanupActor.subscription.id, cleanupActor.subscription.userId);
        const first = await unknownCharge(fake);
        const second = await fake.charge({
            authorizationId: first.authorizationId,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: `second-${crypto.randomUUID()}`
        });
        const handled = await handleCharge(
            { authorizationId: first.authorizationId, chargeId: first.chargeId },
            { provider, markPayments: createPaymentReconciliationMarkPayments(reconciliationClock) }
        );
        if (handled.result.outcome !== 'MARKED') throw new Error('Expected a receipt tombstone');
        expect(handled.result).toMatchObject({ reason: 'PAGO_TARDIO_RECHAZADO', tombstone: true });
        trackSeededReconciliationRow(handled.result.subscriptionId);
        track(handled.result.subscriptionId, null, cleanupActor.subscription.userId);
        const correlationId = crypto.randomUUID();
        const summary = await withSeededReconciliationInventory(() =>
            withSeededCancellationRetryInventory(() =>
                runReconciliationSweep(
                    { correlationId },
                    {
                        provider,
                        clock: reconciliationClock,
                        cancellationRetry: { beforeCancelNotice: outboxBeforeCancelNotice() },
                        markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                        comparisons: [createPeriodChargesComparison({ provider })]
                    }
                )
            )
        );
        expect(summary).toMatchObject({
            divergences: 1,
            marksOpened: 0,
            marksAccumulated: 1,
            rowsFailed: 0
        });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: handled.result.subscriptionId }
            })
        ).toMatchObject([{ reason: 'PAGO_TARDIO_RECHAZADO' }]);
        expect(
            await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, second.chargeId))
        ).toEqual([]);
        const events = (await domainEventModel.findByCorrelationId({ correlationId })).filter(
            (event) => event.eventType === 'reconciliation.mark_opened'
        );
        expect(events).toHaveLength(1);
        expect(
            events[0]?.changes.some(
                (change) => change.field === 'provider.charge_id' && change.new === second.chargeId
            )
        ).toBe(true);
    });
});
