import { coveredPeriods, eq, payments, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveSubscriptionSources } from '../../../src/services/billing/coverage/subscription-sources.js';
import { cancelActiveSubscription } from '../../../src/services/billing/subscription/cancel-active-subscription.service.js';
import { classifyCancellationCrossing } from '../../../src/services/billing/subscription/cancellation-crossing-rule.js';
import { computeS11ServiceEnd } from '../../../src/services/billing/subscription/s11-service-end.js';
import { noCreditedPayments } from '../../../src/services/billing/subscription/subscription-billing-ports.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    crossingClock,
    marksOf,
    paymentsForSubscription,
    recordOn,
    retireCancelCrossingRows,
    seedCrossingActive
} from './support/cancel-crossing-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

const T0 = new Date('2026-10-13T12:00:00.000Z');
const T1 = new Date('2026-10-14T12:00:00.000Z');
const owner = (id: string) => ({
    id,
    roles: [],
    permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
});
const fakeFor = (clock: { now: () => Date }, honestM8 = false) =>
    new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock,
        ...(honestM8
            ? {
                  honestAbout: [
                      {
                          lie: 'M8',
                          why: 'this case requires the charge requested after S11 to approve immediately'
                      }
                  ]
              }
            : {})
    });
const cancel = (
    seeded: Awaited<ReturnType<typeof seedCrossingActive>>,
    fake: FakePaymentProvider,
    clock: { now: () => Date },
    notice = outboxBeforeCancelNotice()
) =>
    cancelActiveSubscription(
        { actor: owner(seeded.userId), subscriptionId: seeded.subscriptionId },
        {
            provider: fake,
            clock,
            beforeCancelNotice: notice,
            complements: unusedComplementPolicy,
            coverageNotices: { emitCoverageChanged: async () => undefined }
        }
    );

afterEach(retireCancelCrossingRows);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B8a:10 earlier charge credited after S11',
    () => {
        it('TEST:B8a:10 (a), TEST:1571:3: extends by the earlier charge, updates coverage, and replay is idempotent', async () => {
            const { clock, setNow } = crossingClock(new Date('2026-10-01T00:00:00.000Z'));
            const fake = fakeFor(clock);
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            const calls: unknown[] = [];
            const notice = outboxBeforeCancelNotice();
            setNow(T0);
            const charge = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            setNow(T1);
            await cancel(seeded, fake, clock, notice);
            const [before] = await getServiceTestDb()
                .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            const actual = await recordOn({
                fake,
                chargeId: charge.chargeId,
                clock,
                coverage: async (event) => {
                    calls.push(event);
                }
            });
            const expected = new Date('2026-11-13T12:00:00.000Z'); // billingPeriodEnd({ periodStart: T0, everyMonths: 1 }).periodEnd
            expect(actual).toMatchObject({
                outcome: 'CREDITED',
                crossing: { outcome: 'EXTENDED', serviceEndsAt: expected }
            });
            expect(actual.outcome === 'CREDITED' && actual.paymentId).toBeTruthy();
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row?.status).toBe('CANCEL_SCHEDULED');
            expect(row?.serviceEndsAt).toEqual(expected);
            const [period] = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(
                    eq(
                        coveredPeriods.paymentId,
                        (await paymentsForSubscription(seeded.subscriptionId)).find(
                            (p) => p.providerFactId === charge.chargeId
                        )!.id
                    )
                );
            expect(period?.periodStart).toEqual(T0);
            expect(await marksOf(seeded.subscriptionId)).toHaveLength(0);
            expect(calls).toHaveLength(1);
            expect(calls[0]).toMatchObject({
                userId: seeded.userId,
                vertical: 'accommodation',
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            });
            expect(before?.serviceEndsAt).toEqual(new Date('2026-11-01T00:00:00.000Z'));
            const sources = await resolveSubscriptionSources({
                userId: seeded.userId,
                vertical: VerticalEnum.ACCOMMODATION,
                ports: { clock, payments: noCreditedPayments }
            });
            expect(
                sources.sources.some(
                    (source) =>
                        source.until instanceof Date &&
                        source.until.getTime() === expected.getTime()
                )
            ).toBe(true);
            const replay = await recordOn({
                fake,
                chargeId: charge.chargeId,
                clock,
                coverage: async (event) => {
                    calls.push(event);
                }
            });
            expect(replay).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'ALREADY_CREDITED' },
                crossing: { outcome: 'NOT_EXTENDED', serviceEndsAt: expected }
            });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(
                        eq(
                            coveredPeriods.paymentId,
                            actual.outcome === 'CREDITED' ? actual.paymentId : ''
                        )
                    )
            ).toHaveLength(1);
            expect(calls).toHaveLength(1);
        });

        it('TEST:B8a:10 (b): a smaller recalculated end never shortens service', async () => {
            const { clock, setNow } = crossingClock(new Date('2026-10-01T00:00:00.000Z'));
            const fake = fakeFor(clock);
            const seeded = await seedCrossingActive({
                fake,
                payment: 'payment',
                periodStart: new Date('2026-10-10T00:00:00.000Z')
            });
            setNow(new Date('2026-10-05T00:00:00.000Z'));
            const charge = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            setNow(T1);
            await cancel(seeded, fake, clock);
            const result = await recordOn({ fake, chargeId: charge.chargeId, clock });
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                crossing: {
                    outcome: 'NOT_EXTENDED',
                    serviceEndsAt: new Date('2026-11-10T00:00:00.000Z')
                }
            });
            expect(await marksOf(seeded.subscriptionId)).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(
                        eq(
                            coveredPeriods.paymentId,
                            (await paymentsForSubscription(seeded.subscriptionId))[0]!.id
                        )
                    )
            ).toHaveLength(1);
        });

        it('TEST:B8a:10 (c): M8 keeps the requested fact time when a pending charge settles after S11', async () => {
            const { clock, setNow } = crossingClock(new Date('2026-10-01T00:00:00.000Z'));
            const fake = fakeFor(clock);
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            setNow(T0);
            const charge = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            expect((await fake.readCharge({ chargeId: charge.chargeId })).snapshot.status).toBe(
                'pending'
            );
            expect(await recordOn({ fake, chargeId: charge.chargeId, clock })).toMatchObject({
                outcome: 'RECORDED_PENDING'
            });
            setNow(new Date(T0.getTime() + 30 * 60_000));
            await cancel(seeded, fake, clock, outboxBeforeCancelNotice());
            setNow(new Date(T0.getTime() + 2 * 60 * 60_000));
            const result = await recordOn({ fake, chargeId: charge.chargeId, clock });
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                crossing: { outcome: 'EXTENDED' }
            });
            if (result.outcome !== 'CREDITED') throw new Error('expected credited M8 charge');
            const [payment] = await getServiceTestDb()
                .select({ factAt: payments.factAt })
                .from(payments)
                .where(eq(payments.id, result.paymentId));
            expect(payment?.factAt).toEqual(T0);
            expect(await marksOf(seeded.subscriptionId)).toHaveLength(0);
        });

        it('TEST:B8a:10 (f): the formula uses this payment period, not a later credited charge', async () => {
            const { clock, setNow } = crossingClock(new Date('2026-10-01T00:00:00.000Z'));
            const fake = fakeFor(clock, true);
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            setNow(T1);
            await cancel(seeded, fake, clock);
            const laterAt = new Date(T1.getTime() + 60 * 60_000);
            setNow(laterAt);
            const later = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            expect(await recordOn({ fake, chargeId: later.chargeId, clock })).toMatchObject({
                outcome: 'CREDITED',
                crossing: { outcome: 'MARKED' }
            });
            setNow(T0);
            const earlier = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            const result = await recordOn({ fake, chargeId: earlier.chargeId, clock });
            const expected = computeS11ServiceEnd({
                now: T1,
                paidPeriodStart: T0,
                everyMonths: 1,
                creditEndsAt: null
            }).serviceEndsAt;
            expect(result).toMatchObject({
                outcome: 'CREDITED',
                crossing: { outcome: 'EXTENDED', serviceEndsAt: expected }
            });
        });

        it('TEST:1571:2 (g): a scheduled row without an S11 decision remains outside this rule', async () => {
            expect(
                classifyCancellationCrossing({
                    status: 'CANCEL_SCHEDULED',
                    class: 'PRINCIPAL',
                    decision: null,
                    factAt: T0
                })
            ).toBe('NONE');
            const { clock, setNow } = crossingClock(new Date('2026-10-01T00:00:00.000Z'));
            const fake = fakeFor(clock, true);
            const seeded = await seedCrossingActive({
                fake,
                payment: 'payment',
                status: 'CANCEL_SCHEDULED'
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ serviceEndsAt: new Date('2026-11-01T00:00:00.000Z') })
                .where(eq(subscriptions.id, seeded.subscriptionId));
            setNow(T0);
            const charge = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            const result = await recordOn({ fake, chargeId: charge.chargeId, clock });
            expect(result.outcome).toBe('CREDITED');
            if (result.outcome === 'CREDITED') expect(result.crossing).toBeUndefined();
            const [row] = await getServiceTestDb()
                .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row?.serviceEndsAt).toEqual(new Date('2026-11-01T00:00:00.000Z'));
            expect(await marksOf(seeded.subscriptionId)).toHaveLength(0);
        });
    }
);
