import {
    coveredPeriods,
    eq,
    manualPayments,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { extractPostgresErrorCause } from '../../../src/utils/postgres-error-cause.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

describe('TEST:B5:3 provider duplicate period coverage', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:3 credits the second charge, omits coverage and opens reason 20 with its payment hung',
        async () => {
            const fixture = await paymentFixture();
            const requestCharge = () =>
                fixture.provider.charge({
                    authorizationId: fixture.started.authorizationId,
                    amount: { amountMinor: 250000, currency: 'ARS' },
                    reference: fixture.started.subscriptionId
                });
            const firstFact = await requestCharge();
            const secondFact = await requestCharge();
            const first = await recordChargeFact(
                { chargeId: firstFact.chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            const second = await recordChargeFact(
                { chargeId: secondFact.chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(first.outcome).toBe('CREDITED');
            expect(second.outcome).toBe('CREDITED');
            const [firstPayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, firstFact.chargeId));
            const [secondPayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, secondFact.chargeId));
            expect(firstPayment?.status).toBe('SUCCEEDED');
            expect(secondPayment?.status).toBe('SUCCEEDED');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, firstPayment?.id ?? ''))
            ).toHaveLength(1);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, secondPayment?.id ?? ''))
            ).toHaveLength(0);
            const marks = await getServiceTestDb()
                .select()
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, fixture.started.subscriptionId));
            const mark = marks.find(
                (row) => row.reason === 'COBRO_DUPLICADO' && row.liftedAt === null
            );
            expect(mark).toBeDefined();
            const hung = await getServiceTestDb()
                .select()
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.paymentId, secondPayment?.id ?? ''));
            expect(hung).toHaveLength(1);
            expect(hung[0]?.markId).toBe(mark?.id);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:3 the open-period UNIQUE rejects a duplicate and accepts a released period',
        async () => {
            const fixture = await paymentFixture();
            const manual = await getServiceTestDb()
                .insert(manualPayments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: fixture.clock.now(),
                    status: 'REGISTERED',
                    registeredBy: fixture.user.id,
                    registeredAt: fixture.clock.now()
                })
                .returning();
            const firstPayment = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 100,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: fixture.link.provider,
                    providerFactId: `seed-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            const period = await getServiceTestDb()
                .insert(coveredPeriods)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: fixture.clock.now(),
                    paymentId: firstPayment[0]?.id,
                    creditedAt: fixture.clock.now()
                })
                .returning();
            const [existingManual] = manual;
            try {
                await getServiceTestDb().insert(coveredPeriods).values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: period[0]!.periodStart,
                    manualPaymentId: existingManual!.id,
                    creditedAt: fixture.clock.now()
                });
                throw new Error('expected duplicate period constraint');
            } catch (error) {
                expect(extractPostgresErrorCause(error)).toMatchObject({
                    code: '23505',
                    constraint: 'uq_covered_period_open_subscription_period'
                });
            }
            await getServiceTestDb()
                .update(coveredPeriods)
                .set({ releasedAt: fixture.clock.now() })
                .where(eq(coveredPeriods.id, period[0]!.id));
            const accepted = await getServiceTestDb()
                .insert(coveredPeriods)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: period[0]!.periodStart,
                    manualPaymentId: existingManual!.id,
                    creditedAt: fixture.clock.now()
                })
                .returning();
            expect(accepted).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:3 rolls P1 back when attaching the duplicate payment to the mark fails',
        async () => {
            const fixture = await paymentFixture();
            const manual = await getServiceTestDb()
                .insert(manualPayments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    periodStart: fixture.clock.now(),
                    status: 'REGISTERED',
                    registeredBy: fixture.user.id,
                    registeredAt: fixture.clock.now()
                })
                .returning();
            const [seededManual] = manual;
            await getServiceTestDb().insert(coveredPeriods).values({
                subscriptionId: fixture.started.subscriptionId,
                periodStart: fixture.clock.now(),
                manualPaymentId: seededManual!.id,
                creditedAt: fixture.clock.now()
            });
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 100,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `atomic-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            const markPaymentsPort = {
                hang: async () => {
                    throw new Error('injected hang failure');
                },
                countUnresolved: async () => 0
            };
            await expect(
                creditPayment(
                    { paymentId: pending!.id, chargeCreatedAt: fixture.clock.now() },
                    { clock: fixture.clock, markPayments: markPaymentsPort }
                )
            ).rejects.toThrow('injected hang failure');
            const [after] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, pending!.id));
            expect(after?.status).toBe('PENDING');
        }
    );
});
