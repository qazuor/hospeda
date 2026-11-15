import { eq, payments, refunds } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { confirmRefund } from '../../../../src/services/billing/refund/confirm-refund.service.js';
import { getServiceTestDb } from '../helpers.js';
import { refundConfirmFixture, refundConfirmRows } from './refund-confirm-fixtures.js';

/** Seeds a credited fake charge, requests RF1, and sends RF2 provider calls. */
export async function confirmedExecuteFixture(chargeAmount = 10000, refundAmount = 5000) {
    const seeded = await refundConfirmFixture(chargeAmount, refundAmount);
    const confirmation = await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider: seeded.fixture.provider }
    );
    return { ...seeded, confirmation };
}

/** Rebinds a credited fixture to a total charge with the M13 lie explicitly disabled. */
export async function totalHonestM13Fixture() {
    const seeded = await refundConfirmFixture(10000, 10000);
    const provider = new FakePaymentProvider({
        clock: seeded.fixture.clock,
        idNamespace: crypto.randomUUID(),
        honestAbout: [
            { lie: 'M1', why: 'the total-refund fixture needs the authorization to be available' },
            { lie: 'M8', why: 'the total-refund fixture needs an approved charge' },
            {
                lie: 'M13',
                why: 'this case measures a total refund without the first-partial refusal'
            }
        ],
        withoutBehaviour: [{ behaviour: 'RP12', why: 'this fixture covers subscription billing' }]
    });
    const authorization = await provider.authorize({
        reference: seeded.fixture.started.subscriptionId,
        amount: { amountMinor: 10000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'Subscription payment',
        returnUrl: 'https://example.test/return'
    });
    await provider.approve({ authorizationId: authorization.authorizationId });
    const charge = await provider.charge({
        authorizationId: authorization.authorizationId,
        amount: { amountMinor: 10000, currency: 'ARS' },
        reference: seeded.fixture.started.subscriptionId
    });
    await getServiceTestDb()
        .update(payments)
        .set({ providerFactId: charge.chargeId })
        .where(eq(payments.id, seeded.payment.id));
    await confirmRefund(
        { actor: seeded.actor, refundId: seeded.refundId },
        { clock: seeded.fixture.clock, provider }
    );
    return { ...seeded, provider };
}

/** Reads only the rows seeded by the named fixture. */
export async function executeRows(refundId: string, paymentId: string) {
    const db = getServiceTestDb();
    const { refund, calls, keys } = await refundConfirmRows(refundId);
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    return { refund, calls, keys, payment };
}

/** Reads a single refund row by id for repeated execution assertions. */
export async function executeRefundRow(refundId: string) {
    const [refund] = await getServiceTestDb()
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId));
    return refund;
}
