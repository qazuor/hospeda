/**
 * HOS-1883: a COMPLEMENTO charge first read `pending` and later rejected inside its retry window
 * emits `addon_charge_declined` exactly once, from the call that set `rejection_observed_at`
 * (P-3'), with or without a provider reason; so does a terminal rejection on first sight. A
 * redelivery and a later cron pass emit nothing more; pending then approved emits no decline.
 * The fake never turns a pending charge into a rejected one, so the provider's read is rewritten
 * for the reads after the first, as MercadoPago would answer them.
 */
import { addonProducts, eq, payments } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service';
import { settleChargedPeriod } from '../../../src/services/billing/reconciliation/sweep/grace-expiry-check';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { addonFactSpy, addonFactSubjectOf } from './support/addon-fact-subject';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { retireWithdrawalFixtures, withdrawalFixture } from './support/addon-withdrawal-fixtures';

const HOUR = 3_600_000;
const REASON = 'cc_rejected_insufficient_amount';

afterEach(async () => {
    vi.restoreAllMocks();
    await retireWithdrawalFixtures();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

type Fixture = Awaited<ReturnType<typeof withdrawalFixture>>;

/** The fake, answering every read rejected with an open retry window once `state.rejected`. */
function rejectingLater(
    s: Fixture,
    state: { rejected: boolean; readonly reason: string | null }
): PaymentProvider {
    const fake = s.f.fake;
    return new Proxy(fake, {
        get(target, property, receiver) {
            if (property === 'readCharge')
                return async (input: Parameters<PaymentProvider['readCharge']>[0]) => {
                    const read = await target.readCharge(input);
                    if (!state.rejected) return read;
                    const retryUntil = new Date(s.f.ports.clock.now().getTime() + 10 * 24 * HOUR);
                    return {
                        ...read,
                        snapshot: {
                            ...read.snapshot,
                            status: 'rejected',
                            declineReason: state.reason,
                            expiresAt: retryUntil.toISOString()
                        }
                    };
                };
            const value = Reflect.get(target, property, receiver);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
}

function chargePorts(
    s: Fixture,
    provider: PaymentProvider,
    sink: ReturnType<typeof addonFactSpy>['sink']
) {
    return {
        provider,
        clock: s.f.ports.clock,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => {} },
        complements: s.f.ports,
        billingFacts: sink
    };
}

async function pendingCharge(s: Fixture) {
    if (!s.authorizationId) throw new Error('Preapproval missing');
    const { subject, instance } = await addonFactSubjectOf({ instanceId: s.instanceId });
    const [product] = await getServiceTestDb()
        .select({ price: addonProducts.price })
        .from(addonProducts)
        .where(eq(addonProducts.id, instance.productId));
    if (!product) throw new Error('Product missing');
    const { chargeId } = await s.f.fake.charge({
        authorizationId: s.authorizationId,
        amount: { amountMinor: product.price, currency: 'ARS' },
        reference: `${s.instanceId}-retry`
    });
    return { chargeId, subject, price: product.price };
}

describe.skipIf(!isServiceTestDbAvailable())('HOS-1883 add-on facts: pending then rejected', () => {
    it('pending then rejected with a retry window emits one addon_charge_declined; a redelivery and a cron pass emit nothing more', async () => {
        // Arrange
        const s = await withdrawalFixture();
        const { chargeId, subject, price } = await pendingCharge(s);
        const state = { rejected: false, reason: REASON };
        const spy = addonFactSpy();
        const ports = chargePorts(s, rejectingLater(s, state), spy.sink);

        // Act
        const pending = await recordChargeFact({ chargeId }, ports);
        state.rejected = true;
        const rejected = await recordChargeFact({ chargeId }, ports);
        const redelivery = await recordChargeFact({ chargeId }, ports);
        const cronPass = await settleChargedPeriod({ chargeId }, ports);

        // Assert
        expect(pending.outcome).toBe('RECORDED_PENDING');
        expect(rejected.outcome).not.toBe('RECORDED_PENDING');
        expect(redelivery.outcome).toBe(rejected.outcome);
        expect(cronPass.outcome).toBe(rejected.outcome);
        const paymentId = 'paymentId' in pending ? pending.paymentId : '';
        const [payment] = await getServiceTestDb()
            .select()
            .from(payments)
            .where(eq(payments.id, paymentId));
        // The retry window keeps the payment open, as before (P2 closes it at expiry).
        expect(payment?.status).toBe('PENDING');
        expect(payment?.providerStatusDetail).toBe(REASON);
        expect(payment?.rejectionObservedAt).toEqual(s.f.ports.clock.now());
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CHARGE_REJECTED',
                ...subject,
                actorKind: 'SYSTEM',
                occurredAt: payment?.factAt,
                paymentId,
                amountMinor: price,
                currency: 'ARS',
                isFirstCharge: true,
                hasRetryWindow: true
            }
        ]);
    });

    it('pending then rejected WITHOUT a provider reason emits one addon_charge_declined; a redelivery and a cron pass emit nothing more', async () => {
        // Arrange
        const s = await withdrawalFixture();
        const { chargeId, subject, price } = await pendingCharge(s);
        const state = { rejected: false, reason: null };
        const spy = addonFactSpy();
        const ports = chargePorts(s, rejectingLater(s, state), spy.sink);

        // Act
        const pending = await recordChargeFact({ chargeId }, ports);
        state.rejected = true;
        await recordChargeFact({ chargeId }, ports);
        await recordChargeFact({ chargeId }, ports);
        await settleChargedPeriod({ chargeId }, ports);

        // Assert
        expect(pending.outcome).toBe('RECORDED_PENDING');
        const paymentId = 'paymentId' in pending ? pending.paymentId : '';
        const [payment] = await getServiceTestDb()
            .select()
            .from(payments)
            .where(eq(payments.id, paymentId));
        expect(payment?.status).toBe('PENDING');
        expect(payment?.providerStatusDetail).toBeNull();
        expect(payment?.rejectionObservedAt).toEqual(s.f.ports.clock.now());
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CHARGE_REJECTED',
                ...subject,
                actorKind: 'SYSTEM',
                occurredAt: payment?.factAt,
                paymentId,
                amountMinor: price,
                currency: 'ARS',
                isFirstCharge: true,
                hasRetryWindow: true
            }
        ]);
    });

    it('a charge rejected terminally on first sight emits one addon_charge_declined; a redelivery emits nothing more', async () => {
        // Arrange: the first charge record has no retry window (RC-7), so the rejection is terminal.
        const s = await withdrawalFixture();
        if (!s.authorizationId) throw new Error('Preapproval missing');
        const { subject, instance } = await addonFactSubjectOf({ instanceId: s.instanceId });
        const { chargeId } = await s.f.fake.declineCharge({
            authorizationId: s.authorizationId,
            declineReason: REASON
        });
        const spy = addonFactSpy();
        const ports = chargePorts(s, s.f.fake, spy.sink);

        // Act
        const first = await recordChargeFact({ chargeId }, ports);
        const redelivery = await recordChargeFact({ chargeId }, ports);

        // Assert
        expect('terminalRejection' in first && first.terminalRejection?.outcome).toBe('FAILED');
        expect(redelivery.outcome).toBe(first.outcome);
        const paymentId = 'paymentId' in first ? first.paymentId : '';
        const [payment] = await getServiceTestDb()
            .select()
            .from(payments)
            .where(eq(payments.id, paymentId));
        const [product] = await getServiceTestDb()
            .select({ price: addonProducts.price })
            .from(addonProducts)
            .where(eq(addonProducts.id, instance.productId));
        expect(payment?.status).toBe('FAILED');
        expect(payment?.rejectionObservedAt).toEqual(s.f.ports.clock.now());
        expect(spy.addonFacts()).toEqual([
            {
                kind: 'ADDON_CHARGE_REJECTED',
                ...subject,
                actorKind: 'SYSTEM',
                occurredAt: payment?.factAt,
                paymentId,
                amountMinor: product?.price,
                currency: 'ARS',
                isFirstCharge: true,
                hasRetryWindow: false
            }
        ]);
    });

    it('pending then approved emits no addon_charge_declined', async () => {
        // Arrange
        const s = await withdrawalFixture();
        const { chargeId } = await pendingCharge(s);
        const spy = addonFactSpy();
        const ports = chargePorts(s, s.f.fake, spy.sink);

        // Act
        const pending = await recordChargeFact({ chargeId }, ports);
        // M8: the charge lands in the batch after the hour it was asked.
        s.f.advanceTo(new Date(s.f.ports.clock.now().getTime() + 2 * HOUR));
        const approved = await recordChargeFact({ chargeId }, ports);

        // Assert
        expect(pending.outcome).toBe('RECORDED_PENDING');
        expect(approved.outcome).toBe('CREDITED');
        expect(spy.addonFacts().map(({ kind }) => kind)).toEqual(['ADDON_CHARGE_CREDITED']);
        const paymentId = 'paymentId' in pending ? pending.paymentId : '';
        const [payment] = await getServiceTestDb()
            .select({ rejectionObservedAt: payments.rejectionObservedAt })
            .from(payments)
            .where(eq(payments.id, paymentId));
        expect(payment).toEqual({ rejectionObservedAt: null });
    });
});
