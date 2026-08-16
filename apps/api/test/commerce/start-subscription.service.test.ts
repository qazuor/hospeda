/**
 * Unit tests for `initiateCommerceMonthlySubscription` (SPEC-239 T-048,
 * migrated to HOS-191 Path C).
 *
 * Commerce checkout used to call `createPaidSubscription` →
 * `billing.subscriptions.create({ mode: 'paid', providerPriceId })`, i.e. a
 * server-side `POST /preapproval` carrying a `preapproval_plan_id` and NO
 * `card_token_id`. MercadoPago rejects exactly that shape with HTTP 400
 * ("card_token_id is required") — the empirical finding that drove HOS-191 and
 * that the accommodation paths were already fixed for. These tests pin commerce
 * to the same Path C the accommodation flows use: resolve/provision the MP
 * `preapproval_plan`, materialize a `pending_provider` local subscription +
 * correlation row, and redirect to MercadoPago's HOSTED share link.
 *
 * MercadoPago is stubbed at the `billing` boundary;
 * `createPendingProviderSubscription` is stubbed at its own boundary (it is
 * unit-tested in `services/billing/pending-provider-subscription-create.test.ts`)
 * while `buildPreapprovalPlanShareLink` stays REAL so the `checkoutUrl`
 * assertions exercise the actual URL builder.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the service under test).
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: { HOSPEDA_BILLING_POLLING_ENABLED: false }
}));

vi.mock('@repo/billing', () => ({
    resolveFreeTrialExtensionPromo: vi.fn(() => null),
    applyTestControl: vi.fn(async (_op: string, _args: unknown, realCall: () => Promise<unknown>) =>
        realCall()
    ),
    // `resolvePlanBySlug` in subscription-checkout.service.ts (shared by the
    // commerce path) references TEST_DAILY_PLAN.slug; this minimal mock must
    // provide it. The commerce slug never equals it, so the test-plan gate is
    // a no-op for these cases.
    TEST_DAILY_PLAN: { slug: 'owner-test-daily' }
}));

// HOS-191: `resolveCheckoutMpPlanId` reaches the payment adapter singleton +
// `billing_mp_plans`. Stub that ONE boundary; keep `buildPreapprovalPlanShareLink`
// real (pure function) so the share-link assertions are meaningful.
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

const onConflictDoUpdate = vi.fn((_config: unknown) => Promise.resolve(undefined));
const insertValues = vi.fn((_values: unknown) => ({ onConflictDoUpdate }));
const updateWhere = vi.fn((_cond: unknown) => Promise.resolve(undefined));
const updateSet = vi.fn((_values: unknown) => ({ where: updateWhere }));

/** Fake transaction handed to the `writeDomainLinkRow` callback. */
const txStub = {
    insert: vi.fn((_table: unknown) => ({ values: insertValues })),
    update: vi.fn((_table: unknown) => ({ set: updateSet }))
};

const NONCE = 'nonce-test';
const LOCAL_SUB_ID = '22222222-2222-4222-8222-222222222222';
const EXPIRES_AT = '2026-01-01T00:00:00.000Z';

const createPendingProviderSubscription = vi.fn(
    async (input: {
        writeDomainLinkRow?: (params: {
            tx: unknown;
            localSubscriptionId: string;
        }) => Promise<void>;
    }) => {
        await input.writeDomainLinkRow?.({ tx: txStub, localSubscriptionId: LOCAL_SUB_ID });
        return { localSubscriptionId: LOCAL_SUB_ID, nonce: NONCE, expiresAt: EXPIRES_AT };
    }
);

vi.mock('../../src/services/billing/pending-provider-subscription-create', () => ({
    createPendingProviderSubscription: (input: never) => createPendingProviderSubscription(input)
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({})),
    // Retained so the PRE-fix implementation (which wrapped its own
    // `withTransaction`) still loads — the red run must fail on behavior, not
    // on a missing mock export.
    withTransaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(txStub)),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    commerceListingSubscriptions: {
        entityType: 'entity_type',
        entityId: 'entity_id'
    },
    partnerSubscriptions: { partnerId: 'partner_id' }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { initiateCommerceMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_owner';
const CUSTOMER_EMAIL = 'owner@hospeda.test';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const PRICE_ID = 'price_m';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/**
 * The commerce plan's buyer-visible label lives in `metadata.displayName`;
 * `billing_plans.name` is the raw SLUG. The share-link checkout must show the
 * former in MercadoPago (see the display-name test below).
 */
const PLAN_DISPLAY_NAME = 'Comercios';
const PLAN_SLUG = 'commerce-listing';

function createBillingMock() {
    const create = vi.fn().mockResolvedValue({
        id: LOCAL_SUB_ID,
        status: 'incomplete',
        providerInitPoint: 'https://mp.test/checkout',
        providerSandboxInitPoint: undefined,
        providerSubscriptionIds: { mercadopago: 'mp_123' }
    });
    const billing = {
        plans: {
            list: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: PLAN_ID,
                        name: PLAN_SLUG,
                        metadata: { displayName: PLAN_DISPLAY_NAME },
                        prices: [
                            {
                                id: PRICE_ID,
                                billingInterval: 'month',
                                intervalCount: 1,
                                active: true,
                                unitAmount: 1_500_000,
                                currency: 'ARS'
                            }
                        ]
                    }
                ]
            })
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: CUSTOMER_EMAIL,
                name: 'Owner',
                livemode: false
            })
        },
        subscriptions: { create },
        getStorage: vi.fn(() => ({ subscriptionPollingJobs: undefined }))
    };
    // TYPE-WORKAROUND: the test stub implements only the subset of QZPayBilling
    // the service touches; cast to the full interface so call sites need no
    // per-call `any`.
    return { billing: billing as unknown as QZPayBilling, create };
}

const URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/comercios/checkout/success/',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

const BASE_INPUT = {
    customerId: CUSTOMER_ID,
    planSlug: PLAN_SLUG,
    entityType: 'gastronomy',
    entityId: ENTITY_ID,
    urls: URLS
};

describe('initiateCommerceMonthlySubscription (HOS-191 Path C)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        onConflictDoUpdate.mockResolvedValue(undefined);
        insertValues.mockReturnValue({ onConflictDoUpdate });
        updateWhere.mockResolvedValue(undefined);
        updateSet.mockReturnValue({ where: updateWhere });
        txStub.insert.mockReturnValue({ values: insertValues });
        txStub.update.mockReturnValue({ set: updateSet });
        createPendingProviderSubscription.mockImplementation(
            async (input: {
                writeDomainLinkRow?: (params: {
                    tx: unknown;
                    localSubscriptionId: string;
                }) => Promise<void>;
            }) => {
                await input.writeDomainLinkRow?.({
                    tx: txStub,
                    localSubscriptionId: LOCAL_SUB_ID
                });
                return { localSubscriptionId: LOCAL_SUB_ID, nonce: NONCE, expiresAt: EXPIRES_AT };
            }
        );
    });

    it('NEVER creates a server-side preapproval (the MP 400 "card_token_id is required" shape)', async () => {
        const { billing, create } = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        expect(create).not.toHaveBeenCalled();
    });

    it('redirects to the MercadoPago hosted share link carrying the checkout nonce', async () => {
        const { billing } = createBillingMock();

        const result = await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        expect(result.checkoutUrl).toBe(
            'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=mp_plan_test&external_reference=nonce-test'
        );
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
        expect(result.expiresAt).toBe(EXPIRES_AT);
    });

    it('materializes the pending_provider subscription stamped product_domain=commerce', async () => {
        const { billing } = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        expect(createPendingProviderSubscription).toHaveBeenCalledTimes(1);
        const arg = createPendingProviderSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        // ADR-035 / SPEC-239: `loadEntitlements()` filters to
        // product_domain='accommodation'. A commerce checkout that stamped the
        // default would hand its owner the accommodation entitlement set.
        expect(arg.productDomain).toBe(ProductDomainEnum.COMMERCE);
        expect(arg.productDomain).not.toBe(ProductDomainEnum.ACCOMMODATION);
        expect(arg.customerId).toBe(CUSTOMER_ID);
        expect(arg.planId).toBe(PLAN_ID);
        expect(arg.priceId).toBe(PRICE_ID);
        expect(arg.billingInterval).toBe('monthly');
        expect(arg.mpPreapprovalPlanId).toBe('mp_plan_test');
        expect(arg.payerEmail).toBe(CUSTOMER_EMAIL);
        expect(arg.trialGranted).toBe(false);
        expect(arg.livemode).toBe(false);
    });

    it('upserts the link row at pending_provider INSIDE the subscription transaction (D4)', async () => {
        const { billing } = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        expect(txStub.insert).toHaveBeenCalledTimes(1);
        const insertedValues = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.subscriptionId).toBe(LOCAL_SUB_ID);
        expect(insertedValues.productDomain).toBe(ProductDomainEnum.COMMERCE);
        expect(insertedValues.entityType).toBe('gastronomy');
        expect(insertedValues.entityId).toBe(ENTITY_ID);
        expect(insertedValues.status).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);

        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const conflictArg = onConflictDoUpdate.mock.calls[0]?.[0] as {
            target: unknown[];
            set: Record<string, unknown>;
        };
        expect(conflictArg.target).toHaveLength(2);
        expect(conflictArg.set.subscriptionId).toBe(LOCAL_SUB_ID);
        expect(conflictArg.set.status).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);
    });

    it('provisions the MP plan with the buyer-visible display name, not the raw slug', async () => {
        const { billing } = createBillingMock();

        await initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing });

        const planArg = vi.mocked(resolveCheckoutMpPlanId).mock.calls[0]?.[0];
        expect(planArg?.planName).toBe(PLAN_DISPLAY_NAME);
        expect(planArg?.planName).not.toBe(PLAN_SLUG);
        expect(planArg?.trialDays).toBe(0);
        expect(planArg?.billingInterval).toBe('monthly');
        expect(planArg?.backUrl).toBe(URLS.paymentMethodReturnUrl);
    });

    it('throws PLAN_NOT_FOUND when the plan slug is unknown', async () => {
        const { billing } = createBillingMock();
        billing.plans.list = vi.fn().mockResolvedValue({ data: [] });

        await expect(
            initiateCommerceMonthlySubscription({
                ...BASE_INPUT,
                planSlug: 'does-not-exist',
                billing
            })
        ).rejects.toThrow(/not found/i);
    });

    it('throws NO_MONTHLY_PRICE when the plan has no active monthly price', async () => {
        const { billing } = createBillingMock();
        billing.plans.list = vi.fn().mockResolvedValue({
            data: [{ id: PLAN_ID, name: PLAN_SLUG, metadata: {}, prices: [] }]
        });

        await expect(
            initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing })
        ).rejects.toThrow(/monthly price/i);
    });

    it('throws CUSTOMER_NOT_FOUND when the billing customer is missing', async () => {
        const { billing } = createBillingMock();
        billing.customers.get = vi.fn().mockResolvedValue(null);

        await expect(
            initiateCommerceMonthlySubscription({ ...BASE_INPUT, billing })
        ).rejects.toThrow(/customer/i);
    });
});
