import { eq, payments, promoRedemptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { createPromoChargePolicy } from '../../../src/services/billing/promo/promo-charge-policy.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';
import { retirePromoFixtures, seedPromoRedemption } from './support/promo-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retirePromoFixtures);

describe('TEST:B9b:4 AC:B9b:4 the counter only drops with a discounted charge', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(a,b) preserves a first-charge promo for an already-created full-price cycle, then decrements a discounted charge',
        async () => {
            const fixture = await paymentFixture();
            const chargeCreatedAt = fixture.clock.now();
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `promo-counter-${crypto.randomUUID()}`,
                    factAt: chargeCreatedAt
                })
                .returning();
            const firstChargePromo = await seedPromoRedemption({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id,
                discountKind: 'PERCENTAGE',
                value: 20,
                remainingCharges: 1,
                durationKind: 'FIRST_CHARGE',
                redeemedAt: new Date(chargeCreatedAt.getTime() + 1)
            });
            const exhausted = vi.fn();
            await creditPayment(
                { paymentId: pending!.id, chargeCreatedAt },
                {
                    clock: fixture.clock,
                    promoCharges: createPromoChargePolicy(),
                    promoExhaustion: { runS30: exhausted }
                }
            );
            const [stillAvailable] = await getServiceTestDb()
                .select({ remainingCharges: promoRedemptions.remainingCharges })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, firstChargePromo.redemptionId));
            expect(stillAvailable?.remainingCharges).toBe(1);
            expect(exhausted).not.toHaveBeenCalled();
            await getServiceTestDb()
                .update(promoRedemptions)
                .set({ remainingCharges: 0 })
                .where(eq(promoRedemptions.id, firstChargePromo.redemptionId));

            const second = await seedPromoRedemption({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id,
                discountKind: 'PERCENTAGE',
                value: 20,
                remainingCharges: 1,
                durationKind: 'FIRST_CHARGE',
                redeemedAt: new Date(chargeCreatedAt.getTime() + 2)
            });
            const [discounted] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 200000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `promo-counter-${crypto.randomUUID()}`,
                    factAt: new Date(chargeCreatedAt.getTime() + 3)
                })
                .returning();
            await getServiceTestDb()
                .update(promoRedemptions)
                .set({ redeemedAt: chargeCreatedAt })
                .where(eq(promoRedemptions.id, second.redemptionId));
            await creditPayment(
                { paymentId: discounted!.id, chargeCreatedAt },
                {
                    clock: fixture.clock,
                    promoCharges: createPromoChargePolicy(),
                    promoExhaustion: { runS30: exhausted }
                }
            );
            const [used] = await getServiceTestDb()
                .select({ remainingCharges: promoRedemptions.remainingCharges })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, second.redemptionId));
            expect(used?.remainingCharges).toBe(0);
            expect(exhausted).toHaveBeenCalledOnce();
            expect(exhausted).toHaveBeenCalledWith({
                subscriptionId: fixture.started.subscriptionId,
                redemptionId: second.redemptionId
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(f) keeps the explicit failing default when promo policy is missing',
        async () => {
            const fixture = await paymentFixture();
            const at = fixture.clock.now();
            const promo = await seedPromoRedemption({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id,
                discountKind: 'PERCENTAGE',
                value: 20,
                remainingCharges: 1,
                redeemedAt: at
            });
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 200000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `promo-counter-${crypto.randomUUID()}`,
                    factAt: at
                })
                .returning();
            await expect(
                creditPayment(
                    { paymentId: pending!.id, chargeCreatedAt: at },
                    { clock: fixture.clock }
                )
            ).rejects.toMatchObject({ reason: 'PROMO_CHARGE_POLICY_NOT_REGISTERED' });
            const [after] = await getServiceTestDb()
                .select({ status: payments.status })
                .from(payments)
                .where(eq(payments.id, pending!.id));
            expect(after?.status).toBe('PENDING');
            expect(promo.redemptionId).toBeTruthy();
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(c,d,e) decrements N charges, both stacked promos, and a discounted undercharge only',
        async () => {
            const fixture = await paymentFixture();
            const at = fixture.clock.now();
            const twoCharges = await seedPromoRedemption({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id,
                discountKind: 'PERCENTAGE',
                value: 20,
                remainingCharges: 2,
                redeemedAt: at
            });
            const stackedPercent = await seedPromoRedemption({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id,
                discountKind: 'PERCENTAGE',
                value: 20,
                remainingCharges: 1,
                redeemedAt: at
            });
            const stackedFixed = await seedPromoRedemption({
                subscriptionId: fixture.started.subscriptionId,
                userId: fixture.user.id,
                discountKind: 'FIXED',
                value: 10000,
                remainingCharges: 1,
                redeemedAt: at
            });
            const exhausted = vi.fn();
            const [pending] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 150000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `promo-counter-${crypto.randomUUID()}`,
                    factAt: at
                })
                .returning();
            await creditPayment(
                { paymentId: pending!.id, chargeCreatedAt: at },
                {
                    clock: fixture.clock,
                    promoCharges: createPromoChargePolicy(),
                    promoExhaustion: { runS30: exhausted }
                }
            );
            const [twoLeft] = await getServiceTestDb()
                .select({ remainingCharges: promoRedemptions.remainingCharges })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, twoCharges.redemptionId));
            expect(twoLeft?.remainingCharges).toBe(1);
            const [first] = await getServiceTestDb()
                .select({ remainingCharges: promoRedemptions.remainingCharges })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, stackedPercent.redemptionId));
            const [second] = await getServiceTestDb()
                .select({ remainingCharges: promoRedemptions.remainingCharges })
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, stackedFixed.redemptionId));
            expect(first?.remainingCharges).toBe(0);
            expect(second?.remainingCharges).toBe(0);
            expect(exhausted).toHaveBeenCalledTimes(2);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(e) counts an amount below the composed price but not one cent above it',
        async () => {
            for (const [amount, expected] of [
                [190000, 0],
                [200001, 1]
            ] as const) {
                const fixture = await paymentFixture();
                const at = fixture.clock.now();
                const promo = await seedPromoRedemption({
                    subscriptionId: fixture.started.subscriptionId,
                    userId: fixture.user.id,
                    discountKind: 'PERCENTAGE',
                    value: 20,
                    remainingCharges: 1,
                    redeemedAt: at
                });
                const [pending] = await getServiceTestDb()
                    .insert(payments)
                    .values({
                        subscriptionId: fixture.started.subscriptionId,
                        amount,
                        currency: 'ARS',
                        status: 'PENDING',
                        provider: fixture.link.provider,
                        providerFactId: `promo-counter-${crypto.randomUUID()}`,
                        factAt: at
                    })
                    .returning();
                await creditPayment(
                    { paymentId: pending!.id, chargeCreatedAt: at },
                    {
                        clock: fixture.clock,
                        promoCharges: createPromoChargePolicy(),
                        promoExhaustion: { runS30: vi.fn() }
                    }
                );
                const [counter] = await getServiceTestDb()
                    .select({ remainingCharges: promoRedemptions.remainingCharges })
                    .from(promoRedemptions)
                    .where(eq(promoRedemptions.id, promo.redemptionId));
                expect(counter?.remainingCharges).toBe(expected);
            }
        }
    );
});
