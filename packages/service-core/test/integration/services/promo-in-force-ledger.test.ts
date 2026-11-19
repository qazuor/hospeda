import {
    eq,
    payments,
    promoRedemptionCharges,
    promoRedemptions,
    type SelectSubscription,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { createPromoChargePolicy } from '../../../src/services/billing/promo/promo-charge-policy.js';
import { composePromoAmount } from '../../../src/services/billing/promo/promo-composition.js';
import { compareCreditedChargeAmount } from '../../../src/services/billing/reconciliation/sweep/comparisons/credited-charge-amount.js';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { queueDowngrade } from '../../../src/services/billing/subscription/request-plan-change-support.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';
import { retirePromoFixtures, seedPromoRedemption } from './support/promo-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retirePromoFixtures);

/** List price of the monthly option `paymentFixture` seeds. */
const LIST = 250000;
const DAY = 86_400_000;

type Fixture = Awaited<ReturnType<typeof paymentFixture>>;

/** Seeds a discount redemption the way the redeem writer does: counter and initial charges. */
async function seedPromo(
    fixture: Fixture,
    input: {
        readonly discountKind: 'PERCENTAGE' | 'FIXED';
        readonly value: number;
        readonly charges: number | null;
        readonly redeemedAt: Date;
    }
) {
    const promo = await seedPromoRedemption({
        subscriptionId: fixture.started.subscriptionId,
        userId: fixture.user.id,
        discountKind: input.discountKind,
        value: input.value,
        remainingCharges: input.charges,
        redeemedAt: input.redeemedAt,
        durationKind: input.charges === null ? 'FOREVER' : 'N_CHARGES'
    });
    await getServiceTestDb()
        .update(promoRedemptions)
        .set({ initialCharges: input.charges })
        .where(eq(promoRedemptions.id, promo.redemptionId));
    return promo;
}

/** P1 for a fresh pending charge, with the real promo policy. */
async function credit(fixture: Fixture, input: { readonly amount: number; readonly at: Date }) {
    const [pending] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount: input.amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: `promo-in-force-${crypto.randomUUID()}`,
            factAt: input.at
        })
        .returning();
    if (!pending) throw new Error('Pending payment fixture missing');
    await creditPayment(
        { paymentId: pending.id, chargeCreatedAt: input.at },
        {
            clock: fixture.clock,
            promoCharges: createPromoChargePolicy(),
            promoExhaustion: { runS30: vi.fn(async () => undefined) }
        }
    );
    return { paymentId: pending.id, chargedMinor: input.amount, at: input.at };
}

async function reload(subscriptionId: string): Promise<SelectSubscription> {
    const [row] = await getServiceTestDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error('Subscription fixture missing');
    return row;
}

/** Runs the period comparison of one credited charge and returns what it reported. */
async function compare(
    fixture: Fixture,
    charge: { readonly paymentId: string; readonly chargedMinor: number; readonly at: Date }
) {
    const [payment] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.id, charge.paymentId));
    if (!payment) throw new Error('Payment missing');
    const addUndercharge = vi.fn(async () => undefined);
    const divergences = await compareCreditedChargeAmount({
        subscription: await reload(fixture.started.subscriptionId),
        paymentId: payment.id,
        promoChargesRecorded: payment.promoChargesRecorded,
        chargeId: `charge-${crypto.randomUUID()}`,
        chargedMinor: charge.chargedMinor,
        chargeCurrency: 'ARS',
        chargeCreatedAt: charge.at,
        isAlreadyHung: async () => false,
        ports: {
            expectedAmounts: createCutExpectedAmountPolicy({ executor: getServiceTestDb() }),
            dailySummary: { addUndercharge }
        }
    });
    return { divergences, addUndercharge };
}

async function expectClean(fixture: Fixture, charge: Parameters<typeof compare>[1]) {
    const { divergences, addUndercharge } = await compare(fixture, charge);
    expect(divergences).toEqual([]);
    expect(addUndercharge).not.toHaveBeenCalled();
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-2352 a period charge is priced with the promos in force when it was made',
    () => {
        it('(1) an exhausted promo still prices the charges that spent it', async () => {
            const fixture = await paymentFixture();
            const t0 = fixture.clock.now();
            await seedPromo(fixture, {
                discountKind: 'PERCENTAGE',
                value: 20,
                charges: 2,
                redeemedAt: t0
            });
            const c1 = await credit(fixture, { amount: 200000, at: new Date(t0.getTime() + DAY) });
            const c2 = await credit(fixture, {
                amount: 200000,
                at: new Date(t0.getTime() + 31 * DAY)
            });
            const c3 = await credit(fixture, {
                amount: LIST,
                at: new Date(t0.getTime() + 61 * DAY)
            });
            await expectClean(fixture, c1);
            await expectClean(fixture, c2);
            await expectClean(fixture, c3);
        });

        it('(2) a discounted charge after the counter ran out is the only undercharge', async () => {
            const fixture = await paymentFixture();
            const t0 = fixture.clock.now();
            await seedPromo(fixture, {
                discountKind: 'PERCENTAGE',
                value: 20,
                charges: 2,
                redeemedAt: t0
            });
            const c1 = await credit(fixture, { amount: 200000, at: new Date(t0.getTime() + DAY) });
            const c2 = await credit(fixture, {
                amount: 200000,
                at: new Date(t0.getTime() + 31 * DAY)
            });
            const c3 = await credit(fixture, {
                amount: 200000,
                at: new Date(t0.getTime() + 61 * DAY)
            });
            await expectClean(fixture, c1);
            await expectClean(fixture, c2);
            const { addUndercharge } = await compare(fixture, c3);
            expect(addUndercharge).toHaveBeenCalledOnce();
            expect(addUndercharge).toHaveBeenCalledWith(
                expect.objectContaining({ expectedMinor: LIST, chargedMinor: 200000 })
            );
        });

        it('(3) a downgrade ends a forever promo without unpricing the charges before it', async () => {
            const fixture = await paymentFixture();
            const t0 = fixture.clock.now();
            const promo = await seedPromo(fixture, {
                discountKind: 'PERCENTAGE',
                value: 20,
                charges: null,
                redeemedAt: t0
            });
            const c1 = await credit(fixture, { amount: 200000, at: new Date(t0.getTime() + DAY) });
            const subscription = await reload(fixture.started.subscriptionId);
            const queuedAt = new Date(t0.getTime() + 10 * DAY);
            await queueDowngrade({
                subscriptionId: subscription.id,
                targetPlanVersionId: subscription.planVersionId!,
                targetBillingOptionId: subscription.billingOptionId!,
                effectiveAt: new Date(t0.getTime() + 31 * DAY),
                now: queuedAt
            });
            const [ended] = await getServiceTestDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, promo.redemptionId));
            expect(ended).toMatchObject({
                remainingCharges: 0,
                endedAt: queuedAt,
                endedReason: 'DOWNGRADE'
            });
            await expectClean(fixture, c1);
        });

        it('(5) a full-price charge with the promo intact is still overcharged', async () => {
            const fixture = await paymentFixture();
            const t0 = fixture.clock.now();
            await seedPromo(fixture, {
                discountKind: 'PERCENTAGE',
                value: 20,
                charges: 2,
                redeemedAt: t0
            });
            const c1 = await credit(fixture, { amount: LIST, at: new Date(t0.getTime() + DAY) });
            const { divergences } = await compare(fixture, c1);
            expect(divergences).toHaveLength(1);
            expect(divergences[0]?.reason).toBe('IMPORTE_COBRADO_DE_MAS');
            expect(divergences[0]?.detail).toContainEqual({
                field: 'reconciliation_mark.expected_minor',
                new: 200000
            });
        });

        it('(6) two stacked promos, one exhausted between charges', async () => {
            const fixture = await paymentFixture();
            const t0 = fixture.clock.now();
            const percent = { discountKind: 'PERCENTAGE' as const, value: 20 };
            const fixed = { discountKind: 'FIXED' as const, value: 10000 };
            await seedPromo(fixture, { ...percent, charges: 1, redeemedAt: t0 });
            await seedPromo(fixture, { ...fixed, charges: 3, redeemedAt: t0 });
            const both = composePromoAmount({ listAmountMinor: LIST, promos: [percent, fixed] });
            const fixedOnly = composePromoAmount({ listAmountMinor: LIST, promos: [fixed] });
            const c1 = await credit(fixture, {
                amount: both.amountMinor,
                at: new Date(t0.getTime() + DAY)
            });
            const c2 = await credit(fixture, {
                amount: fixedOnly.amountMinor,
                at: new Date(t0.getTime() + 31 * DAY)
            });
            await expectClean(fixture, c1);
            await expectClean(fixture, c2);
        });

        it('(7) P1 writes the ledger row in its transaction and a re-credit adds none', async () => {
            const fixture = await paymentFixture();
            const t0 = fixture.clock.now();
            const promo = await seedPromo(fixture, {
                discountKind: 'PERCENTAGE',
                value: 20,
                charges: 2,
                redeemedAt: t0
            });
            const at = new Date(t0.getTime() + DAY);
            const [rolledBack] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 200000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: `promo-in-force-${crypto.randomUUID()}`,
                    factAt: at
                })
                .returning();
            const ports = {
                clock: fixture.clock,
                promoCharges: createPromoChargePolicy(),
                promoExhaustion: { runS30: vi.fn(async () => undefined) }
            };
            await expect(
                creditPayment(
                    { paymentId: rolledBack!.id, chargeCreatedAt: at },
                    {
                        ...ports,
                        beforeCommit: async () => {
                            throw new Error('abort P1');
                        }
                    }
                )
            ).rejects.toThrow('abort P1');
            const ledger = () =>
                getServiceTestDb()
                    .select()
                    .from(promoRedemptionCharges)
                    .where(eq(promoRedemptionCharges.redemptionId, promo.redemptionId));
            expect(await ledger()).toEqual([]);

            await creditPayment({ paymentId: rolledBack!.id, chargeCreatedAt: at }, ports);
            const again = await creditPayment(
                { paymentId: rolledBack!.id, chargeCreatedAt: at },
                ports
            );
            expect(again.outcome).toBe('ALREADY_CREDITED');
            const rows = await ledger();
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ paymentId: rolledBack!.id, chargeCreatedAt: at });
            const [credited] = await getServiceTestDb()
                .select({ promoChargesRecorded: payments.promoChargesRecorded })
                .from(payments)
                .where(eq(payments.id, rolledBack!.id));
            expect(credited?.promoChargesRecorded).toBe(true);
        });

        it('(10) a payment credited before the ledger is never undercharged, but is still overcharged', async () => {
            const fixture = await paymentFixture();
            const t0 = fixture.clock.now();
            const legacy = async (amount: number, at: Date) => {
                const [row] = await getServiceTestDb()
                    .insert(payments)
                    .values({
                        subscriptionId: fixture.started.subscriptionId,
                        amount,
                        currency: 'ARS',
                        status: 'SUCCEEDED',
                        provider: fixture.link.provider,
                        providerFactId: `promo-in-force-${crypto.randomUUID()}`,
                        factAt: at
                    })
                    .returning();
                if (!row) throw new Error('Legacy payment missing');
                expect(row.promoChargesRecorded).toBe(false);
                return { paymentId: row.id, chargedMinor: amount, at };
            };
            await expectClean(fixture, await legacy(150000, new Date(t0.getTime() + DAY)));
            const { divergences } = await compare(
                fixture,
                await legacy(LIST + 50000, new Date(t0.getTime() + 2 * DAY))
            );
            expect(divergences).toHaveLength(1);
            expect(divergences[0]?.reason).toBe('IMPORTE_COBRADO_DE_MAS');
        });
    }
);
