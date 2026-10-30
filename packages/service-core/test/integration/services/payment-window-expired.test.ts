import {
    coveredPeriods,
    type DrizzleClient,
    emailOutbox,
    eq,
    payments,
    receipts,
    setDb,
    subscriptions
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { failPayment } from '../../../src/services/billing/payment/fail-payment.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

async function pendingPayment(fixture: Awaited<ReturnType<typeof paymentFixture>>) {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: `window-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!payment) throw new Error('pending payment missing');
    return payment;
}

describe('TEST:B5:4 payment window expiration', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'P2 fails the pending payment without changing its subscription or side effects',
        async () => {
            const fixture = await paymentFixture();
            const first = await pendingPayment(fixture);
            await creditPayment(
                { paymentId: first.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );
            const payment = await pendingPayment(fixture);
            const [subscriptionBefore] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const result = await failPayment({ paymentId: payment.id }, { clock: fixture.clock });
            const [after] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            const [subscriptionAfter] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(result).toEqual({ outcome: 'FAILED' });
            expect(after).toMatchObject({ status: 'FAILED', version: payment.version + 1 });
            expect(subscriptionAfter).toEqual(subscriptionBefore);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id))
            ).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, payment.id))
            ).toHaveLength(0);
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(
                mail.filter(
                    (row) => (row.payload as { paymentId?: string }).paymentId === payment.id
                )
            ).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'P2 is idempotent for a succeeded payment and concurrent callers',
        async () => {
            const fixture = await paymentFixture();
            const [succeeded] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: fixture.link.provider,
                    providerFactId: `window-succeeded-${crypto.randomUUID()}`,
                    factAt: fixture.clock.now()
                })
                .returning();
            expect(
                await failPayment({ paymentId: succeeded!.id }, { clock: fixture.clock })
            ).toEqual({ outcome: 'NOT_PENDING' });
            const [unchangedSucceeded] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, succeeded!.id));
            expect(unchangedSucceeded).toEqual(succeeded);
            const payment = await pendingPayment(fixture);
            const results = await Promise.all([
                failPayment({ paymentId: payment.id }, { clock: fixture.clock }),
                failPayment({ paymentId: payment.id }, { clock: fixture.clock })
            ]);
            expect(results.map((row) => row.outcome).sort()).toEqual(['FAILED', 'NOT_PENDING']);
            const [after] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            expect(after).toMatchObject({ status: 'FAILED', version: payment.version + 1 });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'P2 rereads after a concurrent version bump that leaves the payment pending',
        async () => {
            const fixture = await paymentFixture();
            const payment = await pendingPayment(fixture);
            const realDb = getServiceTestDb();
            let injectedVersionBump = false;
            const updateReturnedRowCounts: number[] = [];

            const wrapQueryBuilder = (builder: object, isUpdate = false): object =>
                new Proxy(builder, {
                    get(target, property, receiver) {
                        const method = Reflect.get(target, property, receiver) as unknown;
                        if (typeof method !== 'function') return method;
                        if (property === 'then') return method.bind(target);
                        return (...args: unknown[]) => {
                            const result = Reflect.apply(method, target, args) as unknown;
                            if (property === 'limit' && !injectedVersionBump) {
                                return Promise.resolve(result).then(async (rows: unknown) => {
                                    injectedVersionBump = true;
                                    await getServiceTestPool().query(
                                        "UPDATE payment SET version = version + 1 WHERE id = $1 AND status = 'PENDING'",
                                        [payment.id]
                                    );
                                    return rows;
                                });
                            }
                            if (property === 'returning' && isUpdate) {
                                return Promise.resolve(result).then((rows) => {
                                    updateReturnedRowCounts.push((rows as unknown[]).length);
                                    return rows;
                                });
                            }
                            return result && typeof result === 'object'
                                ? wrapQueryBuilder(result, isUpdate)
                                : result;
                        };
                    }
                });

            const wrappedDb = new Proxy(realDb, {
                get(target, property, receiver) {
                    const method = Reflect.get(target, property, receiver) as unknown;
                    if (property === 'transaction' && typeof method === 'function') {
                        return (callback: (tx: DrizzleClient) => Promise<unknown>) =>
                            Reflect.apply(method, target, [
                                (tx: object) =>
                                    callback(
                                        new Proxy(tx, {
                                            get(txTarget, txProperty, txReceiver) {
                                                const txMethod = Reflect.get(
                                                    txTarget,
                                                    txProperty,
                                                    txReceiver
                                                ) as unknown;
                                                if (typeof txMethod !== 'function') return txMethod;
                                                return (...args: unknown[]) => {
                                                    const builder = Reflect.apply(
                                                        txMethod,
                                                        txTarget,
                                                        args
                                                    ) as unknown;
                                                    return builder && typeof builder === 'object'
                                                        ? wrapQueryBuilder(
                                                              builder,
                                                              txProperty === 'update'
                                                          )
                                                        : builder;
                                                };
                                            }
                                        }) as DrizzleClient
                                    )
                            ]);
                    }
                    return typeof method === 'function' ? method.bind(target) : method;
                }
            });

            try {
                setDb(wrappedDb as DrizzleClient);
                const result = await failPayment(
                    { paymentId: payment.id },
                    { clock: fixture.clock }
                );
                const [after] = await realDb
                    .select()
                    .from(payments)
                    .where(eq(payments.id, payment.id));

                expect(injectedVersionBump).toBe(true);
                expect(updateReturnedRowCounts).toEqual([0, 1]);
                expect(result).toEqual({ outcome: 'FAILED' });
                expect(after).toMatchObject({ status: 'FAILED', version: payment.version + 2 });
            } finally {
                setDb(realDb);
            }
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'FAILED blocks later P1 and P8 fails a rejected charge without a retry window',
        async () => {
            const fixture = await paymentFixture();
            const payment = await pendingPayment(fixture);
            await failPayment({ paymentId: payment.id }, { clock: fixture.clock });
            expect(
                await creditPayment(
                    { paymentId: payment.id, chargeCreatedAt: fixture.clock.now() },
                    { clock: fixture.clock }
                )
            ).toMatchObject({ outcome: 'NOT_PENDING' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment.id))
            ).toHaveLength(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, payment.id))
            ).toHaveLength(0);

            const { chargeId } = await fixture.provider.declineCharge({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'declined'
            });
            const recorded = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            expect(recorded.outcome).toBe('DECLINED');
            const [rejectedPayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            // AC:1734:1 — the rejected signup charge is failed by P8.
            expect(rejectedPayment).toMatchObject({ status: 'FAILED', version: 2 });
        }
    );
});
