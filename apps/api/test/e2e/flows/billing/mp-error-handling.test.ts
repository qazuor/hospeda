/**
 * MercadoPago API error handling — regression-guard (SPEC-143 T-143-59, reframed 2026-05-20).
 *
 * Pins the CURRENT behavior of the start-paid endpoint when the MP adapter
 * surfaces any of the documented error modes. The contract under test is
 * deliberately broad and reflects what we observe today, NOT what the
 * task description originally envisioned. The original assertions
 * ("user gets actionable error", "Sentry captures correct context",
 * "retry policy followed") are blocked by qzpay-core's
 * `providerSyncErrorStrategy: 'log'` default — see
 * [[bug/qzpay-provider-sync-error-log-strategy]] and SPEC-149 for the
 * planned refactor.
 *
 * Current behavior pinned here:
 *
 *   - EVERY MP error mode (4xx, 5xx, timeout, malformed) surfaces to the
 *     user as HTTP 500 with the generic message
 *     "Failed to start paid subscription. Please try again."
 *   - The local subscription row IS persisted (qzpay's log strategy
 *     intentionally retains the local record so the user can retry by
 *     hitting the endpoint again — no orphan cleanup needed).
 *   - The adapter call is recorded with `outcome: 'error'` (or
 *     `'malformed'` / `'timeout'` for those modes) on the mp-stub call
 *     log. The downstream pipeline did NOT proceed past the failing
 *     call.
 *
 * When SPEC-149 lands the assertions in this file will need updates
 * (e.g. 429 → 503, timeout → 504, 422 → 422). Until then this file is
 * the single point of truth for "what does the user see when MP fails".
 *
 * Tested endpoint: `POST /api/v1/protected/billing/subscriptions/start-paid`
 *   - Annual flow (uses `checkout.create` adapter call).
 *   - Monthly flow (uses `subscriptions.create` adapter call).
 *
 * Out of scope:
 *   - Sentry capture assertions — there is no capture in this path today.
 *     Tracked separately in [[bug/no-sentry-on-start-paid-mp-errors]].
 *   - Retry policy assertions — no retry today. Tracked separately in
 *     [[bug/no-retry-policy-on-mp-errors]].
 *   - Error mode differentiation — all map to 500. Tracked in SPEC-149.
 *   - Addon purchase, plan-change, refund error paths — same shape, but
 *     scope-limited to start-paid here. SPEC-149 will widen coverage.
 *
 * @module test/e2e/flows/billing/mp-error-handling
 */

import { vi } from 'vitest';

// vi.hoisted runs BEFORE every import. The ref object is shared between
// the vi.mock factory (captured at hoist time) and the top-level code
// below (which fills `current` once the stub is constructed).
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
                    'mp-stub adapter not initialized — mp-error-handling.test.ts must wire stubRef before the first request'
                );
            }
            return stubRef.current;
        }
    };
});

import { billingSubscriptions, eq } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { resetBillingInstance } from '../../../../src/middlewares/billing.js';
import { createMockUserActor } from '../../../helpers/auth.js';
import { E2EApiClient } from '../../helpers/api-client.js';
import { createTestBillingCustomer } from '../../helpers/billing-factories.js';
import { createMpStubAdapter } from '../../helpers/mp-stub.js';
import { createTestUser, seedBillingTestPlans } from '../../setup/seed-helpers.js';
import { testDb } from '../../setup/test-database.js';

const mpStub = createMpStubAdapter();
stubRef.current = mpStub.adapter;

/**
 * Error modes tested through `mpStub.config.setError`. Each tuple is
 * (status, code, label). The label is used for `it.each` table titles.
 *
 * Modes are grouped semantically:
 *   - 4xx: client-side errors from MP. Our integration treats these as
 *     opaque server errors today (no actionable surfacing).
 *   - 5xx: server-side errors from MP. Same outward behavior.
 *   - 429: rate limit. Same outward behavior.
 *
 * Timeout (408 via setTimeout) and malformed (raw response) are tested
 * separately because they use distinct stub configuration methods.
 */
const HTTP_ERROR_MODES = [
    [400, 'BAD_REQUEST', '400 bad request'],
    [401, 'UNAUTHORIZED', '401 unauthorized'],
    [403, 'FORBIDDEN', '403 forbidden'],
    [404, 'NOT_FOUND', '404 not found'],
    [422, 'UNPROCESSABLE', '422 unprocessable entity'],
    [429, 'RATE_LIMITED', '429 too many requests'],
    [500, 'INTERNAL_SERVER_ERROR', '500 internal server error'],
    [502, 'BAD_GATEWAY', '502 bad gateway'],
    [503, 'SERVICE_UNAVAILABLE', '503 service unavailable'],
    [504, 'GATEWAY_TIMEOUT', '504 gateway timeout']
] as const;

describe('SPEC-143 T-143-59 (reframed) — MercadoPago error handling regression-guard', () => {
    let app: ReturnType<typeof initApp>;
    let client: E2EApiClient;
    let cheapPlanName: string;
    let customerId: string;

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
            email: `mp-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
        });
        const customer = await createTestBillingCustomer({
            externalId: user.id,
            email: user.email,
            providerCustomerIds: { mercadopago: `mp_cust_test_${user.id.slice(0, 8)}` }
        });
        customerId = customer.customerId;

        const actor = createMockUserActor({ id: user.id });
        client = new E2EApiClient(app, actor);
    });

    afterEach(async () => {
        await testDb.clean();
    });

    /**
     * Common post-failure assertions. The qzpay log-strategy keeps the
     * local subscription row (with no `mpSubscriptionId` enrichment) so
     * the user can retry by hitting the endpoint again without an
     * abandoned-state cleanup. The adapter call IS recorded on the
     * mp-stub call log.
     */
    async function assertFailedStartPaidInvariants(opts: {
        readonly adapterOp: 'checkout.create' | 'subscriptions.create';
        readonly expectedOutcome: 'error' | 'timeout' | 'malformed';
    }): Promise<void> {
        // The qzpay storage adapter persisted the local row before the
        // adapter call. With the log strategy in place, this row stays
        // in `pending_provider` (annual) or `incomplete` (monthly). We
        // do not pin the exact status here — it varies per flow — but
        // we do pin that EXACTLY ONE row exists FOR THIS TEST'S CUSTOMER.
        // The query is scoped to customerId (not a global SELECT *) so a
        // stray row leaked by another test in the same singleFork worker
        // cannot turn this into a false "got 2" failure. A second row for
        // THIS customer would still signal a real duplicate-insert regression.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, customerId));
        expect(subs).toHaveLength(1);
        // The pre-checkout statuses are the only acceptable values: any
        // `active` here would mean the adapter error did not prevent
        // activation — a clear regression.
        expect(['pending_provider', 'incomplete']).toContain(subs[0]?.status);

        // The adapter was called exactly once and the call recorded the
        // expected outcome. This is the strongest signal that the
        // adapter actually surfaced its configured error.
        const calls = mpStub.config.getCalls(opts.adapterOp);
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe(opts.expectedOutcome);
    }

    // -----------------------------------------------------------------------
    // Annual flow — `checkout.create` adapter call surfaces the error.
    // -----------------------------------------------------------------------

    describe('annual flow — checkout.create errors uniformly surface as 500', () => {
        it.each(HTTP_ERROR_MODES)('returns 500 when MP returns %s %s', async (status, code) => {
            mpStub.config.setError('checkout.create', status, `Stub error ${status}`, code);

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            );

            // CURRENT behavior: every error mode collapses to 500. The
            // qzpay log-strategy intercepts the throw, returns an
            // un-enriched local session, and the handler maps the
            // missing init_point to MISSING_INIT_POINT → 500. This
            // assertion changes when SPEC-149 lands.
            expect(response.status).toBe(500);

            await assertFailedStartPaidInvariants({
                adapterOp: 'checkout.create',
                expectedOutcome: 'error'
            });
        });

        it('returns 500 when the adapter times out (408 from mp-stub setTimeout)', async () => {
            // setTimeout simulates the stub waiting `delayMs` then throwing
            // an HttpLikeError with status=408 code='TIMEOUT'. The delay
            // is kept tiny so the test runs quickly; we only need the
            // timeout PATH, not a realistic wall-clock wait.
            mpStub.config.setTimeout('checkout.create', 50);

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            );

            expect(response.status).toBe(500);

            await assertFailedStartPaidInvariants({
                adapterOp: 'checkout.create',
                expectedOutcome: 'timeout'
            });
        });

        it('returns 500 when the adapter returns a malformed response', async () => {
            // setMalformed returns the raw value (does NOT throw). qzpay
            // then tries to consume it as a normal response, hits a parse
            // or shape mismatch, and the log strategy emits a warning +
            // returns the un-enriched local session. Outward behavior
            // is identical to the explicit error modes: 500 to the user,
            // local row persists.
            mpStub.config.setMalformed('checkout.create', { not: 'a checkout response' });

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            );

            expect(response.status).toBe(500);

            await assertFailedStartPaidInvariants({
                adapterOp: 'checkout.create',
                expectedOutcome: 'malformed'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Monthly flow — `subscriptions.create` adapter call surfaces the error.
    // -----------------------------------------------------------------------

    describe('monthly flow — subscriptions.create errors uniformly surface as 500', () => {
        it.each(HTTP_ERROR_MODES)('returns 500 when MP returns %s %s', async (status, code) => {
            mpStub.config.setError('subscriptions.create', status, `Stub error ${status}`, code);

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'monthly'
                }
            );

            expect(response.status).toBe(500);

            await assertFailedStartPaidInvariants({
                adapterOp: 'subscriptions.create',
                expectedOutcome: 'error'
            });
        });

        it('returns 500 when the adapter times out (408 from mp-stub setTimeout)', async () => {
            mpStub.config.setTimeout('subscriptions.create', 50);

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'monthly'
                }
            );

            expect(response.status).toBe(500);

            await assertFailedStartPaidInvariants({
                adapterOp: 'subscriptions.create',
                expectedOutcome: 'timeout'
            });
        });

        it('returns 500 when the adapter returns a malformed response', async () => {
            mpStub.config.setMalformed('subscriptions.create', { not: 'a subscription response' });

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'monthly'
                }
            );

            expect(response.status).toBe(500);

            await assertFailedStartPaidInvariants({
                adapterOp: 'subscriptions.create',
                expectedOutcome: 'malformed'
            });
        });
    });
});
