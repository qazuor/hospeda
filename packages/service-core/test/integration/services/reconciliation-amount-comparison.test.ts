import type { Clock } from '@repo/billing-verticals-contract';
import {
    coveredPeriods,
    domainEventModel,
    eq,
    payments,
    promoCodes,
    promoRedemptions,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { createAmountComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison.js';
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
import { seedDifferentScheduledAmount } from './support/period-comparison-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];
const promoCodeIds: string[] = [];

function track(subscriptionId: string, userId: string | null): void {
    if (!userId) throw new Error('Fixture subscription has no user');
    owned.push({ subscriptionId, userId });
}

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        await db
            .delete(subscriptionScheduledChanges)
            .where(eq(subscriptionScheduledChanges.subscriptionId, row.subscriptionId));
        await db
            .delete(promoRedemptions)
            .where(eq(promoRedemptions.subscriptionId, row.subscriptionId));
        for (const mark of await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscriptionId }
        })) {
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
        await db
            .delete(coveredPeriods)
            .where(eq(coveredPeriods.subscriptionId, row.subscriptionId));
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
    for (const codeId of promoCodeIds.splice(0))
        await db.delete(promoCodes).where(eq(promoCodes.id, codeId));
});

function adjustableClock() {
    const start = reconciliationClock.now().getTime();
    let offset = 0;
    const clock = { now: () => new Date(start + offset) } satisfies Clock;
    return {
        clock,
        advance: (days: number) => {
            offset += days * 86_400_000;
        }
    };
}

async function sweep(input: {
    readonly fake: PaymentProvider;
    readonly clock: Clock;
    readonly subscriptionId: string;
    readonly correlationId?: string;
    readonly mutations?: {
        findLatest(args: { readonly subscriptionId: string }): Promise<{
            readonly transition: 'S30' | 'S37' | 'S10';
            readonly decidedAt: Date;
        } | null>;
    };
}) {
    return withSeededReconciliationInventory(() =>
        runReconciliationSweep(
            { ...(input.correlationId ? { correlationId: input.correlationId } : {}) },
            {
                provider: input.fake,
                clock: input.clock,
                comparisons: [
                    createAmountComparison({
                        provider: input.fake,
                        clock: input.clock,
                        ...(input.mutations ? { mutations: input.mutations } : {})
                    })
                ],
                markPayments: createPaymentReconciliationMarkPayments(input.clock)
            }
        )
    );
}

describe('TEST:B11:8 AC:B11:9 the amount comparison: a divergence appears without any notice (M5)', () => {
    it('(a) opens MOT:5 immediately for an outside amount change without a notice or a local write', async () => {
        const { clock } = adjustableClock();
        const fake = new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock });
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        const before = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscription.id));
        fake.takeDeliveries();
        const change = vi.spyOn(fake, 'changeAmount');
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 300000, currency: 'ARS' }
        });
        const correlationId = crypto.randomUUID();
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                {
                    provider: fake,
                    clock,
                    comparisons: [createAmountComparison({ provider: fake, clock })],
                    markPayments: createPaymentReconciliationMarkPayments(clock)
                }
            )
        );
        expect(summary).toMatchObject({ divergences: 1, marksOpened: 1, rowsFailed: 0 });
        expect(change).toHaveBeenCalledTimes(1);
        expect(
            (await fake.takeDeliveries()).deliveries.some((delivery) =>
                delivery.body.includes(seeded.providerId!)
            )
        ).toBe(false);
        expect(
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscription.id))
        ).toEqual(before);
        const event = (await domainEventModel.findByCorrelationId({ correlationId })).find(
            (item) => item.eventType === 'reconciliation.mark_opened'
        );
        expect(event?.changes).toEqual(
            expect.arrayContaining([
                { field: 'reconciliation_mark.expected_minor', new: 250000 },
                { field: 'provider.authorization_amount_minor', new: 300000 }
            ])
        );
    });

    it('(d) skips PAUSED rows even when their authorization amount differs', async () => {
        const adjustable = adjustableClock();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: adjustable.clock
        });
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 300000, currency: 'ARS' }
        });
        await fake.pause({ authorizationId: seeded.providerId! });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'PAUSED' })
            .where(eq(subscriptions.id, seeded.subscription.id));
        expect(
            await sweep({ fake, clock: adjustable.clock, subscriptionId: seeded.subscription.id })
        ).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
    });

    it('(h) fails visibly for a live redemption instead of comparing list price', async () => {
        const { fake } = {
            fake: new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: reconciliationClock
            })
        };
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        const [user] = await getServiceTestDb()
            .select({ userId: subscriptions.userId })
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscription.id));
        const [code] = await getServiceTestDb()
            .insert(promoCodes)
            .values({
                code: `AMOUNT-${crypto.randomUUID()}`,
                discountKind: 'FIXED',
                value: 5000,
                allVerticals: true,
                verticals: null,
                totalQuota: 5,
                validFrom: new Date('2026-01-01T00:00:00.000Z'),
                validUntil: new Date('2027-01-01T00:00:00.000Z'),
                stackable: false,
                usableWithAnotherActive: false,
                durationKind: 'N_CHARGES',
                durationCharges: 2
            })
            .returning();
        if (!code || !user?.userId) throw new Error('Promo fixture failed');
        promoCodeIds.push(code.id);
        await getServiceTestDb().insert(promoRedemptions).values({
            promoCodeId: code.id,
            userId: user.userId,
            redeemedAt: reconciliationClock.now(),
            subscriptionId: seeded.subscription.id,
            remainingCharges: 2
        });
        const summary = await sweep({
            fake,
            clock: reconciliationClock,
            subscriptionId: seeded.subscription.id
        });
        expect(summary).toMatchObject({ rowsFailed: 1, marksOpened: 0, pinged: false });
        expect(summary.failures[0]?.message).toContain(
            'Expected amount needs the promo composition of B9b'
        );
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
            })
        ).toEqual([]);
    });

    it('(f) skips a CANCEL_SCHEDULED row whose authorization was cancelled after S11', async () => {
        const { fake } = {
            fake: new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: reconciliationClock
            })
        };
        const seeded = await seedSubscription({ status: 'CANCEL_SCHEDULED', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 350000, currency: 'ARS' }
        });
        await fake.cancel({ authorizationId: seeded.providerId! });
        await seedCancellationDecision({
            subscriptionId: seeded.subscription.id,
            transition: 'S11',
            decidedAt: reconciliationClock.now()
        });
        expect(
            await sweep({
                fake,
                clock: reconciliationClock,
                subscriptionId: seeded.subscription.id
            })
        ).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
            })
        ).toEqual([]);
    });

    it('(g) expects the scheduled destination amount before S38', async () => {
        const { fake } = {
            fake: new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: reconciliationClock
            })
        };
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        await seedDifferentScheduledAmount({
            subscriptionId: seeded.subscription.id,
            effectiveAt: new Date('2026-11-01T00:00:00.000Z')
        });
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 350000, currency: 'ARS' }
        });
        expect(
            await sweep({
                fake,
                clock: reconciliationClock,
                subscriptionId: seeded.subscription.id
            })
        ).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' }
        });
        const correlationId = crypto.randomUUID();
        expect(
            await sweep({
                fake,
                clock: reconciliationClock,
                subscriptionId: seeded.subscription.id,
                correlationId
            })
        ).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
        const open = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
        });
        expect(open).toMatchObject([{ reason: 'DIVERGENCIA_DE_MONTO' }]);
        const event = (await domainEventModel.findByCorrelationId({ correlationId })).find(
            (item) => item.eventType === 'reconciliation.mark_opened'
        );
        expect(event?.changes).toContainEqual({
            field: 'reconciliation_mark.expected_minor',
            new: 350000
        });
    });

    it('(i) treats a COMPLEMENTO as not comparable', async () => {
        const { fake } = {
            fake: new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: reconciliationClock
            })
        };
        const seeded = await seedSubscription({
            status: 'ACTIVE',
            class: 'COMPLEMENTO',
            withLink: true,
            fake
        });
        track(seeded.subscription.id, seeded.subscription.userId);
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 350000, currency: 'ARS' }
        });
        expect(
            await sweep({
                fake,
                clock: reconciliationClock,
                subscriptionId: seeded.subscription.id
            })
        ).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
    });

    it('(e) skips a receipt tombstone in the cancellation retry comparison pass', async () => {
        const { fake, provider } = createChargingFake();
        const cleanupActor = await seedSubscription({ status: 'ABANDONED' });
        track(cleanupActor.subscription.id, cleanupActor.subscription.userId);
        const terminal = await seedSubscription({ status: 'ABANDONED', withLink: true, fake });
        track(terminal.subscription.id, terminal.subscription.userId);
        await fake.changeAmount({
            authorizationId: terminal.providerId!,
            amount: { amountMinor: 350000, currency: 'ARS' }
        });
        await seedCancellationDecision({
            subscriptionId: terminal.subscription.id,
            transition: 'S3',
            decidedAt: reconciliationClock.now()
        });
        const debit = await unknownCharge(fake);
        const handled = await handleCharge(
            { authorizationId: debit.authorizationId, chargeId: debit.chargeId },
            { provider }
        );
        if (handled.result.outcome !== 'MARKED') throw new Error('Expected a receipt tombstone');
        trackSeededReconciliationRow(handled.result.subscriptionId);
        track(handled.result.subscriptionId, cleanupActor.subscription.userId);
        const summary = await withSeededCancellationRetryInventory(() =>
            runReconciliationSweep(
                {},
                {
                    provider,
                    clock: reconciliationClock,
                    cancellationRetry: {
                        beforeCancelNotice: { beforeCancel: async () => 'NO_RECIPIENT' }
                    },
                    markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                    comparisons: [createAmountComparison({ provider, clock: reconciliationClock })]
                }
            )
        );
        expect(summary.rowsFailed).toBe(0);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: handled.result.subscriptionId }
            })
        ).toMatchObject([{ reason: 'PAGO_TARDIO_RECHAZADO' }]);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: handled.result.subscriptionId }
            })
        ).not.toContainEqual(expect.objectContaining({ reason: 'DIVERGENCIA_DE_MONTO' }));
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: terminal.subscription.id }
            })
        ).toEqual([]);
    });
});
