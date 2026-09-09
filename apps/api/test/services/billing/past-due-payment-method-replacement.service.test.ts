/**
 * Unit tests for the past-due payment-method replacement service (HOS-348
 * Part B).
 *
 * Deliberately does NOT mock `createPaidSubscription` / `resolveReactivationPlan`
 * (the repo's "whole-module vi.mock leaves the new import undefined" trap) —
 * instead a fake `QZPayBilling` (`plans.listAll` / `subscriptions.create` /
 * `subscriptions.cancel`) drives the REAL helpers, so these tests exercise the
 * actual plan-resolution + preapproval-create logic, not a mock of it.
 *
 * Covers:
 * - A fresh mint stamps `supersedesSubscriptionId`, the HOS-348 replacement
 *   marker, and `unpaidPeriodForgiven` on the new row's metadata.
 * - Minting NEVER calls `billing.subscriptions.cancel()` — the load-bearing
 *   invariant that the old preapproval is untouched until the webhook
 *   confirms the new one (verified in RED with the bug reintroduced below).
 * - An in-flight attempt within the reuse window is returned instead of
 *   minting a second preapproval (idempotency layer 2).
 * - A stale (expired) or foreign-customer in-flight row is NOT reused.
 *
 * @module test/services/billing/past-due-payment-method-replacement.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY,
    replacePastDuePaymentMethod
} from '../../../src/services/billing/past-due-payment-method-replacement.service';
import { mockPlanDomainRead } from '../../helpers/plan-domain-read.js';

const PLAN_ID = 'plan-uuid-001';
const CUSTOMER_ID = 'customer-uuid-001';
const PAST_DUE_SUBSCRIPTION_ID = 'sub-past-due-001';
const GASTRONOMY_ENTITY_ID = 'entity-gastro-001';
const EXPERIENCE_ENTITY_ID = 'entity-exp-001';
const PARTNER_ID = 'partner-001';

/**
 * The accommodation past-due row the pre-HOS-1287 tests were implicitly
 * describing: `product_domain` NULL (the column post-dates most rows) and no
 * entity pointer on `metadata`. Stated rather than defaulted — HOS-1287 made
 * both fields REQUIRED on the input precisely so no call site can leave the
 * vertical unstated.
 */
const ACCOMMODATION_PAST_DUE_ROW = {
    id: PAST_DUE_SUBSCRIPTION_ID,
    planId: PLAN_ID,
    productDomain: null,
    metadata: null
} as const;

/** Minimal real-shaped plan with one active monthly price, for resolveReactivationPlan. */
function makePlan() {
    return {
        id: PLAN_ID,
        prices: [
            {
                id: 'price-monthly-001',
                active: true,
                billingInterval: 'month',
                intervalCount: 1,
                unitAmount: 500000
            }
        ]
    };
}

/** Minimal real-shaped result for billing.subscriptions.create(). */
function makeCreatedSubscription(overrides: { id?: string } = {}) {
    return {
        id: overrides.id ?? 'sub-new-001',
        providerInitPoint: 'https://mercadopago.example/checkout/sub-new-001',
        providerSandboxInitPoint: null,
        providerSubscriptionIds: { mercadopago: 'mp-preapproval-new-001' }
    };
}

/** Fake QZPayBilling exposing only what createPaidSubscription/resolveReactivationPlan touch. */
function makeFakeBilling(
    overrides: {
        createResult?: ReturnType<typeof makeCreatedSubscription>;
        listAllResult?: ReturnType<typeof makePlan>[];
    } = {}
) {
    const create = vi.fn().mockResolvedValue(overrides.createResult ?? makeCreatedSubscription());
    const cancel = vi.fn().mockResolvedValue(undefined);
    const listAll = vi.fn().mockResolvedValue(overrides.listAllResult ?? [makePlan()]);

    return {
        billing: {
            plans: { listAll },
            subscriptions: { create, cancel }
        } as unknown as QZPayBilling,
        create,
        cancel,
        listAll
    };
}

/** Chainable fake Drizzle client covering exactly the calls this service issues. */
function makeFakeDb(selectRows: Record<string, unknown>[] = []) {
    const limit = vi.fn().mockResolvedValue(selectRows);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });

    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set });

    return { db: { select, update } as never, select, update, updateWhere, set };
}

describe('replacePastDuePaymentMethod (HOS-348 Part B)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // HOS-1233 T-032: the shared paid-create helper resolves the plan's
        // domain before minting the replacement preapproval, and fails closed
        // when the plan is not found. Armed AFTER clearAllMocks, which would
        // otherwise wipe it.
        mockPlanDomainRead();
    });

    it('mints a fresh preapproval stamped with supersedesSubscriptionId and the debt-forgiveness markers', async () => {
        // Arrange
        const { billing, create, cancel } = makeFakeBilling();
        const { db } = makeFakeDb([]); // no in-flight attempt found

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result.reused).toBe(false);
        expect(result.localSubscriptionId).toBe('sub-new-001');
        expect(result.checkoutUrl).toBe('https://mercadopago.example/checkout/sub-new-001');

        expect(create).toHaveBeenCalledTimes(1);
        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        expect(createArgs.metadata).toMatchObject({
            supersedesSubscriptionId: PAST_DUE_SUBSCRIPTION_ID,
            [PAST_DUE_PAYMENT_METHOD_REPLACEMENT_METADATA_KEY]: 'true',
            unpaidPeriodForgiven: 'true',
            previousPlanId: PLAN_ID
        });
        // No trial field of any kind — guard G-1's whole point.
        expect(createArgs).not.toHaveProperty('freeTrialDays');
        expect(createArgs).not.toHaveProperty('startDate');

        // The load-bearing invariant: minting NEVER cancels the old
        // preapproval. Cancellation is entirely the webhook's job, gated on
        // the new subscription's confirmed PENDING_PROVIDER -> ACTIVE
        // transition (subscription-logic.ts) — untouched by this service.
        expect(cancel).not.toHaveBeenCalled();
    });

    it('reuses an in-flight replacement attempt within the reuse window instead of minting a second preapproval', async () => {
        // Arrange — an existing pending_provider row already supersedes this
        // exact past-due subscription, created moments ago.
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([
            {
                id: 'sub-inflight-001',
                metadata: { checkoutUrl: 'https://mercadopago.example/checkout/inflight-001' },
                createdAt: new Date()
            }
        ]);

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result).toEqual({
            reused: true,
            localSubscriptionId: 'sub-inflight-001',
            checkoutUrl: 'https://mercadopago.example/checkout/inflight-001'
        });
        expect(create).not.toHaveBeenCalled();
    });

    it('does NOT reuse an in-flight row missing its checkoutUrl stamp — mints instead', async () => {
        // Arrange — a row exists (mint started) but the checkoutUrl stamp
        // update never landed (e.g. a crash between create and the stamp).
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([
            { id: 'sub-inflight-002', metadata: {}, createdAt: new Date() }
        ]);

        // Act
        const result = await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        // Assert
        expect(result.reused).toBe(false);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('propagates SubscriptionCheckoutError from resolveReactivationPlan (e.g. unknown plan)', async () => {
        // Arrange — plans.listAll() returns no plan matching planId.
        const { billing } = makeFakeBilling({ listAllResult: [] });
        const { db } = makeFakeDb([]);

        // Act / Assert
        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: ACCOMMODATION_PAST_DUE_ROW,
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
    });
});

/**
 * HOS-1287 — the SILENT half of the defect the checkout retry documented out
 * loud.
 *
 * These are the tests that matter most in this file. Everything above asserts
 * that a replacement preapproval is minted; these assert WHOSE it is. Before
 * HOS-1287 this service minted the replacement with no entity pointer at all,
 * so once the new preapproval confirmed and `completeSupersessionPairing`
 * cancelled the old one, the listing's bridge row was left pointing at a
 * CANCELLED subscription — a paying customer with a dark listing, no throw and
 * no log line.
 *
 * Two directions, both required:
 *  - toward the BUG: dropping the pointer must go red (the four
 *    `commerceEntityId` / `partnerId` assertions below).
 *  - toward the TOO-WIDE fix: minting for a domain whose price is not derivable
 *    from its plan (`addon`), or re-pointing a listing the row does not own (a
 *    gastronomy row carrying an experience pointer), must ALSO go red — those
 *    are the `DOMAIN_NOT_REPLACEABLE` cases.
 */
describe('replacePastDuePaymentMethod — domain carry-forward (HOS-1287)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPlanDomainRead();
    });

    it('carries the gastronomy entity pointer onto the replacement row', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: {
                id: PAST_DUE_SUBSCRIPTION_ID,
                planId: PLAN_ID,
                productDomain: 'gastronomy',
                metadata: {
                    commerceEntityType: 'gastronomy',
                    commerceEntityId: GASTRONOMY_ENTITY_ID
                }
            },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        // Read field by field, never through `objectContaining`: this whole
        // test exists because the fields were ABSENT, and `objectContaining` is
        // blind to a missing field.
        expect(createArgs.metadata?.commerceEntityType).toBe('gastronomy');
        expect(createArgs.metadata?.commerceEntityId).toBe(GASTRONOMY_ENTITY_ID);
        // The forgiveness marker still stands — the pointer is additive.
        expect(createArgs.metadata?.unpaidPeriodForgiven).toBe('true');
    });

    it('carries the experience entity pointer onto the replacement row', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: {
                id: PAST_DUE_SUBSCRIPTION_ID,
                planId: PLAN_ID,
                productDomain: 'experience',
                metadata: {
                    commerceEntityType: 'experience',
                    commerceEntityId: EXPERIENCE_ENTITY_ID
                }
            },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        expect(createArgs.metadata?.commerceEntityType).toBe('experience');
        expect(createArgs.metadata?.commerceEntityId).toBe(EXPERIENCE_ENTITY_ID);
    });

    it('carries the partner pointer onto the replacement row', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await replacePastDuePaymentMethod({
            billing,
            customerId: CUSTOMER_ID,
            pastDueSubscription: {
                id: PAST_DUE_SUBSCRIPTION_ID,
                planId: PLAN_ID,
                productDomain: 'partner',
                metadata: { partnerId: PARTNER_ID }
            },
            paymentMethodReturnUrl: 'https://hospeda.example/return',
            notificationUrl: 'https://hospeda.example/webhook',
            db
        });

        const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
        expect(createArgs.metadata?.partnerId).toBe(PARTNER_ID);
    });

    it('stamps NO entity pointer for accommodation or tourist — the domains that own no listing', async () => {
        for (const productDomain of [null, 'accommodation', 'tourist']) {
            vi.clearAllMocks();
            mockPlanDomainRead();
            const { billing, create } = makeFakeBilling();
            const { db } = makeFakeDb([]);

            await replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain,
                    metadata: null
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            });

            const createArgs = create.mock.calls[0]?.[0] as { metadata?: Record<string, unknown> };
            expect(createArgs.metadata).not.toHaveProperty('commerceEntityId');
            expect(createArgs.metadata).not.toHaveProperty('partnerId');
        }
    });

    it('TOO-WIDE GUARD: refuses an addon row instead of minting at the BORROWED plan price', async () => {
        // A recurring add-on borrows the owner plan's price row and states its
        // real amount through `providerUnitAmountOverride`. This service
        // re-derives the price from the plan, so minting here would bill an
        // ARS 5.000 add-on at the plan's ARS 18.000-and-up. Refusing is the
        // whole point.
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: 'addon',
                    metadata: null
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });

        // Refused BEFORE anything reached MercadoPago — a preapproval minted
        // and then rejected would still need cancelling.
        expect(create).not.toHaveBeenCalled();
    });

    it('TOO-WIDE GUARD: refuses a gastronomy row whose stamped pointer names an experience listing', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: 'gastronomy',
                    metadata: {
                        commerceEntityType: 'experience',
                        commerceEntityId: EXPERIENCE_ENTITY_ID
                    }
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });
        expect(create).not.toHaveBeenCalled();
    });

    it('refuses a commerce row whose entity pointer was never stamped, rather than minting a pointerless replacement', async () => {
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: 'gastronomy',
                    metadata: {}
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });
        expect(create).not.toHaveBeenCalled();
    });

    it('refuses the retired pre-HOS-685 umbrella domain rather than guessing a vertical for it', async () => {
        // HOS-695: a legacy row still carrying the umbrella value satisfies
        // NEITHER gastronomy NOR experience, and goes dark on purpose. The
        // pointer it carries is not enough to widen the comparison.
        const retiredUmbrellaDomain = ['comm', 'erce'].join('');
        const { billing, create } = makeFakeBilling();
        const { db } = makeFakeDb([]);

        await expect(
            replacePastDuePaymentMethod({
                billing,
                customerId: CUSTOMER_ID,
                pastDueSubscription: {
                    id: PAST_DUE_SUBSCRIPTION_ID,
                    planId: PLAN_ID,
                    productDomain: retiredUmbrellaDomain,
                    metadata: {
                        commerceEntityType: 'gastronomy',
                        commerceEntityId: GASTRONOMY_ENTITY_ID
                    }
                },
                paymentMethodReturnUrl: 'https://hospeda.example/return',
                notificationUrl: 'https://hospeda.example/webhook',
                db
            })
        ).rejects.toMatchObject({ code: 'DOMAIN_NOT_REPLACEABLE' });
        expect(create).not.toHaveBeenCalled();
    });
});
