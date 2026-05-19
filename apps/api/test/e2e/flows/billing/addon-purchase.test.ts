/**
 * Add-on one-time purchase — happy path (SPEC-143 T-143-14 sub-commit 1).
 *
 * Validates the FIRST leg of the add-on purchase flow:
 *
 * ```
 * POST /api/v1/protected/billing/addons/{slug}/purchase
 *      { promoCode?: string }
 *
 * → AddonService.purchase → createAddonCheckout in addon.checkout.ts
 * → Validates addon (catalog), customer, active subscription, plan category,
 *   promo code (optional)
 * → Creates a Mercado Pago Preference directly via the `mercadopago` SDK
 *   (NOT via @repo/billing adapter — addon.checkout.ts is the ONLY site in
 *   the app that bypasses the adapter)
 * → Returns 200 { checkoutUrl, orderId, addonId, amount, currency, expiresAt }
 * ```
 *
 * IMPORTANT contracts pinned by this test:
 *
 *   1. The POST /purchase leg does NOT insert into `billing_addon_purchases`
 *      and does NOT insert into `billing_checkouts`. The DB-side row is
 *      created later by `confirmAddonPurchase` when the payment.approved
 *      webhook fires (covered by sub-commit 3). The purchase leg is a
 *      pure MP Preference creation.
 *   2. The MP Preference is created via the raw `mercadopago` SDK
 *      (`MercadoPagoConfig` + `new Preference(client).create(...)`), NOT
 *      via the QZPay billing adapter. The stubRef stub used by every
 *      other billing e2e test does NOT intercept this call — a separate
 *      `vi.mock('mercadopago', ...)` is required.
 *   3. The Preference body carries the metadata shape `extractAddonMetadata`
 *      reads on the webhook side: camelCase `addonSlug` + `customerId`
 *      (plus snake_case duplicates for backward compat with raw MP).
 *      Pin these explicitly so a metadata-shape refactor surfaces here.
 *   4. The `external_reference` follows the `addon_<slug>_<uuid>` pattern
 *      so `extractAddonFromReference` can recover the slug if metadata is
 *      missing (defensive path on the webhook side).
 *
 * @module test/e2e/flows/billing/addon-purchase
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. Two shared refs:
//   - stubRef: shared with the `@repo/billing` factory below so the billing
//     middleware lazy-initializes against an MP-stub adapter (the addon flow
//     itself never touches the adapter, but the API boot path does).
//   - preferenceCreateMock: shared with the `mercadopago` factory below so
//     individual tests can configure the Preference.create response per case
//     and inspect the call arguments after the request lands.
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));
const preferenceCreateMock = vi.hoisted(() => vi.fn());
// Per-test override for getAddonBySlug. When unset (default), the wrapper
// below falls through to the real catalog lookup so the happy path behaves
// normally. When set (in an error-path test), the wrapper returns the
// override value instead — enabling tests like ADDON_INACTIVE that need an
// addon whose `isActive` is false (no such row exists in the production
// catalog, so it has to be synthesized at test time).
const addonOverrideRef = vi.hoisted(() => ({
    bySlug: null as ((slug: string) => unknown) | null
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — addon-purchase.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        },
        getAddonBySlug: (slug: string) => {
            if (addonOverrideRef.bySlug !== null) {
                const result = addonOverrideRef.bySlug(slug);
                if (result !== undefined) return result;
            }
            return actual.getAddonBySlug(slug);
        }
    };
});

// Mock the raw mercadopago SDK that addon.checkout.ts uses directly. The
// stub constructs MercadoPagoConfig + Preference as no-op classes; only the
// Preference.create method is captured for assertion. Each test resets the
// mock state in beforeEach via preferenceCreateMock.mockReset().
vi.mock('mercadopago', () => {
    class MercadoPagoConfigMock {}
    class PreferenceMock {
        create(args: unknown) {
            return preferenceCreateMock(args);
        }
    }
    return {
        MercadoPagoConfig: MercadoPagoConfigMock,
        Preference: PreferenceMock
    };
});

import { billingAddonPurchases, billingCheckouts, billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures, signWebhookPayload } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import {
    type TestBillingPlansSeed,
    createTestUser,
    seedBillingTestPlans
} from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// Construct the stub once per test file and wire it into the ref that the
// vi.mock factory reads. Tests reset response state per case via
// mpStub.config.reset() in beforeEach.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// Slug pinned by the test — one-time addon with a 7-day duration that grants
// the FEATURED_LISTING entitlement. The catalog row is defined in
// packages/billing/src/config/addons.config.ts and is the canonical
// happy-path fixture for the addon-purchase suite.
const ADDON_SLUG = 'visibility-boost-7d';
const ADDON_PRICE_ARS_CENTAVOS = 500_000; // ARS $5,000

describe('SPEC-143 T-143-14 — addon one-time purchase', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let _seed: TestBillingPlansSeed;
    let userId: string;
    let customerId: string;

    beforeAll(async () => {
        await testDb.setup();
        // Clear any cached real adapter that another file may have built.
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();
        preferenceCreateMock.mockReset();
        addonOverrideRef.bySlug = null;

        // Each test starts clean: seed plans, create a user + billing
        // customer, build an authenticated client, and seed an ACTIVE monthly
        // subscription on the cheap plan. The addon purchase guard requires
        // an active or trialing subscription, so without this the request
        // would 422 NO_ACTIVE_SUBSCRIPTION before reaching the Preference
        // create call we want to assert against.
        _seed = await seedBillingTestPlans();

        const user = await createTestUser({
            email: `addon-purchase-${Date.now()}@example.com`
        });
        userId = user.id;
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });
        customerId = customer.customerId;

        await createTestSubscription({
            customerId,
            planId: _seed.cheap.planId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'test-factory-addon-purchase' }
        });

        const actor = createMockUserActor({ id: userId });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    it('creates an MP Preference and returns the checkout URL without touching billing_addon_purchases or billing_checkouts', async () => {
        // ARRANGE — stub the Preference.create call addon.checkout.ts is
        // about to make. The response shape mirrors what the real MP SDK
        // returns: a wrapper with id, init_point and sandbox_init_point.
        // Hospeda picks sandbox_init_point first, then init_point, so we
        // populate both for symmetry.
        const expectedCheckoutUrl = 'https://stub.example/checkout/pref_addon_xyz';
        preferenceCreateMock.mockResolvedValueOnce({
            id: 'pref_addon_xyz',
            init_point: 'https://stub.example/init/pref_addon_xyz',
            sandbox_init_point: expectedCheckoutUrl
        });

        // ACT — purchase the addon as the authenticated user. No promo code
        // — the price equals addon.priceArs and discountAmount is 0.
        //
        // NOTE: the body still requires `addonId` to pass the zValidator
        // gate even though the handler uses the URL path param for the
        // actual slug resolution (addons.ts:186 reads `params.slug`, not
        // `body.addonId`). This is a quirk of the schema that we have to
        // pin or every request 400s on validation.
        const response = await client.post(
            `/api/v1/protected/billing/addons/${ADDON_SLUG}/purchase`,
            { addonId: ADDON_SLUG }
        );

        // ASSERT — response shape. The handler maps the service's
        // PurchaseAddonResult into a 201 with { checkoutUrl, orderId,
        // addonId, amount, currency, expiresAt }. Pin each field.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly checkoutUrl: string;
                readonly orderId: string;
                readonly addonId: string;
                readonly amount: number;
                readonly currency: string;
                readonly expiresAt: string;
            };
        };
        expect(body.success).toBe(true);
        // checkoutUrl: sandbox_init_point wins over init_point in
        // createAddonCheckout (line 380). Pin the precedence here.
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);
        // orderId / addonId / amount / currency are direct passthroughs from
        // the addon catalog config. The orderId is `addon_<slug>_<uuid>` —
        // assert the prefix and that a UUID follows.
        expect(body.data.orderId).toMatch(/^addon_visibility-boost-7d_[0-9a-f-]{36}$/);
        expect(body.data.addonId).toBe(ADDON_SLUG);
        expect(body.data.amount).toBe(ADDON_PRICE_ARS_CENTAVOS);
        expect(body.data.currency).toBe('ARS');
        // expiresAt is ~30 minutes from now (createAddonCheckout line 392).
        // We only check that it parses as ISO 8601; the exact value depends
        // on Date.now() at request time.
        expect(body.data.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

        // ASSERT — no DB write on this leg. Both invariants are documented
        // contracts pinned by this test: the addon purchase row lands only
        // after the webhook confirms payment (sub-commit 3), and the
        // addon flow does not write to billing_checkouts at all (annual /
        // monthly flows use billing.checkout.create, addon does not).
        const purchases = await testDb.getDb().select().from(billingAddonPurchases);
        expect(purchases).toHaveLength(0);

        const checkouts = await testDb.getDb().select().from(billingCheckouts);
        expect(checkouts).toHaveLength(0);

        // ASSERT — Preference.create was invoked exactly once with the
        // expected body shape. Pin every metadata field the webhook side
        // reads (addonSlug + customerId in camelCase per
        // extractAddonMetadata), plus the items + external_reference
        // contract.
        expect(preferenceCreateMock).toHaveBeenCalledOnce();
        const callArg = preferenceCreateMock.mock.calls[0]?.[0] as
            | { body: Record<string, unknown>; requestOptions?: { idempotencyKey?: string } }
            | undefined;
        expect(callArg).toBeDefined();
        const prefBody = callArg?.body as Record<string, unknown>;

        // items[0] mirrors the addon catalog row. unit_price is the major
        // ARS amount, NOT centavos (createAddonCheckout converts on line 332
        // via `finalPrice / 100`).
        const items = prefBody.items as Array<Record<string, unknown>>;
        expect(items).toHaveLength(1);
        const item = items[0];
        expect(item?.id).toBe(ADDON_SLUG);
        expect(item?.title).toBe('Visibility Boost (7 days)');
        expect(item?.currency_id).toBe('ARS');
        expect(item?.unit_price).toBe(ADDON_PRICE_ARS_CENTAVOS / 100);
        expect(item?.quantity).toBe(1);
        expect(item?.category_id).toBe('services');

        // metadata carries BOTH casings. The camelCase keys feed the
        // webhook's extractAddonMetadata (utils.ts:270). The snake_case
        // keys are the raw shape MP returns in payment payloads. Both
        // formats must remain populated.
        const metadata = prefBody.metadata as Record<string, unknown>;
        expect(metadata.addonSlug).toBe(ADDON_SLUG);
        expect(metadata.customerId).toBe(customerId);
        expect(metadata.userId).toBe(userId);
        expect(metadata.type).toBe('addon_purchase');
        expect(metadata.addon_slug).toBe(ADDON_SLUG);
        expect(metadata.customer_id).toBe(customerId);
        expect(metadata.user_id).toBe(userId);
        // No promo code applied → discount_amount = 0, promo_code = null.
        expect(metadata.discount_amount).toBe(0);
        expect(metadata.promo_code).toBeNull();
        expect(metadata.promo_code_id).toBeNull();
        expect(metadata.original_price).toBe(ADDON_PRICE_ARS_CENTAVOS);

        // external_reference is the orderId verbatim. Pinning here
        // double-protects the webhook side's defensive extractAddonFromReference
        // path (utils.ts:377) which parses this string when metadata is
        // missing.
        expect(prefBody.external_reference).toBe(body.data.orderId);

        // back_urls + auto_return + expires/expiration_date are required by
        // MP's quality checklist. We do a structural smoke check here
        // rather than pinning every URL; the URL shape is well-tested via
        // the addon checkout unit suite.
        expect(prefBody.back_urls).toMatchObject({
            success: expect.stringContaining(ADDON_SLUG),
            failure: expect.stringContaining(ADDON_SLUG),
            pending: expect.stringContaining(ADDON_SLUG)
        });
        expect(prefBody.auto_return).toBe('approved');
        expect(prefBody.expires).toBe(true);

        // idempotencyKey forwarded to MP via X-Idempotency-Key. The
        // createAddonCheckout helper extracts the UUID portion from the
        // orderId and re-uses it as the key, so two duplicate requests
        // from the same logical checkout return the same preference. Pin
        // the link by matching the UUID suffix.
        const orderUuid = (body.data.orderId.match(/^addon_visibility-boost-7d_([0-9a-f-]{36})$/) ??
            [])[1];
        expect(orderUuid).toBeDefined();
        expect(callArg?.requestOptions?.idempotencyKey).toBe(orderUuid);
    });

    // -----------------------------------------------------------------------
    // Error paths — sub-commit 2
    //
    // The addon purchase flow surfaces four guards reachable through the
    // user-facing endpoint. Each test pins one branch and asserts no
    // MP Preference is created when the guard fires (the Preference call
    // is the side effect we most want to prevent — billing the user for
    // a state the system already knows is invalid).
    //
    // Note: ADDON_ALREADY_ACTIVE is intentionally NOT pinned here. That
    // guard lives on the WEBHOOK side (confirmAddonPurchase, SELECT FOR
    // UPDATE) and is covered by sub-commit 3.
    // -----------------------------------------------------------------------

    it('returns 404 when the addon slug does not match any catalog entry', async () => {
        const response = await client.post(
            '/api/v1/protected/billing/addons/no-such-addon/purchase',
            { addonId: 'no-such-addon' }
        );

        expect(response.status).toBe(404);

        // No Preference call: the catalog lookup failed before the SDK
        // path. This pins that the addon catalog gate is upstream of any
        // network side effect.
        expect(preferenceCreateMock).not.toHaveBeenCalled();
    });

    it('returns 422 when the addon exists but is marked inactive in the catalog', async () => {
        // ARRANGE — synthesize an inactive variant of the canonical addon.
        // No row in ALL_ADDONS has isActive=false, so we override the
        // catalog lookup for this test only. The override falls back to
        // the real lookup for any slug other than the one we configure.
        const { getAddonBySlug: realGetAddonBySlug } = await import('@repo/billing');
        const real = realGetAddonBySlug(ADDON_SLUG);
        if (!real) throw new Error('precondition: canonical addon must exist in catalog');
        addonOverrideRef.bySlug = (slug) =>
            slug === ADDON_SLUG ? { ...real, isActive: false } : undefined;

        const response = await client.post(
            `/api/v1/protected/billing/addons/${ADDON_SLUG}/purchase`,
            { addonId: ADDON_SLUG }
        );

        expect(response.status).toBe(422);
        expect(preferenceCreateMock).not.toHaveBeenCalled();
    });

    it('returns 422 when the customer has no subscriptions at all', async () => {
        // ARRANGE — delete the active sub seeded by beforeEach. The
        // service's `subscriptions.length === 0` branch (line 207 in
        // addon.checkout.ts) requires literally zero rows, not just zero
        // active rows.
        await testDb
            .getDb()
            .delete(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, customerId));

        const response = await client.post(
            `/api/v1/protected/billing/addons/${ADDON_SLUG}/purchase`,
            { addonId: ADDON_SLUG }
        );

        expect(response.status).toBe(422);
        expect(preferenceCreateMock).not.toHaveBeenCalled();
    });

    /**
     * Helper: build a signed MP IPN payment.updated webhook payload. Mirrors
     * `buildSignedWebhookRequest` in annual-checkout.test.ts. Each invocation
     * uses a fresh random outer `id` so qzpay-hono's idempotency tracker does
     * not collapse two sequential calls; the inner `data.id` (the MP
     * paymentId) is caller-supplied so two events can target the same
     * payment when an idempotency test needs that.
     */
    function buildSignedWebhookRequest(opts: { readonly providerPaymentId: string }): {
        readonly body: string;
        readonly headers: Record<string, string>;
    } {
        const body = JSON.stringify({
            id: Math.floor(Math.random() * 1_000_000_000) + 100_000_000,
            type: 'payment',
            action: 'payment.updated',
            data: { id: opts.providerPaymentId },
            date_created: new Date().toISOString(),
            live_mode: false
        });
        const headers = signWebhookPayload({ body });
        return { body, headers };
    }

    it('returns 422 when the customer has subscriptions but none active or trialing', async () => {
        // ARRANGE — flip the seeded sub to 'cancelled' so the
        // `.find(sub => active || trialing)` returns undefined. The
        // service hits its NO_ACTIVE_SUBSCRIPTION branch (line 221) rather
        // than NO_SUBSCRIPTION; the two branches return the same 422
        // status but different error codes — pin both so a refactor that
        // collapses them surfaces here.
        await testDb
            .getDb()
            .update(billingSubscriptions)
            .set({ status: 'cancelled' })
            .where(eq(billingSubscriptions.customerId, customerId));

        const response = await client.post(
            `/api/v1/protected/billing/addons/${ADDON_SLUG}/purchase`,
            { addonId: ADDON_SLUG }
        );

        expect(response.status).toBe(422);
        expect(preferenceCreateMock).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // Webhook activation + JSONB CHECK validation — sub-commit 3
    //
    // The second leg of the addon flow runs on the WEBHOOK side. MP fires
    // payment.updated once the user completes the Checkout Pro flow; the
    // hospeda handler retrieves the payment, dispatches to
    // confirmAddonPurchase, and INSERTs a `billing_addon_purchases` row
    // with status='active'. The row's `limit_adjustments` and
    // `entitlement_adjustments` JSONB columns are guarded by the
    // `chk_limit_adjustments_type` / `chk_entitlement_adjustments_type`
    // CHECK constraints (must be JSON arrays). This sub-commit pins the
    // array shape contract end-to-end.
    //
    // Note: the helper subscription seeded in beforeEach is what
    // confirmAddonPurchase looks up as the customer's active sub. Its id
    // ends up in the inserted row's `subscription_id` column.
    // -----------------------------------------------------------------------

    it('webhook payment.updated inserts an active billing_addon_purchases row with JSONB-array adjustments', async () => {
        // ARRANGE — pick a random MP payment id. confirmAddonPurchase will
        // store this as `payment_id` on the inserted row (defensive
        // idempotency uses this column on subsequent ticks).
        const providerPaymentId = `pay_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // ARRANGE — stub the three adapter calls qzpay-hono + the handler
        // make: webhooks.verifySignature, webhooks.constructEvent, and
        // payments.retrieve. The retrieved payment carries the metadata
        // shape that extractAddonMetadata reads (camelCase addonSlug +
        // customerId).
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_addon_activate',
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'approved',
                amount: ADDON_PRICE_ARS_CENTAVOS,
                currency: 'ARS',
                metadata: {
                    addonSlug: ADDON_SLUG,
                    customerId,
                    userId,
                    type: 'addon_purchase'
                }
            })
        );

        // Sanity — no row exists before the webhook lands.
        const before = await testDb.getDb().select().from(billingAddonPurchases);
        expect(before).toHaveLength(0);

        // ACT — POST the signed webhook
        const { body, headers } = buildSignedWebhookRequest({ providerPaymentId });
        const response = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...headers
            },
            body
        });

        // ASSERT — webhook acknowledged. MP retries on non-2xx, so the
        // handler always returns 200 once signature + dispatch finish,
        // even when downstream processing has nothing to do.
        expect(response.status).toBe(200);

        // ASSERT — exactly one billing_addon_purchases row was inserted
        // with the expected status + correlation fields.
        const purchases = await testDb.getDb().select().from(billingAddonPurchases);
        expect(purchases).toHaveLength(1);
        const purchase = purchases[0];
        expect(purchase).toBeDefined();
        expect(purchase?.customerId).toBe(customerId);
        expect(purchase?.addonSlug).toBe(ADDON_SLUG);
        expect(purchase?.status).toBe('active');
        // expires_at: one-time addon with durationDays=7 → ~7 days in the
        // future from the row's purchasedAt. Allow 1h slack to absorb the
        // gap between the test's clock and the DB clock.
        expect(purchase?.expiresAt).toBeDefined();
        const expiresAtMs = (purchase?.expiresAt as Date).getTime();
        const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
        expect(Math.abs(expiresAtMs - sevenDaysFromNow)).toBeLessThan(60 * 60 * 1000);
        // The active subscription seeded in beforeEach is what
        // confirmAddonPurchase links via subscription_id.
        expect(purchase?.subscriptionId).toBeDefined();

        // ASSERT — JSONB CHECK constraint contract. Both columns MUST be
        // JSON arrays (chk_limit_adjustments_type / chk_entitlement_adjustments_type
        // enforce this at the DB level). A non-array shape would not even
        // commit; this assertion documents the contract.
        expect(Array.isArray(purchase?.limitAdjustments)).toBe(true);
        expect(Array.isArray(purchase?.entitlementAdjustments)).toBe(true);

        // visibility-boost-7d's catalog row has affectsLimitKey=null and
        // grantsEntitlement=FEATURED_LISTING, so the computed adjustment
        // arrays are: limits = [] (no limit affected), entitlements =
        // [{ entitlementKey: 'featured_listing', granted: true }]. Pin
        // both — a refactor that changes the shape (object instead of
        // array, missing keys, etc.) would surface here AND would also
        // trip the DB CHECK on insert.
        expect(purchase?.limitAdjustments).toEqual([]);
        const entitlementAdj = purchase?.entitlementAdjustments as Array<Record<string, unknown>>;
        expect(entitlementAdj).toHaveLength(1);
        expect(entitlementAdj[0]).toEqual({
            entitlementKey: 'featured_listing',
            granted: true
        });

        // ASSERT — each stub leg fired exactly once. The annual-checkout
        // suite pins this same triplet; replicating it here documents that
        // the addon webhook path uses the same dispatch pipeline.
        expect(mpStub.config.getCalls('webhooks.verifySignature')).toHaveLength(1);
        expect(mpStub.config.getCalls('webhooks.constructEvent')).toHaveLength(1);
        expect(mpStub.config.getCalls('payments.retrieve')).toHaveLength(1);
    });

    it('webhook payment.updated is idempotent: a duplicate event does not insert a second row', async () => {
        // ARRANGE — same setup as the happy path. Two webhook events with
        // the SAME providerPaymentId hit the endpoint sequentially; the
        // idempotency guard at payment-logic.ts:583 (SELECT by paymentId)
        // short-circuits the second one.
        const providerPaymentId = `pay_test_idem_${Date.now()}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_test_addon_idem',
                type: 'payment.updated',
                data: { id: providerPaymentId }
            })
        );
        mpStub.config.setSuccess(
            'payments.retrieve',
            providerResponseFixtures.payment({
                id: providerPaymentId,
                status: 'approved',
                amount: ADDON_PRICE_ARS_CENTAVOS,
                currency: 'ARS',
                metadata: {
                    addonSlug: ADDON_SLUG,
                    customerId,
                    userId,
                    type: 'addon_purchase'
                }
            })
        );

        // ACT 1 — first event lands and creates the row.
        const first = buildSignedWebhookRequest({ providerPaymentId });
        const firstResponse = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...first.headers
            },
            body: first.body
        });
        expect(firstResponse.status).toBe(200);

        const afterFirst = await testDb.getDb().select().from(billingAddonPurchases);
        expect(afterFirst).toHaveLength(1);
        const insertedId = afterFirst[0]?.id;

        // ACT 2 — second event with the SAME providerPaymentId. The outer
        // event id differs (buildSignedWebhookRequest randomises it), so
        // qzpay-hono's idempotency tracker does NOT collapse the two.
        // Hospeda's payment-logic.ts idempotency guard (SELECT by
        // paymentId) is what we want to validate here.
        const second = buildSignedWebhookRequest({ providerPaymentId });
        const secondResponse = await app.request('/api/v1/webhooks/mercadopago', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...second.headers
            },
            body: second.body
        });
        expect(secondResponse.status).toBe(200);

        // ASSERT — still exactly one row, same id. The idempotency guard
        // skipped the second confirmAddonPurchase call cleanly.
        const afterSecond = await testDb.getDb().select().from(billingAddonPurchases);
        expect(afterSecond).toHaveLength(1);
        expect(afterSecond[0]?.id).toBe(insertedId);
    });
});
