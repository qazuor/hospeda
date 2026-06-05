/**
 * SPEC-145 T-017 — Addon limit elevation and expiry at route level
 *
 * Validates that the accommodation-creation limit gate correctly reflects
 * addon-driven limit changes IMMEDIATELY — without manual cache clears
 * between the addon lifecycle action and the gate assertion.
 *
 * Scenarios:
 *
 * 1. AT-CAP BLOCK
 *    - Customer on owner-basico (MAX_ACCOMMODATIONS=1) with 1 accommodation
 *      in the DB → POST /accommodations/draft → 403 LIMIT_REACHED.
 *
 * 2. ADDON ACTIVATION ELEVATION
 *    - Grant the extra-accommodations-5 addon through the REAL confirm path:
 *        POST /billing/addons/extra-accommodations-5/purchase (checkout create)
 *        POST /webhooks/mercadopago (payment.updated → confirmAddonPurchase →
 *              applyAddonEntitlements → billing.limits.set → clearEntitlementCache
 *              via addon.checkout.ts)
 *    - POST /accommodations/draft for the 2nd accommodation → 201 (limit now 1+5=6).
 *      NO manual cache clear between webhook and assertion.
 *
 * 3. ADDON EXPIRY RESTRICTION
 *    - Expire the addon via the REAL addon-expiry cron:
 *        addonExpiryJob.handler() → AddonExpirationService.processExpiredAddons →
 *              expireAddon → AddonEntitlementService.removeAddonEntitlements →
 *              billing.limits.removeBySource — does NOT call clearEntitlementCache
 *              (the cron path does not clear the in-process cache; the next
 *              billingCustomerMiddleware tick re-loads from DB).
 *    - Because the expiry path does not call clearEntitlementCache, the test DOES
 *      call clearEntitlementCache(customerId) before the post-expiry assertion.
 *      This is DOCUMENTED below — the test is asserting that the DB state after
 *      expiry is correct and that the limit gate re-enforces after a cache reset.
 *      The in-process cache-clear on expiry is a separate concern tracked by the
 *      cron authors; this file pins the DB-level + route-level lifecycle contract.
 *
 * Real paths used (documented here as lifecycle-wiring evidence):
 *
 *   ADDON ACTIVATE:
 *     POST /billing/addons/{slug}/purchase
 *     → AddonService.purchase → createAddonCheckout (addon.checkout.ts)
 *     → billing.checkout.create (qzpay-core + mpStub)
 *     → payment.updated webhook → confirmAddonPurchase (payment-logic.ts:583+)
 *     → applyAddonEntitlements → billing.limits.set (for affectsLimitKey addons)
 *     → clearEntitlementCache (addon.checkout.ts route level)
 *
 *   ADDON EXPIRE:
 *     addonExpiryJob.handler (apps/api/src/cron/jobs/addon-expiry.job.ts)
 *     → AddonExpirationService.processExpiredAddons
 *     → expireAddon → AddonEntitlementService.removeAddonEntitlements
 *     → billing.limits.removeBySource (removes the addon-source aggregated limit)
 *     NOTE: in-process clearEntitlementCache NOT called by this cron path.
 *           Test explicitly calls it to assert the route-level state after expiry.
 *
 * Addon under test: extra-accommodations-5 (recurring, affectsLimitKey=MAX_ACCOMMODATIONS,
 *   limitIncrease=5, targetCategories=['owner'], isActive=true, priceArs=1_000_000).
 *
 * The addon catalog row is written to the DB via createTestAddon (required after
 * SPEC-127: the purchase handler reads the catalog from billing_addons via
 * AddonCatalogService, not from the static @repo/billing config).
 *
 * @module test/e2e/flows/billing/enforcement-addon-elevation
 */

import { vi } from 'vitest';

// vi.hoisted + vi.mock for createMercadoPagoAdapter.
// Same pattern as enforcement-gates.test.ts — the billing instance initialises
// the adapter at construction time even though the limit-enforcement middleware
// itself does not call MP. Without the stub the adapter constructor throws at boot.
const stubRef = vi.hoisted(() => ({
    current: null as unknown
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        createMercadoPagoAdapter: () => {
            if (stubRef.current === null) {
                throw new Error(
                    'mp-stub adapter not initialized — enforcement-addon-elevation.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { randomUUID } from 'node:crypto';
import { accommodations, destinations, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { addonExpiryJob } from '../../../../src/cron/jobs/addon-expiry.job.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { clearEntitlementCache } from '../../../../src/middlewares/entitlement.js';
import { createMockActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import {
    createTestAddon,
    createTestBillingCustomer,
    createTestSubscription
} from '../../helpers/billing-factories.js';
import { providerResponseFixtures, signWebhookPayload } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestPlan, createTestUser } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

// MP stub — required even though limit-enforcement does not call the adapter.
const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// ---------------------------------------------------------------------------
// Canonical addon under test
// extra-accommodations-5: recurring, affectsLimitKey=MAX_ACCOMMODATIONS,
// limitIncrease=5, targetCategories=['owner']
// ---------------------------------------------------------------------------

/** Canonical slug as defined in packages/billing/src/config/addons.config.ts. */
const ADDON_SLUG = 'extra-accommodations-5';

/**
 * Price in centavos (ARS 10,000 = 1,000,000 centavos) matching the
 * canonical catalog definition. The purchase route validates the catalog
 * price; having the test mirror it keeps the checkout stub amount correct.
 */
const ADDON_PRICE_ARS_CENTAVOS = 1_000_000; // ARS $10,000/month

// ---------------------------------------------------------------------------
// Entitlement / limit key string constants
// Copied as literals to avoid mock entanglement with @repo/billing.
// ---------------------------------------------------------------------------

const E = {
    PUBLISH_ACCOMMODATIONS: 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO: 'edit_accommodation_info',
    VIEW_BASIC_STATS: 'view_basic_stats'
} as const;

const L = {
    MAX_ACCOMMODATIONS: 'max_accommodations'
} as const;

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

/**
 * Actor for accommodation draft creation.
 * Needs ACCOMMODATION_CREATE so the route-level permission guard passes
 * before the limit check fires.
 */
function makeAccommodationCreateActor(userId: string): Actor {
    return createMockActor(
        RoleEnum.USER,
        [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCOMMODATION_CREATE
        ],
        userId
    );
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/** Assert a response is a 403 LIMIT_REACHED gate block. */
async function expectLimitReached(res: Response): Promise<void> {
    expect(res.status, `expected 403 LIMIT_REACHED but got ${res.status}`).toBe(403);
    const body = (await res.json()) as {
        success: boolean;
        error: { code: string };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('LIMIT_REACHED');
}

/**
 * Assert the limit gate passed (NOT 403 LIMIT_REACHED).
 * Returns the status for callers that need to assert a specific success code.
 */
async function expectLimitGatePassed(res: Response): Promise<number> {
    if (res.status === 403) {
        const body = (await res.clone().json()) as { error?: { code?: string } };
        expect(
            body?.error?.code,
            'Limit gate should have passed but got 403 LIMIT_REACHED'
        ).not.toBe('LIMIT_REACHED');
    }
    return res.status;
}

// ---------------------------------------------------------------------------
// Helper: build + sign an MP IPN payment.updated webhook payload.
// Mirrors the pattern from addon-purchase.test.ts / plan-upgrade.test.ts.
// ---------------------------------------------------------------------------

function buildSignedWebhookRequest(opts: {
    readonly providerPaymentId: string;
}): { readonly body: string; readonly headers: Record<string, string> } {
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

// ---------------------------------------------------------------------------
// Minimal CronJobContext for addonExpiryJob.handler invocation.
// Mirrors addon-expiration-cron.test.ts buildCronContext().
// ---------------------------------------------------------------------------

function buildCronContext(): Parameters<typeof addonExpiryJob.handler>[0] {
    return {
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined
        },
        startedAt: new Date(),
        dryRun: false
    };
}

// ---------------------------------------------------------------------------
// Main suite
// ---------------------------------------------------------------------------

describe('SPEC-145 T-017 — addon limit elevation and expiry at route level', () => {
    let app: ReturnType<typeof initApp>;

    // Shared plan id — seeded in beforeEach.
    let ownerBasicoPlanId: string;

    beforeAll(async () => {
        await testDb.setup();
        resetBillingInstance();
        app = initApp();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    beforeEach(async () => {
        mpStub.config.reset();

        // owner-basico: PUBLISH + EDIT + VIEW_BASIC, MAX_ACCOMMODATIONS=1.
        // The limit value (1) must match the owner-basico canonical plan config
        // so the enforcement middleware resolves the correct base limit.
        // The test plan uses the canonical slug value in the metadata so any
        // limit resolution that reads the plan's metadata.slug falls back to
        // the config — but for the e2e route the planId (UUID) is what matters
        // and the limits column carries { max_accommodations: 1 }.
        const ownerBasico = await createTestPlan({
            name: `AddonElevation-OwnerBasico-${randomUUID().slice(0, 8)}`,
            entitlements: [E.PUBLISH_ACCOMMODATIONS, E.EDIT_ACCOMMODATION_INFO, E.VIEW_BASIC_STATS],
            limits: { [L.MAX_ACCOMMODATIONS]: 1 }
        });
        ownerBasicoPlanId = ownerBasico.planId;

        // Seed the addon catalog row. After SPEC-127 the purchase handler reads
        // from billing_addons (DB) via AddonCatalogService. Without this row the
        // service returns NOT_FOUND for every purchase request and the checkout
        // path is never reached.
        //
        // The targetCategories metadata value determines whether the plan-category
        // guard in createAddonCheckout fires. We pass ['owner'] which is the
        // canonical value; the ownerBasico plan has category='test' (the test
        // plan default from createTestPlan), so the guard DOES fire. To suppress
        // the guard cleanly, use a targetCategories that passes the resolver's
        // filter (which only keeps 'owner' | 'complex' values). Since 'test'
        // is not in ['owner', 'complex'], the filter strips it → totalLength=0
        // → guard skipped. So we use ['owner'] as targetCategories to match the
        // production addon definition AND accept the guard check, but the test
        // plan is given metadata.category='owner' (overriding the default 'test').
        // The addon catalog row must carry the correct `limits` field so
        // AddonCatalogService.mapper.resolveLimitFields reads:
        //   affectsLimitKey = 'max_accommodations'  (from the JSONB key)
        //   limitIncrease   = 5                      (from the JSONB value)
        //
        // Without this, `addon.affectsLimitKey` is null inside
        // applyAddonEntitlements and the limits.set() call is skipped.
        //
        // targetCategories: ['test-baseline'] — the resolveTargetCategories
        // mapper in createAddonCheckout only keeps 'owner' | 'complex' entries;
        // 'test-baseline' is stripped → empty array → plan-category guard skipped.
        await createTestAddon({
            slug: ADDON_SLUG,
            name: 'Extra Accommodations Pack (+5)',
            description: 'Adds 5 additional accommodations to your plan. Renews monthly.',
            billingType: 'recurring',
            unitAmount: ADDON_PRICE_ARS_CENTAVOS,
            active: true,
            limits: { [L.MAX_ACCOMMODATIONS]: 5 },
            metadata: {
                slug: ADDON_SLUG,
                durationDays: null,
                targetCategories: ['test-baseline'], // filter strips to [] → guard skipped
                sortOrder: 4
            }
        });
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // =========================================================================
    // The full 3-phase lifecycle in a single test:
    //
    //   Phase 1: AT-CAP → LIMIT_REACHED (base plan limit = 1, already at 1)
    //   Phase 2: ADDON ACTIVATE → limit elevated to 6 → create #2 succeeds
    //   Phase 3: ADDON EXPIRE → limit back to base (1) → cache reset → 403 again
    // =========================================================================

    it('addon limit elevation: at-cap → 403; activate addon → 201; expire addon → 403 again', async () => {
        // ── Arrange: user + customer + active subscription ────────────────────

        const user = await createTestUser({
            email: `addon-elevation-${randomUUID().slice(0, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email
        });

        // Subscription planId = ownerBasicoPlanId (UUID).
        // recalculateAddonLimitsForCustomer resolves the base plan limit from
        // the billing_plans.limits column (not from getPlanBySlug), so using
        // the UUID is correct here — unlike addon-cancel-recalc.test.ts which
        // uses the canonical slug because it tests the recalc path that calls
        // getPlanBySlug. In this test we exercise the full route path which
        // reads limits from the DB plan row.
        const _sub = await createTestSubscription({
            customerId: customer.customerId,
            planId: ownerBasicoPlanId,
            status: 'active',
            billingInterval: 'month',
            intervalCount: 1,
            metadata: { source: 'test-addon-elevation' }
        });

        // Cold cache after setup.
        clearEntitlementCache(customer.customerId);

        const actor = makeAccommodationCreateActor(user.id);
        const draftClient = new E2EApiClient(app, actor);

        // ── Phase 1: seed 1 accommodation (at cap) → POST /draft → 403 ────────

        // Seed a destination so the accommodations.destinationId FK is satisfied.
        const destId = randomUUID();
        await testDb
            .getDb()
            .insert(destinations)
            .values({
                id: destId,
                destinationType: 'CITY',
                path: `/addon-elev-dest-${destId}`,
                slug: `addon-elev-dest-${destId}`,
                name: `Addon Elevation Dest ${destId}`,
                summary: 'Test destination for addon elevation',
                description: 'Test destination for addon elevation test',
                location: { country: 'AR', state: 'ER', city: 'CDU' }
            } as typeof destinations.$inferInsert);

        // Factory-insert 1 accommodation row directly (puts the user at cap=1).
        // The limit middleware counts via AccommodationService.count({ ownerId: actor.id }),
        // which queries the accommodations table directly — transparent to direct inserts.
        await testDb
            .getDb()
            .insert(accommodations)
            .values({
                slug: `addon-elev-accom-${randomUUID().slice(0, 8)}`,
                name: 'At-cap accommodation',
                summary: 'At cap for addon elevation test',
                type: 'APARTMENT',
                description: 'Direct-insert accommodation at cap',
                ownerId: user.id,
                destinationId: destId
            } as typeof accommodations.$inferInsert);

        // Attempt to create #2 via the real route — should hit LIMIT_REACHED.
        const atCapRes = await draftClient.post('/api/v1/protected/accommodations/draft', {
            name: 'Second Accommodation (at cap)',
            summary: 'Should be blocked by limit',
            type: 'APARTMENT',
            destinationId: destId
        });
        await expectLimitReached(atCapRes);

        // ── Phase 2: activate addon → limit → 6 → create #2 succeeds ─────────

        // Step 2a: POST /billing/addons/{slug}/purchase (initiate checkout).
        // The purchase handler reads the catalog row seeded in beforeEach and calls
        // billing.checkout.create (routed through qzpay-core + mpStub after SPEC-127).
        mpStub.config.reset();
        mpStub.config.setSuccess(
            'checkout.create',
            providerResponseFixtures.checkout({
                id: 'chk_addon_elev_test',
                url: 'https://stub.example/checkout/addon-elev-test',
                status: 'pending'
            })
        );

        // The purchase route uses the actor's billing customer (resolved via
        // externalId from actor.id). We need a user-actor (not a permission-based
        // actor) for the purchase route because the billing middleware resolves
        // the customer by actor.id (external_id FK).
        const { createMockUserActor } = await import('../../../helpers/auth.js');
        const purchaseClient = new E2EApiClient(app, createMockUserActor({ id: user.id }));

        const purchaseRes = await purchaseClient.post(
            `/api/v1/protected/billing/addons/${ADDON_SLUG}/purchase`,
            { addonId: ADDON_SLUG }
        );
        expect(purchaseRes.status, `purchase returned ${purchaseRes.status}`).toBe(201);
        const purchaseBody = (await purchaseRes.json()) as {
            readonly success: boolean;
            readonly data: { readonly checkoutUrl: string };
        };
        expect(purchaseBody.success).toBe(true);
        expect(purchaseBody.data.checkoutUrl).toContain('stub.example');

        mpStub.config.reset();

        // Step 2b: fire the payment.updated webhook (confirmAddonPurchase).
        // confirmAddonPurchase:
        //   - INSERTs a billing_addon_purchases row with status='active'
        //   - applyAddonEntitlements writes billing_customer_limits via billing.limits.set
        //   - The route (addons.ts cancelAddonRoute) clears the entitlement cache
        //   NOTE: the ACTIVATE path's clearEntitlementCache is called from the
        //         addon.checkout.ts confirmAddonPurchase path — the webhook handler
        //         calls clearEntitlementCache after applyAddonEntitlements.
        const providerPaymentId = `pay_addon_elev_${randomUUID()}`;
        mpStub.config.setSuccess('webhooks.verifySignature', true);
        mpStub.config.setSuccess(
            'webhooks.constructEvent',
            providerResponseFixtures.webhookEvent({
                id: 'evt_addon_elev_activate',
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
                // extractAddonMetadata reads camelCase keys from payment.metadata.
                metadata: {
                    addonSlug: ADDON_SLUG,
                    customerId: customer.customerId,
                    userId: user.id,
                    type: 'addon_purchase'
                }
            })
        );

        const { body: whBody, headers: whHeaders } = buildSignedWebhookRequest({
            providerPaymentId
        });
        const whRes = await app.request('/api/v1/webhooks/mercadopago?source_news=webhooks', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'mp-webhook-test',
                ...whHeaders
            },
            body: whBody
        });
        expect(whRes.status, `webhook returned ${whRes.status}`).toBe(200);

        // Verify addon purchase row was created (confirms confirmAddonPurchase ran).
        const purchaseRows = (
            await testDb.getDb().execute(sql`
                SELECT id, status, addon_slug, customer_id
                FROM billing_addon_purchases
                WHERE customer_id = ${customer.customerId}
                  AND addon_slug = ${ADDON_SLUG}
                  AND status = 'active'
            `)
        ).rows as Array<{ id: string; status: string; addon_slug: string }>;
        expect(purchaseRows).toHaveLength(1);
        const addonPurchaseId = purchaseRows[0]?.id;
        expect(addonPurchaseId).toBeDefined();

        // Step 2c: create #2 via the real route — limit is now 1 (base) + 5 (addon) = 6.
        // The webhook called clearEntitlementCache, so the gate re-loads limits
        // from the DB which now includes the addon-source row.
        // NO manual clearEntitlementCache here — the webhook cleared the cache.
        const afterActivateRes = await draftClient.post('/api/v1/protected/accommodations/draft', {
            name: 'Second Accommodation (after addon)',
            summary: 'Should be allowed by elevated limit',
            type: 'APARTMENT',
            destinationId: destId
        });
        // Gate passes → 201 or post-gate service error (FK, etc.) — gate did NOT fire.
        const status2 = await expectLimitGatePassed(afterActivateRes);
        // The request reaches the handler — either 201 (row created) or a service-level
        // error (unlikely given the valid destId). Assert it is not 403 LIMIT_REACHED.
        expect(status2, `Expected non-403 after addon activated but got ${status2}`).toBe(201);

        // ── Phase 3: expire addon → limit back to base → 403 after cache reset ─

        // Mark the addon purchase as expired by setting expiresAt in the past.
        // The addonExpiryJob.handler uses findExpiredAddons which filters:
        //   status='active' AND expiresAt IS NOT NULL AND expiresAt <= now.
        // We update the row directly to avoid time-travel mocks.
        const pastExpiry = new Date(Date.now() - 60 * 1000); // 60 seconds ago
        await testDb.getDb().execute(sql`
            UPDATE billing_addon_purchases
               SET expires_at = ${pastExpiry}
             WHERE id = ${addonPurchaseId}
        `);

        mpStub.config.reset();
        const cronCtx = buildCronContext();
        const cronResult = await addonExpiryJob.handler(cronCtx);

        expect(cronResult.success).toBe(true);
        // At least one row processed (the one we just expired).
        expect(cronResult.processed).toBeGreaterThanOrEqual(1);

        // Verify purchase row flipped to 'expired'.
        const expiredRows = (
            await testDb.getDb().execute(sql`
                SELECT status FROM billing_addon_purchases WHERE id = ${addonPurchaseId}
            `)
        ).rows as Array<{ status: string }>;
        expect(expiredRows[0]?.status).toBe('expired');

        // The addon-expiry cron does NOT call clearEntitlementCache (it removes the
        // billing_customer_limits row but does not flush the in-process cache).
        // We must call it manually to assert the gate state after expiry.
        // This is DOCUMENTED: the test pins the DB-level + route-level lifecycle
        // contract, not the in-process cache-clear behavior of the cron.
        clearEntitlementCache(customer.customerId);

        // Attempt to create a 3rd accommodation (would be #3, but limit is back to 1
        // and there are already 2 rows — accommodation #1 factory-inserted and
        // accommodation #2 created via the route). Assert 403 LIMIT_REACHED.
        const afterExpireRes = await draftClient.post('/api/v1/protected/accommodations/draft', {
            name: 'Third Accommodation (after addon expiry)',
            summary: 'Should be blocked — limit reverted to base',
            type: 'APARTMENT',
            destinationId: destId
        });
        await expectLimitReached(afterExpireRes);
    });
});
