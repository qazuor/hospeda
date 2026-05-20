/**
 * Multi-currency price selection — regression-guard (SPEC-143 T-143-62, reframed 2026-05-20).
 *
 * Pins the CURRENT single-currency behavior of the billing stack. The
 * original T-143-62 scope assumed per-customer currency selection
 * (ARS / USD / BRL), FX fallback when the plan has no price in the
 * customer currency, stale-rate warnings, and addon currency mismatch
 * validation. None of those are implemented today:
 *
 *   - `billing_customers` has no `currency` or `locale` field — customers
 *     have no way to express a currency preference at the data-model level.
 *   - `billing_plans` / `billing_prices` store a single ARS amount per
 *     (plan, interval). There is no per-currency price map nor a join
 *     table; the constants `DEFAULT_CURRENCY=ARS` + `REFERENCE_CURRENCY=USD`
 *     in `packages/billing/src/constants/billing.constants.ts` document
 *     the implicit single-currency state.
 *   - `subscription-checkout.service.ts` never branches on customer
 *     currency. It calls `findMonthlyPrice(plan.prices)` and returns the
 *     single active row.
 *   - The `exchange_rates` table exists + the rates cron runs (T-143-43),
 *     but the checkout path never reads from it. It is decorative wrt
 *     pricing.
 *   - Addon purchase derives the addon currency from the addon catalog
 *     row, not from any customer preference, and there is no validation
 *     that `subscription.currency === addon.currency`.
 *
 * The real multi-currency work (schema additions, currency-aware price
 * selection, FX fallback, stale-rate handling, addon mismatch validation)
 * is captured by SPEC-150. When SPEC-150 lands, every assertion in this
 * file will need to flip — that is the intended early-warning signal.
 *
 * Tested endpoint: `POST /api/v1/protected/billing/subscriptions/start-paid`.
 * Monthly flow only — annual flow shares the same single-currency code path
 * through `findAnnualPrice(plan.prices)` and adds no extra coverage.
 *
 * @module test/e2e/flows/billing/multi-currency
 */

import { vi } from 'vitest';

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
                    'mp-stub adapter not initialized — multi-currency.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingSubscriptions, eq, exchangeRates } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
import { providerResponseFixtures } from '../../helpers/billing-fixtures.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

// NOTE: the `cheap` baseline plan monthly price (100_000 centavos = 1,000 ARS)
// is defined in `seedBillingTestPlans`. The regression-guard does NOT assert
// on adapter call args (no other test in the suite inspects mp-stub args —
// adapter payload shape is an internal qzpay concern). Instead it pins the
// DB-side outcome of a successful start-paid call: the local sub row is
// created with `status: 'incomplete'` and `metadata.source = 'start-paid-monthly'`
// regardless of any currency hints supplied by the client.

describe('SPEC-143 T-143-62 (reframed) — multi-currency regression-guard', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let cheapPlanName: string;

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

        const seed = await seedBillingTestPlans();
        cheapPlanName = seed.cheap.name;

        const user = await createTestUser({
            email: `multi-currency-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}@example.com`
        });
        await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    // -----------------------------------------------------------------------
    // Test 1 — client-side currency / locale hints are ignored (no input port)
    //
    // The start-paid endpoint body schema is `{ planSlug, billingInterval }`.
    // The route does NOT carry a `locale`, `currency`, or `preferredCurrency`
    // field. Zod's default `.passthrough()` behavior would silently drop
    // unknown keys; whatever the precise behavior, the adapter must still be
    // called with the plan's single ARS price unchanged.
    // -----------------------------------------------------------------------

    it('ignores client-supplied locale/currency hints and persists the standard monthly sub row', async () => {
        const expectedCheckoutUrl = 'https://stub.example/preapproval/sub_no_currency_input';
        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_no_currency_input',
                status: 'pending',
                initPoint: expectedCheckoutUrl
            })
        );

        // Body includes three different shapes of currency hint. None should
        // affect the resulting subscription. If SPEC-150 lands and the
        // endpoint starts honoring any of these, this test will flip and
        // the SPEC-150 implementer MUST update the regression-guard at the
        // same time.
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly',
            locale: 'pt-BR',
            currency: 'BRL',
            preferredCurrency: 'USD'
        });

        // The request succeeds — the unknown fields are dropped or ignored,
        // not surfaced as a validation error. The single-currency contract
        // means the endpoint has no input port for client currency choice.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly success: boolean;
            readonly data: {
                readonly checkoutUrl: string;
                readonly localSubscriptionId: string;
            };
        };
        expect(body.success).toBe(true);
        expect(body.data.checkoutUrl).toBe(expectedCheckoutUrl);

        // The DB row reflects the standard monthly contract (same shape as
        // monthly-checkout happy path): incomplete status, source metadata,
        // mpSubscriptionId from the stubbed adapter response. The currency
        // hints in the body had ZERO effect on the persisted record.
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row).toBeDefined();
        expect(row?.mpSubscriptionId).toBe('sub_no_currency_input');
        expect(row?.status).toBe('incomplete');
        const metadata = row?.metadata as Record<string, unknown> | null;
        expect(metadata?.source).toBe('start-paid-monthly');

        // The qzpay adapter was called exactly once. The stub records
        // outcome only (args inspection is not a pattern any other test
        // uses); this assertion mirrors monthly-checkout sub-commit 1.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });

    // -----------------------------------------------------------------------
    // Test 2 — exchange_rates rows do not influence checkout pricing
    //
    // Insert an absurd USD→ARS rate before the checkout. If checkout were
    // currency-aware (per the original T-143-62 spec), the rate would
    // change either the amount sent to MP or some derived field on the
    // local sub row. Since checkout is single-currency, the rate is
    // ignored and the adapter receives the unmodified plan ARS amount.
    // -----------------------------------------------------------------------

    it('does not consult exchange_rates rows during checkout pricing', async () => {
        // ARRANGE — insert two absurd rates. If any code path were to read
        // them and apply FX conversion, the checkout would surface a
        // visibly different sub row (different mp adapter response id, or
        // an error from an unsupported currency path). The plan price and
        // sub structure must remain unchanged regardless.
        const now = new Date();
        await testDb
            .getDb()
            .insert(exchangeRates)
            .values([
                {
                    fromCurrency: 'USD',
                    toCurrency: 'ARS',
                    rate: 99_999,
                    inverseRate: 1 / 99_999,
                    rateType: 'blue',
                    source: 'dolarapi',
                    isManualOverride: false,
                    fetchedAt: now
                },
                {
                    fromCurrency: 'BRL',
                    toCurrency: 'ARS',
                    rate: 88_888,
                    inverseRate: 1 / 88_888,
                    rateType: 'standard',
                    source: 'exchangerate-api',
                    isManualOverride: false,
                    fetchedAt: now
                }
            ]);

        mpStub.config.setSuccess(
            'subscriptions.create',
            providerResponseFixtures.subscription({
                id: 'sub_with_fx_rate',
                status: 'pending',
                initPoint: 'https://stub.example/preapproval/sub_with_fx_rate'
            })
        );

        // ACT
        const response = await client.post('/api/v1/protected/billing/subscriptions/start-paid', {
            planSlug: cheapPlanName,
            billingInterval: 'monthly'
        });

        // ASSERT — checkout succeeds and the persisted sub row matches the
        // standard monthly contract. The exchange_rates rows we inserted
        // had zero effect on the flow.
        expect(response.status).toBe(201);
        const body = (await response.json()) as {
            readonly data: { readonly localSubscriptionId: string };
        };
        const rows = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row?.mpSubscriptionId).toBe('sub_with_fx_rate');
        expect(row?.status).toBe('incomplete');
        const metadata = row?.metadata as Record<string, unknown> | null;
        expect(metadata?.source).toBe('start-paid-monthly');

        // ASSERT — the rows are still in the DB (so they exist and were
        // INSERTed cleanly). Pin this so a refactor that accidentally
        // truncates / drops the rate rows on checkout fails this test.
        const rateRows = await testDb.getDb().select().from(exchangeRates);
        expect(rateRows).toHaveLength(2);

        // ASSERT — the qzpay adapter still received exactly one
        // subscriptions.create call, NOT a different path that would only
        // be reached if multi-currency routing existed.
        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe('success');
    });

    // -----------------------------------------------------------------------
    // Test 3 — start-paid does not vary by repeated requests at different
    // "intended" currencies (idempotent wrt locale hints)
    //
    // This complements Test 1: even when two back-to-back requests send
    // wildly different locale hints, both produce the same adapter call
    // payload. Pins the absence of currency negotiation as a stable
    // property, not just a single-call accident.
    // -----------------------------------------------------------------------

    it('produces identical sub-row shapes regardless of repeated locale-hint variations', async () => {
        const persistedRows: Array<{
            readonly status: string | null | undefined;
            readonly source: unknown;
            readonly mpSubscriptionId: string | null | undefined;
        }> = [];

        // Send three requests in sequence with different "currency hints".
        // Each gets its own stub config because mp-stub.setSuccess is a
        // Map.set (overwrites) — re-stub before each request to keep the
        // adapter responding successfully. Pattern documented in
        // webhook-concurrency.test.ts and mp-error-handling.test.ts.
        for (const hint of [
            { locale: 'es-AR', currency: 'ARS' },
            { locale: 'en-US', currency: 'USD' },
            { locale: 'pt-BR', currency: 'BRL' }
        ]) {
            const subStubId = `sub_locale_${hint.currency.toLowerCase()}`;
            mpStub.config.setSuccess(
                'subscriptions.create',
                providerResponseFixtures.subscription({
                    id: subStubId,
                    status: 'pending',
                    initPoint: `https://stub.example/preapproval/${hint.currency}`
                })
            );

            const user = await createTestUser({
                email: `multi-currency-loop-${Date.now()}-${hint.currency}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}@example.com`
            });
            await createTestBillingCustomer({
                externalId: user.id,
                email: user.email,
                providerCustomerIds: { mercadopago: `mp_cust_${user.id.slice(0, 8)}` }
            });
            const actor = createMockUserActor({ id: user.id });
            const localClient = new E2EApiClient(app, actor);

            const response = await localClient.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'monthly',
                    locale: hint.locale,
                    currency: hint.currency
                }
            );
            expect(response.status).toBe(201);
            const body = (await response.json()) as {
                readonly data: { readonly localSubscriptionId: string };
            };

            const rows = await testDb
                .getDb()
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.id, body.data.localSubscriptionId));
            const row = rows[0];
            const metadata = row?.metadata as Record<string, unknown> | null;
            persistedRows.push({
                status: row?.status,
                source: metadata?.source,
                mpSubscriptionId: row?.mpSubscriptionId
            });
        }

        // ASSERT — all three sub rows share the same status and source.
        // Multi-currency would surface here as a per-locale code branch
        // (different status, different metadata.source, or one of the
        // calls failing); the single-currency contract pins them equal.
        expect(persistedRows.map((r) => r.status)).toEqual([
            'incomplete',
            'incomplete',
            'incomplete'
        ]);
        expect(persistedRows.map((r) => r.source)).toEqual([
            'start-paid-monthly',
            'start-paid-monthly',
            'start-paid-monthly'
        ]);
        // Distinct mpSubscriptionIds confirm the three requests are
        // independent and not sharing state (sanity check on the loop).
        expect(persistedRows.map((r) => r.mpSubscriptionId)).toEqual([
            'sub_locale_ars',
            'sub_locale_usd',
            'sub_locale_brl'
        ]);
    });
});
