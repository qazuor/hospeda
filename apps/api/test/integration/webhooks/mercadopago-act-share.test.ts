import { eq, getDb, payments, subscriptions } from '@repo/db';
import {
    type ActStart,
    MercadoPagoPaymentProvider,
    runWithProviderReadScope
} from '@repo/payments';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { recordChargeFact } from '../../../../../packages/service-core/src/services/billing/payment/record-charge-fact.service';
import { readChargeForAct } from '../../../../../packages/service-core/src/services/billing/reconciliation/period-charges/read-charge-for-act';
import { readPeriodCharges } from '../../../../../packages/service-core/src/services/billing/reconciliation/period-charges/read-period-charges';
import { readListedCharges } from '../../../../../packages/service-core/src/services/billing/reconciliation/sweep/comparisons/listed-charges';
import {
    createSubjects,
    postDelivery,
    retireSubjects,
    signedNotice,
    signup
} from './mercadopago-delegates-fixtures';
import { startPeriodChargesFixture } from './mercadopago-period-charges-fixtures';

const subjects = createSubjects();
let fixture: Awaited<ReturnType<typeof startPeriodChargesFixture>>;

beforeAll(async () => {
    fixture = await startPeriodChargesFixture();
});
afterEach(async () => retireSubjects(subjects, fixture.lifterId));
afterAll(async () => fixture.stop());

describe('Mercado Pago act keyed read sharing', () => {
    it('shares one stamped read within an act and keeps recordChargeFact and other acts live (AC-39)', async () => {
        const created = await signup({
            app: fixture.app,
            billingOptionId: fixture.billingOptionId,
            subjects
        });
        await fixture.fake.approve({ authorizationId: created.authorizationId });
        fixture.clock.advance({ ms: 1 });
        subjects.deliveries.push(
            signedNotice({
                clock: fixture.clock,
                type: 'subscription_preapproval',
                id: created.authorizationId,
                version: '1'
            })
        );
        const activation = await postDelivery(fixture.app, subjects.deliveries.at(-1)!);
        expect(activation.status).toBe(200);
        const charge = await fixture.fake.charge({
            authorizationId: created.authorizationId,
            amount: { amountMinor: 100000, currency: 'ARS' },
            reference: `act-share-${crypto.randomUUID()}`
        });
        const paymentDelivery = signedNotice({
            clock: fixture.clock,
            type: 'payment',
            id: charge.chargeId,
            version: '1'
        });
        subjects.deliveries.push(paymentDelivery);
        expect((await postDelivery(fixture.app, paymentDelivery)).status).toBe(200);

        const provider = new MercadoPagoPaymentProvider({
            clock: fixture.clock,
            baseUrl: fixture.server.url,
            accessToken: 'test-token'
        });
        const frozenNow = fixture.clock.now.bind(fixture.clock);
        let tick = 0;
        const ticking = vi
            .spyOn(fixture.clock, 'now')
            .mockImplementation(() => new Date(frozenNow().getTime() + ++tick));
        try {
            const before = fixture.server
                .requests()
                .filter(({ path }) => path === `/v1/payments/${charge.chargeId}`).length;
            const act: ActStart = { kind: 'decision', startedAt: fixture.clock.now() };
            const authorizationRead = await provider.readAuthorization({
                authorizationId: created.authorizationId
            });
            await runWithProviderReadScope({
                fn: async () => {
                    await readListedCharges({ authorizationRead, act }, { provider });
                    await readPeriodCharges({ authorizationRead, act }, { provider });
                    const afterInventory = fixture.server
                        .requests()
                        .filter(({ path }) => path === `/v1/payments/${charge.chargeId}`).length;
                    expect(afterInventory - before).toBe(1);
                    const result = await recordChargeFact(
                        { chargeId: charge.chargeId },
                        {
                            provider,
                            clock: fixture.clock,
                            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
                        }
                    );
                    expect(result.outcome).not.toBe('ProviderReadRejectedError');
                    const afterFact = fixture.server
                        .requests()
                        .filter(({ path }) => path === `/v1/payments/${charge.chargeId}`).length;
                    expect(afterFact - before).toBe(2);
                    await readChargeForAct({
                        provider,
                        chargeId: charge.chargeId,
                        act: { kind: 'decision', startedAt: act.startedAt }
                    });
                    const afterOtherAct = fixture.server
                        .requests()
                        .filter(({ path }) => path === `/v1/payments/${charge.chargeId}`).length;
                    expect(afterOtherAct - before).toBe(3);
                }
            });
        } finally {
            ticking.mockRestore();
        }
        expect(
            await getDb()
                .select({ id: payments.id })
                .from(payments)
                .innerJoin(subscriptions, eq(payments.subscriptionId, subscriptions.id))
                .where(eq(subscriptions.id, created.subscriptionId))
        ).toHaveLength(1);
    });
});
