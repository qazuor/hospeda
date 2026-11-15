import { and, emailOutbox, eq, idempotencyKeys, providerLinks, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import type { PoolClient } from 'pg';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import {
    createChargebackDetection,
    createChargebackSuspension
} from '../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { startSuccession } from '../../../src/services/billing/subscription/start-succession.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import {
    approvedCharge,
    chargebackFixture,
    chargebackMarks,
    paymentOfCharge,
    recordCharge,
    retireChargebackFixtures
} from './support/chargeback-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { successionPorts, successionReturnUrl } from './support/succession-fixtures.js';

const successors: {
    readonly id: string;
    readonly predecessorId: string;
    readonly userId: string;
}[] = [];
afterEach(async () => {
    const db = getServiceTestDb();
    for (const successor of successors.splice(0)) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, successor.userId));
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, successor.id));
        await db
            .update(subscriptions)
            .set({ succeededById: null })
            .where(eq(subscriptions.id, successor.predecessorId));
        await db.delete(idempotencyKeys).where(eq(idempotencyKeys.subjectId, successor.id));
        await db.delete(subscriptions).where(eq(subscriptions.id, successor.id));
    }
    await retireChargebackFixtures();
});
afterAll(closeServiceTestPool);

async function waitForUpdateLockWaiters({ count }: { readonly count: number }): Promise<void> {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
        const result = await getServiceTestPool().query<{ count: string }>(`
            SELECT count(*)::text AS count
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND wait_event_type = 'Lock'
              AND position('for update' IN lower(query)) > 0
        `);
        if (Number(result.rows[0]?.count ?? 0) >= count) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`S6 did not reach ${count} row-lock waiters in time`);
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B7:7 AC:B7:10 concurrent chargeback reads serialize the S6 write',
    () => {
        it('suspends once, enqueues one notice and calls provider.cancel once', async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            expect((await recordCharge(fixture, chargeId)).outcome).toBe('CREDITED');
            await fixture.provider.chargeBack({ chargeId });
            const payment = await paymentOfCharge(chargeId);
            const firstCancelReached = deferred<void>();
            const releaseFirstCancel = deferred<void>();
            const secondNoticeLocked = deferred<void>();
            let noticeCount = 0;
            let cancelCalls = 0;
            let lock: PoolClient | undefined;
            const provider: PaymentProvider = new Proxy(fixture.provider, {
                get(target, property, receiver) {
                    if (property === 'cancel')
                        return async (input: { readonly authorizationId: string }) => {
                            cancelCalls++;
                            const result = await target.cancel(input);
                            if (cancelCalls === 1) {
                                firstCancelReached.resolve();
                                await releaseFirstCancel.promise;
                            }
                            return result;
                        };
                    const method = Reflect.get(target, property, receiver);
                    return typeof method === 'function' ? method.bind(target) : method;
                }
            });
            const databaseNotice = outboxBeforeCancelNotice({ deliver: true });
            const beforeCancelNotice = {
                beforeCancel: async (input: Parameters<typeof databaseNotice.beforeCancel>[0]) => {
                    const result = await databaseNotice.beforeCancel(input);
                    noticeCount++;
                    if (noticeCount === 2) {
                        lock = await getServiceTestPool().connect();
                        await lock.query('BEGIN');
                        await lock.query('SELECT id FROM subscription WHERE id = $1 FOR UPDATE', [
                            fixture.started.subscriptionId
                        ]);
                        secondNoticeLocked.resolve();
                    }
                    return result;
                }
            };
            const detection = createChargebackDetection({
                markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
                suspension: createChargebackSuspension({
                    provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices,
                    orphanhood: orphanPorts(getServiceTestDb()).ports
                })
            });
            let first: Promise<Awaited<ReturnType<typeof detection.detect>>> | undefined;
            let second: Promise<Awaited<ReturnType<typeof detection.detect>>> | undefined;
            try {
                first = detection.detect({
                    payment,
                    actor: 'provider',
                    correlationId: crypto.randomUUID()
                });
                await firstCancelReached.promise;
                second = detection.detect({
                    payment,
                    actor: 'job',
                    correlationId: crypto.randomUUID()
                });
                await secondNoticeLocked.promise;
                await waitForUpdateLockWaiters({ count: 1 });
                expect(cancelCalls).toBe(1);
                releaseFirstCancel.resolve();
                await waitForUpdateLockWaiters({ count: 2 });
                expect(cancelCalls).toBe(1);
                await lock!.query('COMMIT');
                const [firstResult, secondResult] = await Promise.all([first, second]);
                expect(
                    [firstResult.suspension?.outcome, secondResult.suspension?.outcome].sort()
                ).toEqual(['NOT_APPLICABLE', 'SUSPENDED']);
            } finally {
                releaseFirstCancel.resolve();
                await lock?.query('ROLLBACK').catch(() => undefined);
                if (first || second)
                    await Promise.allSettled([first, second].filter((task) => task !== undefined));
                lock?.release();
            }

            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(row?.status).toBe('SUSPENDED');
            expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(1);
            expect(cancelCalls).toBe(1);
            const mails = await getServiceTestDb()
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, fixture.user.id),
                        eq(emailOutbox.template, 'billing.chargeback-suspension')
                    )
                );
            expect(mails).toHaveLength(1);
        });

        it('TEST:B7:16 does not cut a live S1 successor when the S6 UPDATE moves no row', async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            expect((await recordCharge(fixture, chargeId)).outcome).toBe('CREDITED');
            const [predecessor] = await getServiceTestDb()
                .select({ billingOptionId: subscriptions.billingOptionId })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!predecessor?.billingOptionId)
                throw new Error('Predecessor billing option missing');
            const successor = await startSuccession(
                {
                    predecessorSubscriptionId: fixture.started.subscriptionId,
                    userId: fixture.user.id,
                    billingOptionId: predecessor.billingOptionId,
                    returnUrl: successionReturnUrl
                },
                { ...successionPorts(fixture.provider), clock: fixture.clock }
            );
            successors.push({
                id: successor.subscriptionId,
                predecessorId: fixture.started.subscriptionId,
                userId: fixture.user.id
            });
            await fixture.provider.chargeBack({ chargeId });
            const pool = getServiceTestPool();
            await pool.query(`
                CREATE FUNCTION test_skip_chargeback_suspension_update()
                RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF NEW.status = 'SUSPENDED' THEN RETURN NULL; END IF;
                    RETURN NEW;
                END
                $$
            `);
            await pool.query(`
                CREATE TRIGGER test_skip_chargeback_suspension_update
                BEFORE UPDATE OF status ON subscription
                FOR EACH ROW EXECUTE FUNCTION test_skip_chargeback_suspension_update()
            `);
            try {
                const result = await createChargebackDetection({
                    markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
                    suspension: createChargebackSuspension({
                        provider: fixture.provider,
                        clock: fixture.clock,
                        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                        coverageNotices: fixture.coverageNotices,
                        orphanhood: orphanPorts(getServiceTestDb()).ports
                    })
                }).detect({
                    payment: await paymentOfCharge(chargeId),
                    actor: 'provider',
                    correlationId: crypto.randomUUID()
                });
                expect(result.suspension).toMatchObject({
                    outcome: 'NOT_APPLICABLE',
                    reason: 'LOST_RACE'
                });
                const [row] = await getServiceTestDb()
                    .select({ status: subscriptions.status })
                    .from(subscriptions)
                    .where(eq(subscriptions.id, successor.subscriptionId));
                expect(row?.status).toBe('PENDING_AUTHORIZATION');
            } finally {
                await pool.query(
                    'DROP TRIGGER test_skip_chargeback_suspension_update ON subscription'
                );
                await pool.query('DROP FUNCTION test_skip_chargeback_suspension_update()');
            }
        });
    }
);
