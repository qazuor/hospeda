import { billingOptions, eq, payments, subscriptions } from '@repo/db';
import { creditPayment } from '../../../../src/services/billing/payment/credit-payment.service';
import { getServiceTestDb } from '../helpers';
import type { purchaseFixture } from './addon-purchase-fixtures';
import { authorizedUnpaidExitPrincipal } from './b10-exit-fixtures';

type PurchaseFixture = Awaited<ReturnType<typeof purchaseFixture>>;

/** Starts a compatible venue principal through S1/S2 and credits its provider payment. */
export async function payingVenueExitPrincipal(f: PurchaseFixture): Promise<string> {
    const id = await authorizedUnpaidExitPrincipal({ f });
    const db = getServiceTestDb();
    const [row] = await db
        .select({ optionId: subscriptions.billingOptionId })
        .from(subscriptions)
        .where(eq(subscriptions.id, id));
    if (!row?.optionId) throw new Error('Venue principal option missing');
    const [option] = await db
        .select({ amount: billingOptions.amount })
        .from(billingOptions)
        .where(eq(billingOptions.id, row.optionId));
    if (!option) throw new Error('Venue option missing');
    // The provider fact is seeded; the payment credit uses the real service.
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: id,
            amount: option.amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: 'MERCADO_PAGO',
            providerFactId: crypto.randomUUID(),
            factAt: f.ports.clock.now()
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Venue payment missing');
    await creditPayment(
        { paymentId: payment.id, chargeCreatedAt: f.ports.clock.now() },
        { clock: f.ports.clock }
    );
    return id;
}
