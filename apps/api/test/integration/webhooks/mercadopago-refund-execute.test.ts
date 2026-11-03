import { eq, getDb, payments, refunds, users } from '@repo/db';
import { MercadoPagoPaymentProvider } from '@repo/payments';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { confirmRefund, requestRefund } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { postDelivery, signedNotice, signup } from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;
beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterAll(async () => fixture.stop());

describe('AC:B6:5 RF3 over the signed Mercado Pago webhook', () => {
    it('executes a confirmed refund on a payment notice and applies P4 once', async () => {
        const created = await signup({
            app: fixture.app,
            billingOptionId: fixture.billingOptionId,
            subjects: fixture.subjects
        });
        await fixture.fake.approve({ authorizationId: created.authorizationId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const authorizationNotice = signedNotice({
            clock: fixture.clock,
            type: 'subscription_preapproval',
            id: created.authorizationId,
            version: '1'
        });
        expect((await postDelivery(fixture.app, authorizationNotice)).status).toBe(200);
        const charge = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: created.subscriptionId
        });
        fixture.clock.advance({ ms: 60 * 60 * 1000 });
        const chargeNotice = signedNotice({
            clock: fixture.clock,
            type: 'payment',
            id: charge.chargeId,
            version: '1'
        });
        expect((await postDelivery(fixture.app, chargeNotice)).status).toBe(200);
        const [payment] = await getDb()
            .select()
            .from(payments)
            .where(eq(payments.providerFactId, charge.chargeId));
        expect(payment?.status).toBe('SUCCEEDED');
        const requested = await requestRefund(
            { source: { kind: 'PAYMENT', id: payment!.id }, amount: 50000, reason: 'REVOCATION' },
            { clock: fixture.clock }
        );
        const provider = new MercadoPagoPaymentProvider({
            clock: fixture.clock,
            baseUrl: fixture.server.url,
            accessToken: 'test-token'
        });
        const [admin] = await getDb()
            .insert(users)
            .values({
                email: `refund-webhook-admin-${crypto.randomUUID()}@example.test`,
                displayName: 'Refund webhook admin',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning({ id: users.id });
        if (!admin) throw new Error('Expected refund admin');
        await confirmRefund(
            {
                actor: {
                    id: admin.id,
                    roles: [RoleEnum.ADMIN],
                    permissions: [PermissionEnum.BILLING_REFUND]
                },
                refundId: requested.refundId
            },
            { clock: fixture.clock, provider }
        );
        const [before] = await getDb().select().from(payments).where(eq(payments.id, payment!.id));
        expect(before?.refundedAmount).toBe(0);
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const refundNotice = signedNotice({
            clock: fixture.clock,
            type: 'payment',
            id: charge.chargeId,
            version: '2'
        });

        expect((await postDelivery(fixture.app, refundNotice)).status).toBe(200);
        const [refund] = await getDb()
            .select()
            .from(refunds)
            .where(eq(refunds.id, requested.refundId));
        const [after] = await getDb().select().from(payments).where(eq(payments.id, payment!.id));
        expect(refund).toMatchObject({ status: 'EXECUTED', executedVia: 'PROVIDER' });
        expect(after).toMatchObject({
            status: 'PARTIALLY_REFUNDED',
            refundedAmount: 50000,
            version: before!.version + 1
        });
        expect((await postDelivery(fixture.app, refundNotice)).status).toBe(200);
        const [again] = await getDb().select().from(payments).where(eq(payments.id, payment!.id));
        expect(again).toMatchObject({
            status: after!.status,
            refundedAmount: after!.refundedAmount,
            version: after!.version
        });
    });
});
