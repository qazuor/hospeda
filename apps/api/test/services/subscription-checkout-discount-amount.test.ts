/**
 * HOS-1221 D2 — what MercadoPago is actually told to charge.
 *
 * ## The bug
 *
 * A signup discount used to ride INSIDE the MercadoPago `preapproval_plan`:
 * `resolveCheckoutMpPlanId` provisioned the plan at `discountCycle1AmountCentavos`
 * and the preapproval inherited that amount. HOS-1221 stopped sending the plan
 * (MercadoPago rejects a plan-based preapproval without a card token), and the
 * amount silently reverted to the price row's full price — while
 * `pendingDiscount` went on being snapshotted onto the row, promising the
 * webhook a discount the provider had never applied. A half-price checkout
 * charged ARS 18.000 instead of ARS 9.000.
 *
 * ## Why this suite runs the real qzpay-core
 *
 * The sibling suites stub `billing.subscriptions.create`, so they can only see
 * what Hospeda passes IN. The amount is decided one layer below that, where
 * qzpay-core builds its `QZPayProviderCreateSubscriptionInput`. So this suite
 * builds a real `createQZPayBilling` over an in-memory storage and a payment
 * adapter that CAPTURES that provider input — the same harness shape
 * `addon.checkout.recurring-borrowed-trial.test.ts` uses, and for the same
 * reason: the line under test is inside the library, not in our call.
 *
 * The last hop, provider input -> `auto_recurring.transaction_amount`, belongs
 * to `@qazuor/qzpay-mercadopago` and cannot run here without an HTTP call, so
 * its two rules are replicated verbatim (see `mercadoPagoTransactionAmount`)
 * and the replica is itself under test. The assertions are therefore about
 * PESOS, not about a field being present: a test that only checked presence
 * would pass with the override wired to the wrong number.
 *
 * @module test/services/subscription-checkout-discount-amount
 */

import {
    createQZPayBilling,
    type QZPayBilling,
    type QZPayPaymentAdapter,
    type QZPayStorageAdapter
} from '@qazuor/qzpay-core';
import { PromoEffectKindEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPlanDomainRead } from '../helpers/plan-domain-read.js';

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: true }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/services/billing/mp-plan-provisioning.service', async (importOriginal) => {
    const actual =
        await importOriginal<
            typeof import('../../src/services/billing/mp-plan-provisioning.service')
        >();
    return {
        ...actual,
        resolveCheckoutMpPlanId: vi.fn().mockResolvedValue('mp_plan_test'),
        resolveOrProvisionMpPlan: vi.fn()
    };
});

const resolveCheckoutPromoPlanMock = vi.fn();
vi.mock('../../src/services/subscription-checkout-promo.service', () => ({
    resolveCheckoutPromoPlan: (...args: unknown[]) => resolveCheckoutPromoPlanMock(...args)
}));

import { initiatePaidMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cus_discount';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PRICE_ID = 'price_owner_monthly';

/** ARS 18.000 in centavos — `owner-basico`'s real monthly price in staging. */
const FULL_PRICE_CENTAVOS = 1_800_000;
/** ARS 9.000 — what a 50% signup code must actually charge. */
const DISCOUNTED_CENTAVOS = 900_000;

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/**
 * `@qazuor/qzpay-mercadopago`'s two rules, replicated from
 * `adapters/subscription.adapter.ts`:
 *
 * ```ts
 * const unitAmount = providerInput.providerUnitAmountOverride !== undefined
 *     ? providerInput.providerUnitAmountOverride
 *     : providerInput.price.amount;
 * ...
 * transaction_amount: unitAmount / 100   // MP wants pesos; qzpay carries cents
 * ```
 *
 * `!== undefined`, never truthiness — `0` is a valid override. The division is
 * part of the rule and part of what makes these assertions about money.
 */
function mercadoPagoTransactionAmount(providerInput: {
    readonly providerUnitAmountOverride?: number;
    readonly price: { readonly amount: number };
}): number {
    const unitAmount =
        providerInput.providerUnitAmountOverride === undefined
            ? providerInput.price.amount
            : providerInput.providerUnitAmountOverride;
    return unitAmount / 100;
}

/** In-memory storage: one plan, one monthly price at the full ARS 18.000. */
function createStorage() {
    const rows = new Map<string, Record<string, unknown>>();
    const price = {
        id: PRICE_ID,
        planId: PLAN_ID,
        unitAmount: FULL_PRICE_CENTAVOS,
        currency: 'ARS',
        billingInterval: 'month',
        intervalCount: 1,
        active: true,
        providerPriceIds: {}
    };

    const storage = {
        plans: {
            findById: async (id: string) =>
                id === PLAN_ID
                    ? { id: PLAN_ID, name: 'owner-basico', active: true, prices: [price] }
                    : null,
            listAll: async () => [
                {
                    id: PLAN_ID,
                    name: 'owner-basico',
                    active: true,
                    metadata: { displayName: 'Anfitrión Básico' },
                    prices: [price]
                }
            ]
        },
        prices: {
            findByPlanId: async (planId: string) => (planId === PLAN_ID ? [price] : [])
        },
        customers: {
            findById: async (id: string) =>
                id === CUSTOMER_ID
                    ? {
                          id: CUSTOMER_ID,
                          email: 'host@hospeda.test',
                          name: 'Maria Rodriguez',
                          livemode: false,
                          providerCustomerIds: {}
                      }
                    : null
        },
        subscriptions: {
            create: async (input: Record<string, unknown>) => {
                const now = new Date();
                const row = {
                    id: String(input.id),
                    customerId: String(input.customerId),
                    planId: String(input.planId),
                    status: 'incomplete',
                    trialStart: null,
                    trialEnd: null,
                    currentPeriodStart: now,
                    currentPeriodEnd: now,
                    providerSubscriptionIds: {},
                    metadata: (input.metadata as Record<string, unknown>) ?? {},
                    cancelAtPeriodEnd: false,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null
                };
                rows.set(row.id, row);
                return row;
            },
            update: async (id: string, input: Record<string, unknown>) => {
                const next = { ...(rows.get(id) ?? {}), ...input };
                rows.set(id, next);
                return next;
            },
            delete: async (id: string) => {
                rows.delete(id);
            }
        }
    };

    return storage as unknown as QZPayStorageAdapter;
}

/** The provider input qzpay-core hands the adapter — the boundary under test. */
interface CapturedProviderInput {
    readonly providerUnitAmountOverride?: number;
    readonly planDisplayName?: string;
    readonly price: { readonly amount: number; readonly currency: string };
}

function buildBilling(): {
    readonly billing: QZPayBilling;
    readonly captured: CapturedProviderInput[];
} {
    const captured: CapturedProviderInput[] = [];
    const paymentAdapter = {
        provider: 'mercadopago',
        subscriptions: {
            create: vi.fn(async (providerInput: CapturedProviderInput) => {
                captured.push(providerInput);
                return {
                    id: 'preapproval_discount_001',
                    initPoint: 'https://mp.test/subscriptions/checkout?preapproval_id=x'
                };
            }),
            cancel: vi.fn().mockResolvedValue(undefined)
        }
    } as unknown as QZPayPaymentAdapter;

    const billing = createQZPayBilling({
        storage: createStorage(),
        paymentAdapter,
        defaultCurrency: 'ARS',
        livemode: false,
        providerSyncErrorStrategy: 'throw',
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    }) as QZPayBilling;

    return { billing, captured };
}

/** Swallows the status-normalize UPDATE `createOwnPreapprovalSubscription` issues. */
function createDbStub() {
    return {
        execute: vi.fn().mockResolvedValue({ rows: [] }),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) }))
    } as never;
}

async function runCheckout(billing: QZPayBilling) {
    return initiatePaidMonthlySubscription({
        customerId: CUSTOMER_ID,
        userId: 'user-1',
        planSlug: 'owner-basico',
        billing,
        urls: URLS,
        db: createDbStub()
    });
}

describe('HOS-1221 D2: the amount MercadoPago is told to charge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resolveCheckoutPromoPlanMock.mockResolvedValue({ kind: 'none' });
        // HOS-1233 T-032: the shared paid-create helper resolves the plan's
        // product_domain before creating the preapproval, and fails closed when
        // it finds no plan. Armed after clearAllMocks.
        mockPlanDomainRead();
    });

    it('charges the FULL price when no promo code applies', async () => {
        const { billing, captured } = buildBilling();

        await runCheckout(billing);

        expect(captured).toHaveLength(1);
        const providerInput = captured[0];
        if (!providerInput) throw new Error('no provider input captured');

        expect(providerInput.price.amount).toBe(FULL_PRICE_CENTAVOS);
        expect(providerInput.providerUnitAmountOverride).toBeUndefined();
        // ARS 18.000 — what the buyer authorizes on MercadoPago.
        expect(mercadoPagoTransactionAmount(providerInput)).toBe(18000);
    });

    it('charges the DISCOUNTED price when a 50% signup code applies', async () => {
        // The real `calculatePromoCodeEffect` runs on this effect, so the
        // 900.000 below is computed by production discount math, not by the
        // fixture asserting itself.
        resolveCheckoutPromoPlanMock.mockResolvedValue({
            kind: 'discount',
            promoCodeId: 'promo-50',
            effect: {
                kind: PromoEffectKindEnum.DISCOUNT,
                valueKind: 'percentage',
                value: 50,
                durationCycles: 1
            }
        });
        const { billing, captured } = buildBilling();

        const result = await runCheckout(billing);

        expect(result.appliedEffect).toBe('discount');
        const providerInput = captured[0];
        if (!providerInput) throw new Error('no provider input captured');

        // The price row is untouched — the discount is an override, not a
        // rewrite of the catalog.
        expect(providerInput.price.amount).toBe(FULL_PRICE_CENTAVOS);
        expect(providerInput.providerUnitAmountOverride).toBe(DISCOUNTED_CENTAVOS);
        // ARS 9.000, not 18.000. This is the assertion the bug failed.
        expect(mercadoPagoTransactionAmount(providerInput)).toBe(9000);
    });

    it('sends the buyer-visible plan name, never the slug (D4)', async () => {
        const { billing, captured } = buildBilling();

        await runCheckout(billing);

        const providerInput = captured[0];
        if (!providerInput) throw new Error('no provider input captured');

        // `billing_plans.name` IS the slug in this project, and the adapter
        // builds `reason` from it unless this override is supplied.
        expect(providerInput.planDisplayName).toBe('Anfitrión Básico');
        expect(providerInput.planDisplayName).not.toBe('owner-basico');
    });
});

/**
 * The replica the money assertions run through. Without these, a replica that
 * always returned the override (or always the price) would make the two cases
 * above indistinguishable.
 */
describe('the MercadoPago amount rule, replicated', () => {
    it('prefers the override over the price row', () => {
        expect(
            mercadoPagoTransactionAmount({
                providerUnitAmountOverride: DISCOUNTED_CENTAVOS,
                price: { amount: FULL_PRICE_CENTAVOS }
            })
        ).toBe(9000);
    });

    it('falls back to the price row when there is no override', () => {
        expect(mercadoPagoTransactionAmount({ price: { amount: FULL_PRICE_CENTAVOS } })).toBe(
            18000
        );
    });

    it('treats an override of 0 as an override, not as absent', () => {
        // `!== undefined`, never truthiness. A truthy check here would charge
        // full price for a zero override — the exact class of bug this field
        // exists to fix, reintroduced one layer up.
        expect(
            mercadoPagoTransactionAmount({
                providerUnitAmountOverride: 0,
                price: { amount: FULL_PRICE_CENTAVOS }
            })
        ).toBe(0);
    });
});
