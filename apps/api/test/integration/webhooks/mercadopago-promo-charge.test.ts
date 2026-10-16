import { eq, getDb, payments, promoCodes, promoRedemptions, subscriptions } from '@repo/db';
import { FAKE_NOTICE_DELAY_MS } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    createSubjects,
    postDelivery,
    retireSubjects,
    SIGNING_KEY,
    signup
} from './mercadopago-delegates-fixtures';
import { startPromoChargeFixture } from './mercadopago-promo-charge-fixtures';

const subjects = createSubjects();
let fixture: Awaited<ReturnType<typeof startPromoChargeFixture>>;
const promoIds: string[] = [];

function dueDelivery(type: 'subscription_preapproval' | 'payment', id: string) {
    const delivery = fixture.server
        .mercadoPagoDeliveries({ webhookSecret: SIGNING_KEY })
        .deliveries.find(
            (candidate) =>
                candidate.query.includes(`type=${type}`) &&
                candidate.query.includes(`data.id=${id}`)
        );
    if (!delivery) throw new Error(`Expected provider delivery for ${type}:${id}`);
    return delivery;
}

beforeAll(async () => {
    fixture = await startPromoChargeFixture();
});
afterEach(async () => {
    if (promoIds.length) {
        await getDb()
            .delete(promoRedemptions)
            .where(eq(promoRedemptions.promoCodeId, promoIds[0]!));
        await getDb()
            .delete(promoCodes)
            .where(eq(promoCodes.id, promoIds.splice(0)[0]!));
    }
    await retireSubjects(subjects, fixture.lifterId);
});
afterAll(async () => fixture.stop());

describe('TEST:B9b:4 AC:B9b:4 the notice receiver credits a charge on a subscription with a live promo', () => {
    it('uses production promo ports, credits the payment and decrements the discounted charge', async () => {
        const created = await signup({
            app: fixture.app,
            billingOptionId: fixture.billingOptionId,
            subjects
        });
        const authorizationId = created.authorizationId;
        const subscriptionId = created.subscriptionId;
        await fixture.fake.approve({ authorizationId });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const approval = dueDelivery('subscription_preapproval', authorizationId);
        subjects.deliveries.push(approval);
        expect((await postDelivery(fixture.app, approval)).status).toBe(200);
        const [active] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
        expect(active?.status).toBe('ACTIVE');

        const [code] = await getDb()
            .insert(promoCodes)
            .values({
                code: `HOS1589-${crypto.randomUUID()}`,
                effectKind: 'DISCOUNT',
                discountKind: 'PERCENTAGE',
                value: 20,
                allVerticals: true,
                verticals: null,
                totalQuota: 10,
                validFrom: new Date('2026-01-01T00:00:00Z'),
                validUntil: new Date('2027-01-01T00:00:00Z'),
                stackable: true,
                usableWithAnotherActive: true,
                durationKind: 'FIRST_CHARGE',
                durationCharges: null
            })
            .returning({ id: promoCodes.id });
        promoIds.push(code!.id);
        const [redemption] = await getDb()
            .insert(promoRedemptions)
            .values({
                promoCodeId: code!.id,
                userId: created.userId,
                subscriptionId,
                redeemedAt: fixture.clock.now(),
                remainingCharges: 1
            })
            .returning({ id: promoRedemptions.id });
        await fixture.fake.changeAmount({
            authorizationId,
            amount: { amountMinor: 80000, currency: 'ARS' }
        });
        const charge = await fixture.fake.charge({
            authorizationId,
            amount: { amountMinor: 80000, currency: 'ARS' },
            reference: `promo-${crypto.randomUUID()}`
        });
        fixture.clock.advance({ ms: FAKE_NOTICE_DELAY_MS });
        const delivery = dueDelivery('payment', charge.chargeId);
        subjects.deliveries.push(delivery);
        const response = await postDelivery(fixture.app, delivery);
        expect(response.status, await response.clone().text()).toBe(200);
        const [payment] = await getDb()
            .select({ status: payments.status })
            .from(payments)
            .where(eq(payments.providerFactId, charge.chargeId));
        const [counter] = await getDb()
            .select({ remainingCharges: promoRedemptions.remainingCharges })
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, redemption!.id));
        expect(payment?.status).toBe('SUCCEEDED');
        expect(counter?.remainingCharges).toBe(0);
    });
});
