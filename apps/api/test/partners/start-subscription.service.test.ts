/**
 * Unit tests for `initiatePartnerMonthlySubscription` (SPEC-271, migrated to
 * HOS-191 Path C).
 *
 * Two things are pinned here that no other suite covers:
 *
 * 1. **No server-side preapproval.** The partner path used to call
 *    `createPaidSubscription` → `billing.subscriptions.create({ mode: 'paid',
 *    providerPriceId })`, i.e. `POST /preapproval` with a `preapproval_plan_id`
 *    and no `card_token_id` — the exact shape MercadoPago answers with HTTP 400
 *    ("card_token_id is required"). Partner now takes the same hosted share-link
 *    Path C as accommodation and commerce.
 *
 * 2. **No synthetic payer email on the correlation row.** A partner is paid for
 *    by an EXTERNAL brand that has no Hospeda session, so the `back_url` (F2)
 *    linker can never run for it — linking always lands on the webhook (F3),
 *    which resolves by nonce (Tier 2) or heuristically (Tier 3). Both tiers
 *    VETO on a CONFIRMED payer-email mismatch between the live preapproval and
 *    the checkout-time snapshot (`verifyPreapprovalOwnership`). The partner
 *    billing customer carries a synthetic address
 *    (`partner-<id>@partners.hospeda.invalid`, `send-link.ts`) that can NEVER
 *    equal a real MercadoPago payer email, so snapshotting it would turn every
 *    partner payment MP reports an email for into a permanent `idor` refusal —
 *    money charged, never linked. The snapshot must therefore be ABSENT.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    TEST_DAILY_PLAN: { slug: 'owner-test-daily' }
}));

// HOS-191: stub only the MP-plan resolution boundary; keep the pure
// `buildPreapprovalPlanShareLink` real so the share-link assertion is meaningful.
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

const NONCE = 'nonce-partner';
const LOCAL_SUB_ID = '33333333-3333-4333-8333-333333333333';
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
    // An EMPTY database: every `select(...)` resolves to no rows. That is what
    // these cases mean — a partner with nothing in flight — so the per-partner
    // checkout idempotency (`services/billing/checkout-idempotency.ts`) finds no
    // bridge row and each call mints a fresh checkout, which is exactly the
    // behaviour the assertions below pin. Reuse itself is covered in
    // `test/services/billing/checkout-idempotency-by-entity.test.ts`.
    getDb: vi.fn(() => ({
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) })
    })),
    // Retained so the PRE-fix implementation (which wrapped its own
    // `withTransaction`) still loads — the red run must fail on behavior, not
    // on a missing mock export.
    withTransaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(txStub)),
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    and: vi.fn((...parts: unknown[]) => ({ op: 'and', parts })),
    billingSubscriptions: { __table: 'billing_subscriptions', id: 'id' },
    billingPendingCheckouts: { __table: 'billing_pending_checkouts' },
    commerceListingSubscriptions: { entityType: 'entity_type', entityId: 'entity_id' },
    partnerSubscriptions: { partnerId: 'partner_id' }
}));

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ProductDomainEnum, SubscriptionStatusEnum } from '@repo/schemas';
import { resolveCheckoutMpPlanId } from '../../src/services/billing/mp-plan-provisioning.service';
import { initiatePartnerMonthlySubscription } from '../../src/services/subscription-checkout.service';

const CUSTOMER_ID = 'cust_partner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000bb';
const PRICE_ID = 'price_partner_m';
const PARTNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const PLAN_DISPLAY_NAME = 'Partner Gold';
const PLAN_SLUG = 'partner-listing';

/**
 * The synthetic address `send-link.ts` gives every partner billing customer.
 * It exists only so qzpay has a non-empty email — it is NOT a payer identity.
 */
const SYNTHETIC_PARTNER_EMAIL = `partner-${PARTNER_ID}@partners.hospeda.invalid`;

function createBillingMock() {
    const create = vi.fn().mockResolvedValue({
        id: LOCAL_SUB_ID,
        status: 'incomplete',
        providerInitPoint: 'https://mp.test/partner-checkout',
        providerSandboxInitPoint: undefined,
        providerSubscriptionIds: { mercadopago: 'mp_456' }
    });

    const billing = {
        plans: {
            get: vi.fn().mockResolvedValue({
                id: PLAN_ID,
                name: PLAN_SLUG,
                metadata: { displayName: PLAN_DISPLAY_NAME },
                prices: [
                    {
                        id: PRICE_ID,
                        billingInterval: 'month',
                        intervalCount: 1,
                        active: true,
                        unitAmount: 4_000_000,
                        currency: 'ARS'
                    }
                ]
            })
        },
        customers: {
            get: vi.fn().mockResolvedValue({
                id: CUSTOMER_ID,
                email: SYNTHETIC_PARTNER_EMAIL,
                name: 'Marca Externa',
                livemode: true
            })
        },
        subscriptions: { create },
        getStorage: vi.fn(() => ({ subscriptionPollingJobs: undefined }))
    };

    return { billing: billing as unknown as QZPayBilling, create };
}

const URLS = {
    paymentMethodReturnUrl: 'https://admin.test/partners',
    notificationUrl: 'https://api.test/webhooks/mercadopago'
};

const BASE_INPUT = {
    customerId: CUSTOMER_ID,
    planId: PLAN_ID,
    partnerId: PARTNER_ID,
    urls: URLS
};

describe('initiatePartnerMonthlySubscription (HOS-191 Path C)', () => {
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

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        expect(create).not.toHaveBeenCalled();
    });

    it('redirects to the MercadoPago hosted share link carrying the checkout nonce', async () => {
        const { billing } = createBillingMock();

        const result = await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        expect(result.checkoutUrl).toBe(
            'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=mp_plan_test&external_reference=nonce-partner'
        );
        expect(result.localSubscriptionId).toBe(LOCAL_SUB_ID);
        expect(result.expiresAt).toBe(EXPIRES_AT);
    });

    it('snapshots NO payer email — the synthetic partner address would veto every webhook link', async () => {
        const { billing } = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        const arg = createPendingProviderSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(arg.payerEmail).toBeUndefined();
        expect(arg.payerEmail).not.toBe(SYNTHETIC_PARTNER_EMAIL);
    });

    it('materializes the pending_provider subscription stamped product_domain=partner', async () => {
        const { billing } = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        expect(createPendingProviderSubscription).toHaveBeenCalledTimes(1);
        const arg = createPendingProviderSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        // ADR-035 / SPEC-239: `loadEntitlements()` filters to
        // product_domain='accommodation'; a partner sub must never land there.
        expect(arg.productDomain).toBe(ProductDomainEnum.PARTNER);
        expect(arg.productDomain).not.toBe(ProductDomainEnum.ACCOMMODATION);
        expect(arg.customerId).toBe(CUSTOMER_ID);
        expect(arg.planId).toBe(PLAN_ID);
        expect(arg.priceId).toBe(PRICE_ID);
        expect(arg.billingInterval).toBe('monthly');
        expect(arg.mpPreapprovalPlanId).toBe('mp_plan_test');
        expect(arg.trialGranted).toBe(false);
        expect(arg.livemode).toBe(true);
    });

    it('upserts the partner link row at pending_provider INSIDE the subscription transaction', async () => {
        const { billing } = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        expect(txStub.insert).toHaveBeenCalledTimes(1);
        const insertedValues = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(insertedValues.subscriptionId).toBe(LOCAL_SUB_ID);
        expect(insertedValues.productDomain).toBe(ProductDomainEnum.PARTNER);
        expect(insertedValues.partnerId).toBe(PARTNER_ID);
        expect(insertedValues.status).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);

        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
        const conflictArg = onConflictDoUpdate.mock.calls[0]?.[0] as {
            set: Record<string, unknown>;
        };
        expect(conflictArg.set.subscriptionId).toBe(LOCAL_SUB_ID);
        expect(conflictArg.set.status).toBe(SubscriptionStatusEnum.PENDING_PROVIDER);
    });

    it('stamps the partner id on the subscription itself (subscription → partner path)', async () => {
        // `partner_subscriptions` is UNIQUE on `partner_id` and upserted, so a
        // second checkout click destroys the only pointer to the first
        // subscription. This metadata is the inverse path the reconciler uses
        // to recover an orphaned-but-paid partner subscription.
        const { billing } = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        const arg = createPendingProviderSubscription.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(arg.domainMetadata).toEqual({ partnerId: PARTNER_ID });
    });

    it('provisions the MP plan with the buyer-visible display name, not the raw slug', async () => {
        const { billing } = createBillingMock();

        await initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing });

        const planArg = vi.mocked(resolveCheckoutMpPlanId).mock.calls[0]?.[0];
        expect(planArg?.planName).toBe(PLAN_DISPLAY_NAME);
        expect(planArg?.planName).not.toBe(PLAN_SLUG);
        expect(planArg?.trialDays).toBe(0);
        expect(planArg?.billingInterval).toBe('monthly');
        expect(planArg?.backUrl).toBe(URLS.paymentMethodReturnUrl);
    });

    it('throws CUSTOMER_NOT_FOUND when the billing customer is missing', async () => {
        const { billing } = createBillingMock();
        billing.customers.get = vi.fn().mockResolvedValue(null);

        await expect(
            initiatePartnerMonthlySubscription({ ...BASE_INPUT, billing })
        ).rejects.toThrow(/customer/i);
    });
});
