import { eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordProviderCancellationDecided } from '../../../src/services/billing/reconciliation/provider-cancellation-decision.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { cancelDirectSubscription } from '../../../src/services/billing/subscription/cancel-direct-subscription.service.js';
import { applyS12ToPrincipal } from '../../../src/services/billing/subscription/service-end-s12.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import { cancelActiveNow, unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    chargeOn,
    crossingClock,
    hungPaymentsOf,
    markOpenedEvents,
    marksOf,
    openMarksOf,
    paymentsForSubscription,
    recordOn,
    refundsOfPayment,
    retireCancelCrossingRows,
    seedCrossingActive,
    seedCrossingDirect
} from './support/cancel-crossing-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const crossing = (result: Awaited<ReturnType<typeof recordOn>>) => {
    if (result.outcome !== 'CREDITED')
        throw new Error(`Expected credited payment, received ${result.outcome}`);
    return result.crossing;
};
const owner = (id: string) => ({
    id,
    roles: [],
    permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
});
const orphanhood = {
    addonPolicy: async () => {
        throw new Error('unexpected addon policy');
    },
    listing: async () => {
        throw new Error('unexpected addon listing');
    }
};
afterEach(retireCancelCrossingRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8a:11 / TEST:1571 cancellation crossing',
    () => {
        it('TEST:B8a:11 (a), TEST:1571:3 (f): accumulates two post-S11 charges on one mark; replay is idempotent', async () => {
            const { clock, setNow } = crossingClock(cancelActiveNow);
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'TEST:B8a:11 reads charges approved at once' }]
            });
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    complements: unusedComplementPolicy,
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            const [before] = await getServiceTestDb()
                .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            const ids: string[] = [];
            const results = [];
            for (const hours of [1, 2]) {
                const charge = await chargeOn({
                    fake,
                    authorizationId: seeded.authorizationId,
                    at: new Date(cancelActiveNow.getTime() + hours * 3600000),
                    setNow,
                    reference: seeded.subscriptionId
                });
                ids.push(charge.chargeId);
                results.push(await recordOn({ fake, chargeId: charge.chargeId, clock }));
            }
            expect(results.map(crossing)).toMatchObject([
                { outcome: 'MARKED', markOutcome: 'OPENED', transition: 'S11' },
                { outcome: 'MARKED', markOutcome: 'ACCUMULATED', transition: 'S11' }
            ]);
            expect((crossing(results[0]!) as { markId: string }).markId).toBe(
                (crossing(results[1]!) as { markId: string }).markId
            );
            const [after] = await getServiceTestDb()
                .select({
                    status: subscriptions.status,
                    serviceEndsAt: subscriptions.serviceEndsAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(after).toEqual({
                status: 'CANCEL_SCHEDULED',
                serviceEndsAt: before?.serviceEndsAt
            });
            const marks = await openMarksOf(seeded.subscriptionId);
            expect(
                marks.filter((mark) => mark.reason === 'COBRO_POSTERIOR_A_LA_BAJA')
            ).toHaveLength(1);
            expect(await hungPaymentsOf(marks[0]!.id)).toHaveLength(2);
            const paymentRows = await paymentsForSubscription(seeded.subscriptionId);
            for (const id of ids) {
                const payment = paymentRows.find((row) => row.providerFactId === id)!;
                expect(await refundsOfPayment(payment.id)).toHaveLength(0);
            }
            const replay = await recordOn({ fake, chargeId: ids[0]!, clock });
            expect(replay).toMatchObject({ credit: { outcome: 'ALREADY_CREDITED' } });
            expect(crossing(replay)).toMatchObject({ outcome: 'ALREADY_MARKED' });
            expect(await markOpenedEvents(seeded.subscriptionId)).toHaveLength(2);
            expect(await hungPaymentsOf(marks[0]!.id)).toHaveLength(2);
        });

        it.each([
            ['SUSPENDED', 'S23'],
            ['GRACE_PERIOD', 'S24']
        ] as const)('TEST:B8a:11 (b,c), TEST:1571:2: hangs subsequent %s charges on one mark', async (status, transition) => {
            const { clock, setNow } = crossingClock(cancelActiveNow);
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'TEST:B8a:11 reads charges approved at once' }]
            });
            const seeded = await seedCrossingDirect({ fake, status, preapproval: 'LIVE' });
            if (transition === 'S23')
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({
                        graceStartedAt: new Date('2026-10-10T12:00:00.000Z'),
                        graceEndsAt: new Date('2026-10-17T12:00:00.000Z')
                    })
                    .where(eq(subscriptions.id, seeded.subscriptionId));
            await cancelDirectSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood
                }
            );
            const chargeIds: string[] = [];
            const outcomes = [];
            for (const [index, hours] of [1, 2].entries()) {
                const factAt =
                    transition === 'S24' && index === 0
                        ? new Date(cancelActiveNow.getTime() - 3600000)
                        : new Date(cancelActiveNow.getTime() + hours * 3600000);
                const charge = await chargeOn({
                    fake,
                    authorizationId: seeded.authorizationId,
                    at: factAt,
                    setNow,
                    reference: seeded.subscriptionId
                });
                chargeIds.push(charge.chargeId);
                outcomes.push(await recordOn({ fake, chargeId: charge.chargeId, clock }));
            }
            expect(outcomes.map(crossing)).toMatchObject([
                { outcome: 'MARKED', markOutcome: 'OPENED', transition },
                { outcome: 'MARKED', markOutcome: 'ACCUMULATED', transition }
            ]);
            const marks = await openMarksOf(seeded.subscriptionId);
            expect(
                marks.filter((mark) => mark.reason === 'COBRO_POSTERIOR_A_LA_BAJA')
            ).toHaveLength(1);
            expect(await hungPaymentsOf(marks[0]!.id)).toHaveLength(2);
            const events = await markOpenedEvents(seeded.subscriptionId);
            const details = events.map((event) => event.changes ?? []);
            for (const eventDetails of details) {
                expect(eventDetails).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ field: 'provider.charge_id' }),
                        expect.objectContaining({ field: 'provider.charge_amount_minor' })
                    ])
                );
                if (transition === 'S23')
                    expect(eventDetails.map((change) => change.field)).not.toContain(
                        'subscription.grace_started_at'
                    );
                if (transition === 'S24')
                    expect(eventDetails).toEqual(
                        expect.arrayContaining([
                            expect.objectContaining({
                                field: 'subscription.grace_started_at',
                                new: new Date('2026-10-10T12:00:00.000Z').toISOString()
                            })
                        ])
                    );
            }
            if (transition === 'S24')
                expect(marks.some((mark) => mark.reason === 'PAGO_TARDIO_RECHAZADO')).toBe(false);
            for (const id of chargeIds) {
                const payment = (await paymentsForSubscription(seeded.subscriptionId)).find(
                    (row) => row.providerFactId === id
                )!;
                expect(await refundsOfPayment(payment.id)).toHaveLength(0);
            }
        });

        it('TEST:1571:2 (g): leaves S36, active, and GRACE_PERIOD to their owning rules', async () => {
            const { clock, setNow } = crossingClock(cancelActiveNow);
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'TEST:1571:2 reads charges approved at once' }]
            });
            const outside = await seedCrossingActive({
                fake,
                payment: 'payment',
                status: 'CANCELLED'
            });
            await getServiceTestDb().transaction(async (tx) =>
                recordProviderCancellationDecided({
                    subscriptionId: outside.subscriptionId,
                    transition: 'S36',
                    decidedAt: cancelActiveNow,
                    actor: { type: 'provider' },
                    correlationId: crypto.randomUUID(),
                    tx
                })
            );
            const outCharge = await chargeOn({
                fake,
                authorizationId: outside.authorizationId,
                at: new Date(cancelActiveNow.getTime() + 3600000),
                setNow,
                reference: outside.subscriptionId
            });
            const outResult = await recordOn({ fake, chargeId: outCharge.chargeId, clock });
            expect(outResult.outcome).toBe('CREDITED');
            if (outResult.outcome === 'CREDITED') expect(outResult.crossing).toBeUndefined();
            expect(
                (await marksOf(outside.subscriptionId)).filter(
                    (mark) => mark.reason === 'COBRO_POSTERIOR_A_LA_BAJA'
                )
            ).toHaveLength(0);

            const active = await seedCrossingActive({ fake, payment: 'none', status: 'ACTIVE' });
            const activeCharge = await chargeOn({
                fake,
                authorizationId: active.authorizationId,
                at: new Date(cancelActiveNow.getTime() + 2 * 3600000),
                setNow,
                reference: active.subscriptionId
            });
            const activeResult = await recordOn({ fake, chargeId: activeCharge.chargeId, clock });
            expect(activeResult.outcome).toBe('CREDITED');
            if (activeResult.outcome === 'CREDITED') expect(activeResult.crossing).toBeUndefined();

            const grace = await seedCrossingDirect({
                fake,
                status: 'GRACE_PERIOD',
                preapproval: 'LIVE'
            });
            const graceCharge = await chargeOn({
                fake,
                authorizationId: grace.authorizationId,
                at: new Date(cancelActiveNow.getTime() + 3 * 3600000),
                setNow,
                reference: grace.subscriptionId
            });
            const graceResult = await recordOn({ fake, chargeId: graceCharge.chargeId, clock });
            expect(graceResult.outcome).toBe('CREDITED');
            if (graceResult.outcome === 'CREDITED') {
                expect(graceResult.exit).toBeDefined();
                expect(graceResult.crossing).toBeUndefined();
            }
            const suspended = await seedCrossingDirect({
                fake,
                status: 'SUSPENDED',
                preapproval: 'LIVE'
            });
            const suspendedCharge = await chargeOn({
                fake,
                authorizationId: suspended.authorizationId,
                at: new Date(cancelActiveNow.getTime() + 4 * 3600000),
                setNow,
                reference: suspended.subscriptionId
            });
            const suspendedResult = await recordOn({
                fake,
                chargeId: suspendedCharge.chargeId,
                clock
            });
            expect(suspendedResult.outcome).toBe('CREDITED');
            if (suspendedResult.outcome === 'CREDITED') {
                expect(suspendedResult.reactivation).toBeDefined();
                expect(suspendedResult.crossing).toBeUndefined();
            }
        });

        it('TEST:B8a:11 (e): an S11 row closed by S12 still marks a later charge', async () => {
            const { clock, setNow } = crossingClock(cancelActiveNow);
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'TEST:B8a:11 reads charges approved at once' }]
            });
            const seeded = await seedCrossingActive({ fake, payment: 'none' });
            await cancelActiveSubscription(
                { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    complements: unusedComplementPolicy,
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            await getServiceTestDb().transaction(async (tx) =>
                applyS12ToPrincipal(
                    {
                        tx,
                        subscriptionId: seeded.subscriptionId,
                        now: new Date(cancelActiveNow.getTime() + 3600000)
                    },
                    { orphanhood: orphanPorts(tx).ports, clock }
                )
            );
            const charge = await chargeOn({
                fake,
                authorizationId: seeded.authorizationId,
                at: new Date(cancelActiveNow.getTime() + 2 * 3600000),
                setNow,
                reference: seeded.subscriptionId
            });
            const result = await recordOn({ fake, chargeId: charge.chargeId, clock });
            expect(crossing(result)).toMatchObject({ outcome: 'MARKED', transition: 'S11' });
            expect(
                (await openMarksOf(seeded.subscriptionId)).filter(
                    (mark) => mark.reason === 'COBRO_POSTERIOR_A_LA_BAJA'
                )
            ).toHaveLength(1);
        });
    }
);
