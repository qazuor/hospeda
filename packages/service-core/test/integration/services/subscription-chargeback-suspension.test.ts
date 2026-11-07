import {
    and,
    emailOutbox,
    eq,
    isNull,
    payments,
    providerLinks,
    reconciliationMarkPayments,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger';
import {
    createChargebackDetection,
    createChargebackSuspension
} from '../../../src/services/billing/reconciliation/chargeback/chargeback-detection';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service';
import { writeChargebackSuspension } from '../../../src/services/billing/subscription/suspend-for-chargeback-write';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { orphanPorts } from './support/addon-orphan-fixtures';
import type { ChargebackFixture } from './support/chargeback-fixtures';
import {
    approvedCharge,
    chargebackFixture,
    chargebackGraceFixture,
    chargebackMarks,
    paymentOfCharge,
    recordCharge,
    retireChargebackFixtures
} from './support/chargeback-fixtures';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice';

const emptyComplements = {
    addonPolicy: async () => {
        throw new Error('No addon expected');
    },
    listing: async () => {
        throw new Error('No listing expected');
    }
};

afterEach(retireChargebackFixtures);
afterAll(closeServiceTestPool);

function detectionFor(fixture: ChargebackFixture, deliver: boolean) {
    return createChargebackDetection({
        markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
        suspension: createChargebackSuspension({
            provider: fixture.provider,
            clock: fixture.clock,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver }),
            coverageNotices: fixture.coverageNotices,
            orphanhood: orphanPorts(getServiceTestDb()).ports
        })
    });
}

describe('TEST:B7:7 AC:B7:10 chargeback S6 on a real credited payment', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'suspends ACTIVE, cancels the fake preapproval and emits its own notice',
        async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            expect((await recordCharge(fixture, chargeId)).outcome).toBe('CREDITED');
            const payment = await paymentOfCharge(chargeId);
            await fixture.provider.chargeBack({ chargeId });
            const detection = detectionFor(fixture, true);
            const result = await detection.detect({
                payment,
                actor: 'provider',
                correlationId: crypto.randomUUID()
            });
            expect(result.outcome).toBe('MARKED');
            expect(result.suspension?.outcome).toBe('SUSPENDED');
            const [subscription] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(subscription?.status).toBe('SUSPENDED');
            expect(subscription?.graceStartedAt).toEqual(subscription?.graceEndsAt);
            const [link] = await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, fixture.started.subscriptionId));
            expect(link?.providerId).toBeDefined();
            const authorization = await fixture.provider.readAuthorization({
                authorizationId: link!.providerId
            });
            expect(authorization.snapshot.status).toBe('cancelled');
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(marks[0]?.liftedAt).toBeNull();
            const hung = await getServiceTestDb()
                .select({ paymentId: reconciliationMarkPayments.paymentId })
                .from(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, marks[0]!.id));
            expect(hung.map((row) => row.paymentId)).toEqual([payment.id]);
            const mails = await getServiceTestDb()
                .select({ template: emailOutbox.template, payload: emailOutbox.payload })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(mails.map((row) => row.template).sort()).toEqual([
                'billing.chargeback-suspension',
                'billing.payment-credited',
                'billing.signup-confirmed'
            ]);
            expect(
                mails.find((row) => row.template === 'billing.chargeback-suspension')?.payload
            ).toMatchObject({
                chargedBackPayment: { amountMinor: payment.amount, currency: payment.currency },
                courtesyEnded: false
            });
            const [unchangedPayment] = await getServiceTestDb()
                .select({ status: payments.status })
                .from(payments)
                .where(
                    and(
                        eq(payments.id, payment.id),
                        eq(payments.subscriptionId, fixture.started.subscriptionId)
                    )
                );
            expect(unchangedPayment?.status).toBe('SUCCEEDED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'retries S6 after ALREADY_MARKED and deduplicates its notice and cancellation',
        async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            expect((await recordCharge(fixture, chargeId)).outcome).toBe('CREDITED');
            const payment = await paymentOfCharge(chargeId);
            await fixture.provider.chargeBack({ chargeId });
            const cancel = vi.spyOn(fixture.provider, 'cancel');
            const input = { payment, actor: 'job' as const, correlationId: crypto.randomUUID() };
            const deferred = await detectionFor(fixture, false).detect(input);
            expect(deferred).toMatchObject({
                outcome: 'MARKED',
                suspension: { outcome: 'DEFERRED', reason: 'NOTICE_NOT_SENT' }
            });
            expect(cancel).toHaveBeenCalledTimes(0);
            const [before] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(before?.status).toBe('ACTIVE');
            const resumed = await detectionFor(fixture, true).detect(input);
            expect(resumed).toMatchObject({
                outcome: 'ALREADY_MARKED',
                suspension: { outcome: 'SUSPENDED' }
            });
            const again = await detectionFor(fixture, true).detect(input);
            expect(again).toMatchObject({
                outcome: 'ALREADY_MARKED',
                suspension: { outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_ORIGIN' }
            });
            expect(cancel).toHaveBeenCalledTimes(1);
            expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(1);
            const mails = await getServiceTestDb()
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(mails.map((row) => row.template).sort()).toEqual([
                'billing.chargeback-suspension',
                'billing.payment-credited',
                'billing.signup-confirmed'
            ]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B7:7 preserves the real S4 grace clock while S6 suspends on chargeback',
        async () => {
            const fixture = await chargebackGraceFixture();
            const chargeId = fixture.initialChargeId;
            const [before] = await getServiceTestDb()
                .select({
                    status: subscriptions.status,
                    graceStartedAt: subscriptions.graceStartedAt,
                    graceEndsAt: subscriptions.graceEndsAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(before?.status).toBe('GRACE_PERIOD');

            await fixture.provider.chargeBack({ chargeId });
            const result = await detectionFor(fixture, true).detect({
                payment: await paymentOfCharge(chargeId),
                actor: 'provider',
                correlationId: crypto.randomUUID()
            });

            const [after] = await getServiceTestDb()
                .select({
                    status: subscriptions.status,
                    graceStartedAt: subscriptions.graceStartedAt,
                    graceEndsAt: subscriptions.graceEndsAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(result.suspension?.outcome).toBe('SUSPENDED');
            expect(after).toMatchObject({
                status: 'SUSPENDED',
                graceStartedAt: before?.graceStartedAt,
                graceEndsAt: before?.graceEndsAt
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B7:7 leaves PAUSED CUSTOMER_REQUEST in place and only opens the chargeback mark',
        async () => {
            const fixture = await chargebackFixture();
            const chargeId = await approvedCharge(fixture);
            expect((await recordCharge(fixture, chargeId)).outcome).toBe('CREDITED');
            const paused = await pauseSubscription(
                { subscriptionId: fixture.started.subscriptionId, requestedMonths: 1 },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    planPolicy: async () => ({
                        graceDays: 7,
                        allowsPause: true,
                        current: true,
                        sellable: true
                    }),
                    complements: emptyComplements
                }
            );
            expect(paused.outcome).toBe('PAUSED');
            const [openPause] = await getServiceTestDb()
                .select()
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, fixture.started.subscriptionId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                );
            expect(openPause?.reason).toBe('CUSTOMER_REQUEST');

            await fixture.provider.chargeBack({ chargeId });
            const result = await detectionFor(fixture, true).detect({
                payment: await paymentOfCharge(chargeId),
                actor: 'provider',
                correlationId: crypto.randomUUID()
            });

            const [subscription] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(result.suspension).toMatchObject({
                outcome: 'NOT_APPLICABLE',
                reason: 'NOT_COURTESY_PAUSE'
            });
            expect(subscription?.status).toBe('PAUSED');
            expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(1);
            const mails = await getServiceTestDb()
                .select({ template: emailOutbox.template })
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(mails.map((row) => row.template).sort()).toEqual([
                'billing.payment-credited',
                'billing.signup-confirmed'
            ]);
            expect(openPause?.actualEndAt).toBeNull();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B7:7 rejects a real CUSTOMER_REQUEST pause inside the locked S6 write',
        async () => {
            const fixture = await chargebackFixture();
            const paused = await pauseSubscription(
                { subscriptionId: fixture.started.subscriptionId, requestedMonths: 1 },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    planPolicy: async () => ({
                        graceDays: 7,
                        allowsPause: true,
                        current: true,
                        sellable: true
                    }),
                    complements: emptyComplements
                }
            );
            expect(paused.outcome).toBe('PAUSED');

            const result = await writeChargebackSuspension({
                subscriptionId: fixture.started.subscriptionId,
                origin: 'PAUSED',
                now: fixture.clock.now(),
                readAt: fixture.clock.now(),
                clock: fixture.clock,
                orphanhood: orphanPorts(getServiceTestDb()).ports
            });
            const [subscription] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const pauses = await getServiceTestDb()
                .select({
                    reason: subscriptionPauses.reason,
                    actualEndAt: subscriptionPauses.actualEndAt
                })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, fixture.started.subscriptionId),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                );
            expect(result).toEqual({ kind: 'NOT_COURTESY_PAUSE' });
            expect(subscription?.status).toBe('PAUSED');
            expect(pauses).toEqual([{ reason: 'CUSTOMER_REQUEST', actualEndAt: null }]);
        }
    );
});
