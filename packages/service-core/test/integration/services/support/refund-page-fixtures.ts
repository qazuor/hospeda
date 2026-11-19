import { addonInstances, eq, payments, users } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { vi } from 'vitest';
import { confirmOneTimePagePayment } from '../../../../src/services/billing/addon/addon-instance-a2-one-time-page.js';
import { purchaseAddon } from '../../../../src/services/billing/addon/purchase-addon.service.js';
import { requestRefund } from '../../../../src/services/billing/refund/request-refund.service.js';
import type { Actor } from '../../../../src/types/index.js';
import { getServiceTestDb } from '../helpers.js';
import { payingPrincipal } from './addon-a2-fixtures.js';
import { purchaseFixture } from './addon-purchase-fixtures.js';

/**
 * Seeds a one-time add-on bought on a payment page (HOS-2179 §5.1–§5.3), activated by an
 * approved page payment read back by id, and a requested refund of that payment. Everything
 * runs through the real A1 and A2, so the instance has a page and no order, and its payment
 * names the instance and no subscription, as production writes them.
 *
 * Callers retire the rows with `retirePurchaseFixtures` after each test.
 *
 * @param input.refundAmount - The cents to request (defaults to the whole payment)
 * @returns The purchase fixture, the instance, its page charge, the payment, an admin actor
 *   and the requested refund id
 */
export async function refundPageFixture(input: { readonly refundAmount?: number } = {}) {
    const f = await purchaseFixture();
    await payingPrincipal(f);
    const purchase = await purchaseAddon(
        { ...f.input(), oneTimeChannel: 'PAGE' as const },
        f.ports
    );
    if (purchase.outcome !== 'CREATED') throw new Error(`Purchase returned ${purchase.outcome}`);
    const db = getServiceTestDb();
    const [instance] = await db
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, purchase.instanceId));
    if (!instance?.paymentPageId) throw new Error('Payment page missing');
    const charge = f.fake.payOnPage({ paymentPageId: instance.paymentPageId, outcome: 'approved' });
    const confirmed = await confirmOneTimePagePayment(
        { instanceId: instance.id, chargeId: charge.chargeId },
        { ...f.ports, coverageNotices: { emitCoverageChanged: vi.fn(async () => {}) } }
    );
    if (confirmed.outcome !== 'ACTIVATED') throw new Error(`A2 returned ${confirmed.outcome}`);
    const [payment] = await db.select().from(payments).where(eq(payments.id, confirmed.paymentId));
    if (!payment) throw new Error('Page payment missing');
    const [actorRow] = await db
        .insert(users)
        .values({
            email: `refund-page-admin-${crypto.randomUUID()}@example.test`,
            displayName: 'Page refund admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!actorRow) throw new Error('Page refund actor missing');
    const actor: Actor = {
        id: actorRow.id,
        roles: [RoleEnum.ADMIN],
        permissions: [PermissionEnum.BILLING_REFUND]
    };
    const request = await requestRefund(
        {
            source: { kind: 'PAYMENT', id: payment.id },
            amount: input.refundAmount ?? payment.amount,
            reason: 'ONE_TIME_ADDON_REVOCATION'
        },
        { clock: f.ports.clock }
    );
    return { f, instance, charge, payment, actor, refundId: request.refundId };
}

/**
 * Spends the fake's first-partial-refund refusal (lie M13) on a throwaway amount, so the
 * test's own partial is the charge's second attempt. The lie stays ON: this is how the
 * existing refund suites exercise a partial without switching it off.
 *
 * @param input.f - The purchase fixture whose fake holds the charge
 * @param input.chargeId - The charge
 */
export async function spendFirstPartialRefusal(input: {
    readonly f: Awaited<ReturnType<typeof purchaseFixture>>;
    readonly chargeId: string;
}): Promise<void> {
    await input.f.fake
        .refund({
            chargeId: input.chargeId,
            amount: { amountMinor: 1, currency: 'ARS' },
            reference: `m13-${crypto.randomUUID()}`
        })
        .catch((error: unknown) => {
            if ((error as { refundRefusal?: string }).refundRefusal !== 'AMOUNT_NOT_ACCEPTED')
                throw error;
        });
}
