import type { CoverageChangedEvent, CoverageSource } from '@repo/billing-verticals-contract';
import {
    coveredPeriods,
    eq,
    payments,
    promoCodes,
    promoRedemptions,
    subscriptions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import type { CoverageNotices } from '../../../src/services/billing/payment/payment-ports.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    cleanUpCoverageNoticeRows,
    outboxTemplatesOf,
    registryWithConsumer,
    subscriptionSources
} from './support/coverage-notice-fixtures.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);

const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };
const PAYMENT_CREDITED = 'billing.payment-credited';

const userIds: string[] = [];
const promoCodeIds: string[] = [];

afterEach(async () => {
    await cleanUpCoverageNoticeRows({ userIds, promoCodeIds });
    userIds.length = 0;
    promoCodeIds.length = 0;
});

/** A fresh `ACTIVE` with no payment, owned by a user this test cleans up. */
async function activeWithoutPayments() {
    const fixture = await paymentFixture();
    userIds.push(fixture.user.id);
    const [row] = await getServiceTestDb()
        .select({ planVersionId: subscriptions.planVersionId, createdAt: subscriptions.createdAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, fixture.started.subscriptionId));
    if (!row?.planVersionId) throw new Error('subscription row missing');
    return { fixture, planVersionId: row.planVersionId, createdAt: row.createdAt };
}

function subscriptionSource(input: {
    readonly planVersionId: string;
    readonly createdAt: Date;
    readonly charged: boolean;
}): CoverageSource {
    return {
        type: 'SUBSCRIPTION',
        reference: { kind: 'PLAN_VERSION', planVersionId: input.planVersionId },
        scope: 'VERTICAL',
        target: null,
        since: input.createdAt,
        until: 'NO_KNOWN_DATE',
        charged: input.charged,
        floor: null
    };
}

async function insertPendingPayment(input: {
    readonly subscriptionId: string;
    readonly provider: string;
    readonly factAt: Date;
}): Promise<string> {
    const [row] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: input.provider,
            providerFactId: `coverage-notice-${crypto.randomUUID()}`,
            factAt: input.factAt
        })
        .returning({ id: payments.id });
    if (!row) throw new Error('pending payment missing');
    return row.id;
}

async function paymentStatus(paymentId: string): Promise<string | undefined> {
    const [row] = await getServiceTestDb()
        .select({ status: payments.status })
        .from(payments)
        .where(eq(payments.id, paymentId));
    return row?.status;
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B4:2 the coverage-changed notice of the first credited payment lands after commit (AC:B4:2, AC:B4:3)',
    () => {
        it('(a) P1 moves charged from no to yes and the consumer that re-reads coverage sees yes', async () => {
            // Arrange
            const { fixture, planVersionId, createdAt } = await activeWithoutPayments();
            const consumer = registryWithConsumer({
                clock: fixture.clock,
                subscriptionId: fixture.started.subscriptionId
            });
            const before = await consumer.coverage.coverage({
                userId: fixture.user.id,
                vertical: VerticalEnum.ACCOMMODATION
            });
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });

            // Act
            const output = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: consumer.registry
                }
            );

            // Assert
            expect(subscriptionSources(before)).toEqual([
                subscriptionSource({ planVersionId, createdAt, charged: false })
            ]);
            expect(output.outcome).toBe('CREDITED');
            const event: CoverageChangedEvent = {
                userId: fixture.user.id,
                vertical: VerticalEnum.ACCOMMODATION,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            };
            expect(consumer.observed).toEqual([
                {
                    event,
                    subscriptionSources: [
                        subscriptionSource({ planVersionId, createdAt, charged: true })
                    ],
                    committedPaymentStatuses: ['SUCCEEDED']
                }
            ]);
        });

        it('(b) nothing is emitted while the transaction is open; the listener runs on committed state', async () => {
            // Arrange
            const { fixture, planVersionId, createdAt } = await activeWithoutPayments();
            const consumer = registryWithConsumer({
                clock: fixture.clock,
                subscriptionId: fixture.started.subscriptionId
            });
            const paymentId = await insertPendingPayment({
                subscriptionId: fixture.started.subscriptionId,
                provider: fixture.link.provider,
                factAt: fixture.clock.now()
            });
            const noticesSeenInsideTransaction: number[] = [];

            // Act
            const result = await creditPayment(
                { paymentId, chargeCreatedAt: fixture.clock.now() },
                {
                    clock: fixture.clock,
                    coverageNotices: consumer.registry,
                    beforeOptimisticUpdate: async () => {
                        noticesSeenInsideTransaction.push(consumer.observed.length);
                    }
                }
            );

            // Assert
            expect(result).toEqual({ outcome: 'CREDITED', coverage: 'WRITTEN' });
            expect(noticesSeenInsideTransaction).toEqual([0]);
            expect(consumer.observed).toEqual([
                {
                    event: {
                        userId: fixture.user.id,
                        vertical: VerticalEnum.ACCOMMODATION,
                        sourceType: 'SUBSCRIPTION',
                        change: 'CHANGED'
                    },
                    subscriptionSources: [
                        subscriptionSource({ planVersionId, createdAt, charged: true })
                    ],
                    committedPaymentStatuses: ['SUCCEEDED']
                }
            ]);
        });

        it('(c) a rollback after the payment was written emits nothing', async () => {
            // Arrange
            const { fixture, planVersionId, createdAt } = await activeWithoutPayments();
            const consumer = registryWithConsumer({
                clock: fixture.clock,
                subscriptionId: fixture.started.subscriptionId
            });
            const [code] = await getServiceTestDb()
                .insert(promoCodes)
                .values({
                    code: `COVERAGE-NOTICE-${crypto.randomUUID()}`,
                    discountKind: 'PERCENTAGE',
                    value: 10,
                    allVerticals: true,
                    verticals: null,
                    totalQuota: 10,
                    validFrom: new Date('2026-01-01T00:00:00.000Z'),
                    validUntil: new Date('2027-01-01T00:00:00.000Z'),
                    stackable: false,
                    usableWithAnotherActive: false,
                    durationKind: 'N_CHARGES',
                    durationCharges: 3
                })
                .returning({ id: promoCodes.id });
            if (!code) throw new Error('promo code missing');
            promoCodeIds.push(code.id);
            await getServiceTestDb().insert(promoRedemptions).values({
                promoCodeId: code.id,
                userId: fixture.user.id,
                subscriptionId: fixture.started.subscriptionId,
                redeemedAt: fixture.clock.now(),
                remainingCharges: 2
            });
            const paymentId = await insertPendingPayment({
                subscriptionId: fixture.started.subscriptionId,
                provider: fixture.link.provider,
                factAt: fixture.clock.now()
            });
            const policyCalls: string[] = [];

            // Act
            const credit = creditPayment(
                { paymentId, chargeCreatedAt: fixture.clock.now() },
                {
                    clock: fixture.clock,
                    coverageNotices: consumer.registry,
                    promoCharges: {
                        chargedWithDiscount: async ({ redemptionId }) => {
                            policyCalls.push(redemptionId);
                            throw new Error('promo policy down after the payment write');
                        }
                    }
                }
            );

            // Assert
            await expect(credit).rejects.toThrow('promo policy down after the payment write');
            expect(policyCalls).toHaveLength(1);
            expect(await paymentStatus(paymentId)).toBe('PENDING');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, paymentId))
            ).toEqual([]);
            expect(consumer.observed).toEqual([]);
            const after = await consumer.coverage.coverage({
                userId: fixture.user.id,
                vertical: VerticalEnum.ACCOMMODATION
            });
            expect(subscriptionSources(after)).toEqual([
                subscriptionSource({ planVersionId, createdAt, charged: false })
            ]);
        });

        it('(d) the notice leaves no coverage row in the U2 outbox: only the payment-credited mail', async () => {
            // Arrange
            const { fixture } = await activeWithoutPayments();
            const consumer = registryWithConsumer({
                clock: fixture.clock,
                subscriptionId: fixture.started.subscriptionId
            });
            const outboxBefore = await outboxTemplatesOf(fixture.user.id);
            const paymentId = await insertPendingPayment({
                subscriptionId: fixture.started.subscriptionId,
                provider: fixture.link.provider,
                factAt: fixture.clock.now()
            });

            // Act
            await creditPayment(
                { paymentId, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock, coverageNotices: consumer.registry }
            );

            // Assert
            expect(consumer.observed).toHaveLength(1);
            expect(outboxBefore).not.toContain(PAYMENT_CREDITED);
            expect(await outboxTemplatesOf(fixture.user.id)).toEqual([
                ...outboxBefore,
                PAYMENT_CREDITED
            ]);
        });

        it('(e) a crash between commit and emission keeps the payment and never retries the notice', async () => {
            // Arrange
            const { fixture } = await activeWithoutPayments();
            const outboxBefore = await outboxTemplatesOf(fixture.user.id);
            const attempts: CoverageChangedEvent[] = [];
            const crashing: CoverageNotices = {
                emitCoverageChanged: async (event) => {
                    attempts.push(event);
                    throw new Error('process died between commit and emission');
                }
            };
            const paymentId = await insertPendingPayment({
                subscriptionId: fixture.started.subscriptionId,
                provider: fixture.link.provider,
                factAt: fixture.clock.now()
            });

            // Act
            const first = await creditPayment(
                { paymentId, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock, coverageNotices: crashing }
            );
            const repeat = await creditPayment(
                { paymentId, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock, coverageNotices: crashing }
            );

            // Assert
            expect(first).toEqual({ outcome: 'CREDITED', coverage: 'WRITTEN' });
            expect(repeat).toEqual({ outcome: 'ALREADY_CREDITED', coverage: 'NOT_APPLICABLE' });
            expect(await paymentStatus(paymentId)).toBe('SUCCEEDED');
            expect(attempts).toEqual([
                {
                    userId: fixture.user.id,
                    vertical: VerticalEnum.ACCOMMODATION,
                    sourceType: 'SUBSCRIPTION',
                    change: 'CHANGED'
                }
            ]);
            expect(await outboxTemplatesOf(fixture.user.id)).toEqual([
                ...outboxBefore,
                PAYMENT_CREDITED
            ]);
        });

        it('(f) the second credited payment of the same row emits nothing: charged was already yes', async () => {
            // Arrange
            const { fixture } = await activeWithoutPayments();
            const consumer = registryWithConsumer({
                clock: fixture.clock,
                subscriptionId: fixture.started.subscriptionId
            });
            const firstAt = fixture.clock.now();
            const secondAt = new Date(firstAt.getTime() + 31 * 24 * 60 * 60 * 1000);
            const firstPayment = await insertPendingPayment({
                subscriptionId: fixture.started.subscriptionId,
                provider: fixture.link.provider,
                factAt: firstAt
            });
            await creditPayment(
                { paymentId: firstPayment, chargeCreatedAt: firstAt },
                { clock: fixture.clock, coverageNotices: consumer.registry }
            );
            const noticesAfterFirst = consumer.observed.length;
            const secondPayment = await insertPendingPayment({
                subscriptionId: fixture.started.subscriptionId,
                provider: fixture.link.provider,
                factAt: secondAt
            });

            // Act
            const second = await creditPayment(
                { paymentId: secondPayment, chargeCreatedAt: secondAt },
                { clock: fixture.clock, coverageNotices: consumer.registry }
            );

            // Assert
            expect(noticesAfterFirst).toBe(1);
            expect(second).toEqual({ outcome: 'CREDITED', coverage: 'WRITTEN' });
            expect(await paymentStatus(secondPayment)).toBe('SUCCEEDED');
            expect(consumer.observed).toHaveLength(1);
        });
    }
);
