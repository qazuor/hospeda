import { emailOutbox, eq, payments, providerLinks, subscriptions, users } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { expireLapsedPayments } from '../../../src/services/billing/payment/expire-lapsed-payments.service.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { createPendingFirstChargeDeclineCheck } from '../../../src/services/billing/reconciliation/sweep/pending-first-charge-check.js';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service.js';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { paymentFixture } from './support/payment-fixtures.js';
import { successorGraceFixture } from './support/successor-grace-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };
const notice = { beforeCancel: vi.fn(async () => 'SENT' as const) };

async function signup() {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `hos1734-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1734',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Missing user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `hos1734-${crypto.randomUUID()}`, 'Plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('Missing plan');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1_000_000_000)]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('Missing version');
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error('Missing option');
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const started = await startSubscription(
        { userId: user.id, billingOptionId: optionId, returnUrl: 'https://example.test' },
        {
            provider,
            clock,
            beforeCancelNotice: notice,
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    const charge = await provider.declineCharge({
        authorizationId: started.authorizationId,
        declineReason: 'cc_rejected_insufficient_amount'
    });
    return { provider, started, chargeId: charge.chargeId, user };
}

function ports(provider: FakePaymentProvider) {
    return {
        provider,
        clock,
        beforeCancelNotice: notice,
        cancellationSeen: providerLinkCancellationSeen,
        payments: creditedPaymentsFromLedger
    };
}

describe('TEST:1734 rejected charge edges', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1734:2 applies P8 after S16, S4, and to a non-live row',
        async () => {
            const active = await paymentFixture();
            const activeCharge = await active.provider.declineCharge({
                authorizationId: active.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const activeResult = await recordChargeFact(
                { chargeId: activeCharge.chargeId },
                {
                    provider: active.provider,
                    clock: active.clock,
                    beforeCancelNotice: notice,
                    cancellationSeen: providerLinkCancellationSeen,
                    payments: creditedPaymentsFromLedger
                }
            );
            expect(activeResult.outcome).toBe('DECLINED');
            const [activePayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, activeCharge.chargeId));
            expect(activePayment).toMatchObject({ status: 'FAILED', version: 2 });

            const successor = await successorGraceFixture();
            const successorCharge = await successor.provider.declineCharge({
                authorizationId: successor.successorAuthorizationId,
                declineReason: 'issuer_declined'
            });
            const successorResult = await recordChargeFact(
                { chargeId: successorCharge.chargeId },
                successor.ports
            );
            expect(successorResult).toMatchObject({
                outcome: 'GRACE',
                grace: { outcome: 'GRACE_STARTED' },
                terminalRejection: { outcome: 'FAILED' }
            });
            const [successorPayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, successorCharge.chargeId));
            expect(successorPayment).toMatchObject({ status: 'FAILED', version: 2 });

            const dead = await paymentFixture();
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'CANCELLED' })
                .where(eq(subscriptions.id, dead.started.subscriptionId));
            const deadCharge = await dead.provider.declineCharge({
                authorizationId: dead.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const deadResult = await recordChargeFact(
                { chargeId: deadCharge.chargeId },
                {
                    provider: dead.provider,
                    clock: dead.clock,
                    beforeCancelNotice: notice,
                    payments: creditedPaymentsFromLedger
                }
            );
            expect(deadResult).toMatchObject({
                outcome: 'GRACE',
                grace: { outcome: 'NOT_APPLICABLE' },
                terminalRejection: { outcome: 'FAILED' }
            });
            const [deadPayment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, deadCharge.chargeId));
            expect(deadPayment).toMatchObject({ status: 'FAILED', version: 2 });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1734:3 keeps a retryable rejected cycle pending, credits its same id, and retains P2',
        async () => {
            const retry = await graceWithFailedCycle({ approveOnAttempt: 2 });
            const [pending] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, retry.chargeId));
            expect(pending).toMatchObject({ status: 'PENDING', version: 1 });
            retry.advanceToAttempt(2);
            const credited = await recordChargeFact({ chargeId: retry.chargeId }, retry.ports);
            expect(credited).toMatchObject({
                outcome: 'CREDITED',
                credit: { outcome: 'CREDITED' }
            });
            const [succeeded] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, retry.chargeId));
            expect(succeeded?.status).toBe('SUCCEEDED');

            const expires = await graceWithFailedCycle();
            const read = await expires.provider.readCharge({ chargeId: expires.chargeId });
            expires.clock.advance({
                ms: Date.parse(read.snapshot.expiresAt ?? '') - expires.clock.now().getTime() + 1
            });
            const summary = await expireLapsedPayments({}, expires);
            const [failed] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, expires.chargeId));
            expect(summary.failed).toBeGreaterThanOrEqual(1);
            expect(failed?.status).toBe('FAILED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1734:4 leaves pending charges pending',
        async () => {
            const fixture = await paymentFixture({ honestM8: false });
            const pendingCharge = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            expect(
                (
                    await recordChargeFact(
                        { chargeId: pendingCharge.chargeId },
                        {
                            provider: fixture.provider,
                            clock: fixture.clock,
                            beforeCancelNotice: notice
                        }
                    )
                ).outcome
            ).toBe('RECORDED_PENDING');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, pendingCharge.chargeId));
            expect(payment).toMatchObject({ status: 'PENDING', version: 1 });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1734:5 makes duplicate rejection delivery idempotent',
        async () => {
            const own = await signup();
            await own.provider.cancel({ authorizationId: own.started.authorizationId });
            const first = await recordChargeFact({ chargeId: own.chargeId }, ports(own.provider));
            if (first.outcome !== 'DECLINED') throw new Error('Expected declined result');
            const second = await recordChargeFact({ chargeId: own.chargeId }, ports(own.provider));
            expect(second).toMatchObject({ terminalRejection: { outcome: 'NOT_PENDING' } });
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, first.paymentId));
            expect(payment).toMatchObject({ status: 'FAILED', version: 2 });
            const mail = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, own.user.id));
            expect(
                mail.filter(
                    (row) =>
                        row.template === 'billing.signup-declined' &&
                        (row.payload as { subscriptionId?: string }).subscriptionId ===
                            own.started.subscriptionId
                )
            ).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1734:6 reconciliation finds the failed fact after cancellation',
        async () => {
            const own = await signup();
            const first = await recordChargeFact({ chargeId: own.chargeId }, ports(own.provider));
            expect(first).toMatchObject({
                outcome: 'DECLINED',
                decline: { outcome: 'NOT_APPLICABLE', reason: 'AUTHORIZATION_NOT_CANCELLED' },
                terminalRejection: { outcome: 'FAILED' }
            });
            await own.provider.cancel({ authorizationId: own.started.authorizationId });
            const [row] = await getServiceTestDb()
                .select({ subscription: subscriptions, providerLink: providerLinks })
                .from(providerLinks)
                .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
                .where(eq(subscriptions.id, own.started.subscriptionId));
            if (!row) throw new Error('Missing signup row');
            const act = { kind: 'decision' as const, startedAt: clock.now() };
            const read = await own.provider.readAuthorization({
                authorizationId: own.started.authorizationId
            });
            await createPendingFirstChargeDeclineCheck(ports(own.provider))({ ...row, act, read });
            const [after] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, own.started.subscriptionId));
            expect(after?.status).toBe('CHARGE_DECLINED');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())('TEST:1734:7 runs P8 after S16 succeeds', async () => {
        const own = await signup();
        let shouldFail = true;
        const provider = {
            capabilitySupport: own.provider.capabilitySupport,
            authorize: (input: Parameters<PaymentProvider['authorize']>[0]) =>
                own.provider.authorize(input),
            charge: (input: Parameters<PaymentProvider['charge']>[0]) => own.provider.charge(input),
            changeAmount: (input: Parameters<PaymentProvider['changeAmount']>[0]) =>
                own.provider.changeAmount(input),
            pause: (input: Parameters<PaymentProvider['pause']>[0]) => own.provider.pause(input),
            resume: (input: Parameters<PaymentProvider['resume']>[0]) => own.provider.resume(input),
            cancel: (input: Parameters<PaymentProvider['cancel']>[0]) => own.provider.cancel(input),
            refund: (input: Parameters<PaymentProvider['refund']>[0]) => own.provider.refund(input),
            readAuthorization: (input: Parameters<PaymentProvider['readAuthorization']>[0]) => {
                if (shouldFail) {
                    shouldFail = false;
                    throw new Error('injected authorization read failure');
                }
                return own.provider.readAuthorization(input);
            },
            searchAuthorizations: (input: Parameters<PaymentProvider['searchAuthorizations']>[0]) =>
                own.provider.searchAuthorizations(input),
            readCharge: (input: Parameters<PaymentProvider['readCharge']>[0]) =>
                own.provider.readCharge(input),
            listCharges: (input: Parameters<PaymentProvider['listCharges']>[0]) =>
                own.provider.listCharges(input),
            readOrder: (input: Parameters<PaymentProvider['readOrder']>[0]) =>
                own.provider.readOrder(input),
            searchOrders: (input: Parameters<PaymentProvider['searchOrders']>[0]) =>
                own.provider.searchOrders(input),
            decodeNotice: (input: Parameters<PaymentProvider['decodeNotice']>[0]) =>
                own.provider.decodeNotice(input)
        } satisfies PaymentProvider;
        await expect(
            recordChargeFact({ chargeId: own.chargeId }, { ...ports(own.provider), provider })
        ).rejects.toThrow('injected authorization read failure');
        const [pending] = await getServiceTestDb()
            .select()
            .from(payments)
            .where(eq(payments.providerFactId, own.chargeId));
        expect(pending).toMatchObject({ status: 'PENDING', version: 1 });
        const result = await recordChargeFact(
            { chargeId: own.chargeId },
            { ...ports(own.provider), provider }
        );
        expect(result).toMatchObject({
            outcome: 'DECLINED',
            terminalRejection: { outcome: 'FAILED' }
        });
    });
});
