import {
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    coverageLosses,
    type DrizzleClient,
    emailOutbox,
    eq,
    reconciliationMarkPayments,
    subscriptions
} from '@repo/db';
import { getLocalDateString } from '@repo/utils';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger';
import { runCreditedPaymentsCheck } from '../../../src/services/billing/reconciliation/sweep/credited-payments-check';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service';
import { endScheduledServices } from '../../../src/services/billing/subscription/end-scheduled-services.service';
import { applyS12ByChargeback } from '../../../src/services/billing/subscription/service-end-s12-chargeback';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers';
import { orphanPorts } from './support/addon-orphan-fixtures';
import {
    approvedCharge,
    chargebackFixture,
    chargebackMarks,
    paymentOfCharge,
    recordCharge,
    retireChargebackFixtures
} from './support/chargeback-fixtures';
import {
    pendingSuccessor,
    retireServiceEndSuccessors,
    s12ChargebackPorts,
    scheduledChargebackDetection,
    scheduledChargebackFixture
} from './support/service-end-chargeback-fixtures';
import { noTouristVip } from './support/tourist-vip';

const correlationId = () => crypto.randomUUID();
afterEach(async () => {
    await retireServiceEndSuccessors();
    await retireChargebackFixtures();
});
afterAll(closeServiceTestPool);

describe('TEST:B8a:7 AC:B8a:7 S12 on a reread charged-back payment', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'does not apply its second event to an ACTIVE principal',
        async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            await recordCharge(fixture, chargeId);
            const payment = await paymentOfCharge(chargeId);
            await fixture.provider.chargeBack({ chargeId });
            const result = await applyS12ByChargeback(
                {
                    subscriptionId: fixture.started.subscriptionId,
                    paymentId: payment.id,
                    now: fixture.clock.now()
                },
                s12ChargebackPorts({ fixture })
            );
            expect(result).toEqual({
                outcome: 'NOT_APPLICABLE',
                subscriptionId: fixture.started.subscriptionId
            });
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(row?.status).toBe('ACTIVE');
        }
    );
    it.skipIf(!isServiceTestDbAvailable())(
        'ends before S11 date, opens reason 17, sends one mail and makes no new provider call',
        async () => {
            const { fixture, chargeId, payment, scheduled } = await scheduledChargebackFixture();
            const mutations = [
                vi.spyOn(fixture.provider, 'authorize'),
                vi.spyOn(fixture.provider, 'charge'),
                vi.spyOn(fixture.provider, 'chargeOnce'),
                vi.spyOn(fixture.provider, 'changeAmount'),
                vi.spyOn(fixture.provider, 'pause'),
                vi.spyOn(fixture.provider, 'resume'),
                vi.spyOn(fixture.provider, 'cancel'),
                vi.spyOn(fixture.provider, 'refund'),
                vi.spyOn(fixture.provider, 'refundOrder')
            ];
            const authorizationBefore = await fixture.provider.readAuthorization({
                authorizationId: fixture.started.authorizationId
            });
            const now = fixture.clock.now();
            const result = await recordCharge(fixture, chargeId, {
                chargebacks: scheduledChargebackDetection({ fixture })
            });
            expect(result.outcome).toBe('CHARGEBACK_DETECTED');
            const db = getServiceTestDb();
            const [row] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(row?.status).toBe('CANCELLED');
            expect(row?.serviceEndsAt).toEqual(now);
            expect(row?.serviceEndsAt?.getTime()).toBeLessThan(scheduled.serviceEndsAt.getTime());
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(marks[0]?.liftedAt).toBeNull();
            const hung = await db
                .select({ paymentId: reconciliationMarkPayments.paymentId })
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, marks[0]!.id));
            expect(hung).toEqual([{ paymentId: payment.id }]);
            const mails = await db
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, fixture.user.id),
                        eq(emailOutbox.template, 'billing.chargeback-suspension')
                    )
                );
            expect(mails).toHaveLength(1);
            expect(mails[0]).toMatchObject({
                recipientEmail: fixture.user.email,
                dedupKey: buildEmailDedupKey({
                    recipient: fixture.user.id,
                    template: 'billing.chargeback-suspension',
                    occurrence: buildEventOccurrence({ eventId: payment.id })
                }),
                payload: {
                    chargedBackPayment: {
                        amountMinor: payment.amount,
                        currency: payment.currency,
                        chargedOn: getLocalDateString({
                            instant: payment.factAt,
                            timeZone: 'Etc/GMT+4'
                        })
                    },
                    courtesyEnded: false,
                    origin: 'CANCEL_SCHEDULED'
                }
            });
            const [loss] = await db
                .select()
                .from(coverageLosses)
                .where(
                    and(
                        eq(coverageLosses.userId, fixture.user.id),
                        eq(coverageLosses.vertical, 'accommodation')
                    )
                );
            expect(loss?.lostAt).toEqual(now);
            for (const mutation of mutations) expect(mutation).toHaveBeenCalledTimes(0);
            const authorization = await fixture.provider.readAuthorization({
                authorizationId: fixture.started.authorizationId
            });
            expect(authorization.snapshot).toEqual(authorizationBefore.snapshot);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'retries S12 on ALREADY_MARKED without a second mail or mark',
        async () => {
            const { fixture, payment } = await scheduledChargebackFixture();
            const detection = scheduledChargebackDetection({ fixture });
            const input = { payment, actor: 'job' as const, correlationId: correlationId() };
            expect((await detection.detect(input)).serviceEnd?.outcome).toBe('CANCELLED');
            const second = await detection.detect(input);
            expect(second).toMatchObject({
                outcome: 'ALREADY_MARKED',
                serviceEnd: { outcome: 'ALREADY_CANCELLED' }
            });
            expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(1);
            const mails = await getServiceTestDb()
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, fixture.user.id),
                        eq(emailOutbox.template, 'billing.chargeback-suspension')
                    )
                );
            expect(mails).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'keeps mark-only behavior without the S12 port',
        async () => {
            const { fixture, payment } = await scheduledChargebackFixture();
            const { createChargebackDetection } = await import(
                '../../../src/services/billing/reconciliation/chargeback/chargeback-detection'
            );
            const { createPaymentReconciliationMarkPayments } = await import(
                '../../../src/services/billing/payment/payment-ledger'
            );
            const result = await createChargebackDetection({
                markPayments: createPaymentReconciliationMarkPayments(fixture.clock)
            }).detect({ payment, actor: 'job', correlationId: correlationId() });
            expect(result.outcome).toBe('MARKED');
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(row?.status).toBe('CANCEL_SCHEDULED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'cuts a real pending successor through S31',
        async () => {
            const seeded = await scheduledChargebackFixture({ chargeBack: false });
            const successor = await pendingSuccessor(seeded);
            await seeded.fixture.provider.chargeBack({ chargeId: seeded.chargeId });
            const result = await scheduledChargebackDetection({ fixture: seeded.fixture }).detect({
                payment: seeded.payment,
                actor: 'job',
                correlationId: correlationId()
            });
            expect(result.serviceEnd?.outcome).toBe('CANCELLED');
            const rows = await getServiceTestDb()
                .select({
                    id: subscriptions.id,
                    status: subscriptions.status,
                    succeedsId: subscriptions.succeedsId
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, successor.subscriptionId));
            // S18 clears succeedsId (subscription-succession-close-s18.test.ts); S12's
            // chargeback event leaves that link for S31's abandoned successor.
            expect(rows).toEqual([
                {
                    id: successor.subscriptionId,
                    status: 'ABANDONED',
                    succeedsId: seeded.fixture.started.subscriptionId
                }
            ]);
            const [predecessor] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.fixture.started.subscriptionId));
            expect(predecessor?.status).toBe('CANCELLED');
            expect(predecessor?.succeededById).toBe(successor.subscriptionId);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'calls the S31 interface inside the S12 transaction',
        async () => {
            const seeded = await scheduledChargebackFixture({ chargeBack: false });
            await pendingSuccessor(seeded);
            await seeded.fixture.provider.chargeBack({ chargeId: seeded.chargeId });
            const cutSuccessor = vi.fn(
                async ({
                    predecessorSubscriptionId,
                    tx
                }: {
                    readonly predecessorSubscriptionId: string;
                    readonly tx: DrizzleClient;
                }) => {
                    const [row] = await tx
                        .select({ status: subscriptions.status })
                        .from(subscriptions)
                        .where(eq(subscriptions.id, predecessorSubscriptionId));
                    expect(row?.status).toBe('CANCELLED');
                    return { outcome: 'NO_LIVE_SUCCESSOR' as const };
                }
            );
            await scheduledChargebackDetection({
                fixture: seeded.fixture,
                successorCutter: { cutSuccessor }
            }).detect({
                payment: seeded.payment,
                actor: 'job',
                correlationId: correlationId()
            });
            expect(cutSuccessor).toHaveBeenCalledTimes(1);
            expect(cutSuccessor).toHaveBeenCalledWith(
                expect.objectContaining({
                    predecessorSubscriptionId: seeded.fixture.started.subscriptionId,
                    tx: expect.any(Object)
                })
            );
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'cuts a service-activated ACTIVE successor through S31',
        async () => {
            const seeded = await scheduledChargebackFixture({ chargeBack: false });
            const successor = await pendingSuccessor(seeded);
            await seeded.fixture.provider.approve({ authorizationId: successor.authorizationId });
            const activated = await activateSubscription(successor.subscriptionId, {
                provider: seeded.fixture.provider,
                clock: seeded.fixture.clock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                touristVipInheritance: noTouristVip,
                coverageNotices: seeded.fixture.coverageNotices
            });
            expect(activated.activated).toBe(true);
            const [before] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.fixture.started.subscriptionId));
            expect(before?.status).toBe('CANCEL_SCHEDULED');
            expect(before?.succeededById).toBe(successor.subscriptionId);
            await seeded.fixture.provider.chargeBack({ chargeId: seeded.chargeId });
            const result = await scheduledChargebackDetection({ fixture: seeded.fixture }).detect({
                payment: seeded.payment,
                actor: 'job',
                correlationId: correlationId()
            });
            expect(result.serviceEnd?.outcome).toBe('CANCELLED');
            const [after] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, successor.subscriptionId));
            expect(after?.status).toBe('CANCELLED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'ends the same scheduled row through the credited-payments sweep',
        async () => {
            const seeded = await scheduledChargebackFixture();
            await runCreditedPaymentsCheck(
                { correlationId: correlationId(), pageSize: 100 },
                {
                    provider: seeded.fixture.provider,
                    clock: seeded.fixture.clock,
                    markPayments: createPaymentReconciliationMarkPayments(seeded.fixture.clock),
                    chargebacks: scheduledChargebackDetection({ fixture: seeded.fixture })
                }
            );
            const [row] = await getServiceTestDb()
                .select({
                    status: subscriptions.status,
                    serviceEndsAt: subscriptions.serviceEndsAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.fixture.started.subscriptionId));
            expect(row).toEqual({ status: 'CANCELLED', serviceEndsAt: seeded.fixture.clock.now() });
            expect(await chargebackMarks(seeded.fixture.started.subscriptionId)).toHaveLength(1);
            const [mail] = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, seeded.fixture.user.id),
                        eq(emailOutbox.template, 'billing.chargeback-suspension')
                    )
                );
            expect(mail?.payload).toMatchObject({
                chargedBackPayment: {
                    amountMinor: seeded.payment.amount,
                    currency: seeded.payment.currency,
                    chargedOn: getLocalDateString({
                        instant: seeded.payment.factAt,
                        timeZone: 'Etc/GMT+4'
                    })
                }
            });
            const [loss] = await getServiceTestDb()
                .select()
                .from(coverageLosses)
                .where(
                    and(
                        eq(coverageLosses.userId, seeded.fixture.user.id),
                        eq(coverageLosses.vertical, 'accommodation')
                    )
                );
            expect(loss?.lostAt).toEqual(seeded.fixture.clock.now());
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'serializes two chargeback reads on the same row lock',
        async () => {
            const seeded = await scheduledChargebackFixture();
            let entered!: () => void;
            let release!: () => void;
            const insideCut = new Promise<void>((resolve) => {
                entered = resolve;
            });
            const held = new Promise<void>((resolve) => {
                release = resolve;
            });
            const cutSuccessor = vi.fn(async () => {
                entered();
                await held;
                return { outcome: 'NO_LIVE_SUCCESSOR' as const };
            });
            const detection = scheduledChargebackDetection({
                fixture: seeded.fixture,
                successorCutter: { cutSuccessor }
            });
            const input = {
                payment: seeded.payment,
                actor: 'job' as const,
                correlationId: correlationId()
            };
            const first = detection.detect(input);
            await insideCut;
            const second = detection.detect(input);
            let observedLock = false;
            try {
                for (let attempt = 0; attempt < 40; attempt++) {
                    const activity = await getServiceTestPool().query<{ count: string }>(
                        "SELECT count(*)::text AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%subscription%'"
                    );
                    if (Number(activity.rows[0]?.count) > 0) {
                        observedLock = true;
                        break;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
            } finally {
                release();
            }
            const [one, two] = await Promise.all([first, second]);
            expect(observedLock).toBe(true);
            expect(one.serviceEnd?.outcome).toBe('CANCELLED');
            expect(two.serviceEnd?.outcome).toBe('ALREADY_CANCELLED');
            expect(cutSuccessor).toHaveBeenCalledTimes(1);
            expect(await chargebackMarks(seeded.fixture.started.subscriptionId)).toHaveLength(1);
            const mails = await getServiceTestDb()
                .select({ id: emailOutbox.id })
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, seeded.fixture.user.id),
                        eq(emailOutbox.template, 'billing.chargeback-suspension')
                    )
                );
            expect(mails).toHaveLength(1);
        },
        30_000
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'only marks a chargeback after the first S12 event already cancelled the row',
        async () => {
            const seeded = await scheduledChargebackFixture({ chargeBack: false });
            const advanceMs =
                seeded.scheduled.serviceEndsAt.getTime() -
                seeded.fixture.clock.now().getTime() +
                1000;
            seeded.fixture.clock.advance({ ms: advanceMs });
            const orphanhood = orphanPorts(getServiceTestDb()).ports;
            await endScheduledServices(
                { limit: 100 },
                {
                    ...orphanhood,
                    clock: seeded.fixture.clock,
                    provider: seeded.fixture.provider,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
                    coverageNotices: seeded.fixture.coverageNotices
                }
            );
            const [before] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.fixture.started.subscriptionId));
            expect(before?.status).toBe('CANCELLED');
            await seeded.fixture.provider.chargeBack({ chargeId: seeded.chargeId });
            const result = await scheduledChargebackDetection({ fixture: seeded.fixture }).detect({
                payment: seeded.payment,
                actor: 'job',
                correlationId: correlationId()
            });
            expect(result.outcome).toBe('MARKED');
            const [after] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.fixture.started.subscriptionId));
            expect(after?.serviceEndsAt).toEqual(before?.serviceEndsAt);
            const mails = await getServiceTestDb()
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, seeded.fixture.user.id));
            expect(mails.map(({ template }) => template).sort()).toEqual([
                'billing.payment-credited',
                'billing.signup-confirmed'
            ]);
            expect(await chargebackMarks(seeded.fixture.started.subscriptionId)).toHaveLength(1);
        }
    );
});
