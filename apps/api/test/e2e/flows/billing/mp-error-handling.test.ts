/**
 * MercadoPago API error handling — regression-guard (SPEC-149 T-010, updated).
 *
 * Pins the CURRENT behavior of the start-paid endpoint when the MP adapter
 * surfaces any of the documented error modes after SPEC-149 T-001..T-006
 * landed the provider-error propagation + HTTP mapping.
 *
 * ## Current behavior (post SPEC-149)
 *
 * ### Annual flow (billing.checkout.create — wraps adapter errors as
 * `QZPayProviderSyncError` when providerSyncErrorStrategy='throw'):
 *
 * | MP status | ServiceErrorCode      | HTTP |
 * |-----------|----------------------|------|
 * | 422       | VALIDATION_ERROR     | 400  |
 * | 429       | PROVIDER_RATE_LIMITED| 503  |
 * | 408/504   | PROVIDER_TIMEOUT     | 504  |
 * | 5xx/4xx   | PROVIDER_ERROR       | 502  |
 * | malformed | MISSING_INIT_POINT*  | 500  |
 *
 * (*) Malformed response does not throw — qzpay-core returns the raw
 * value as the result, the service extracts no init-point, and
 * MISSING_INIT_POINT surfaces as 500.
 *
 * ### Monthly flow (billing.subscriptions.create — rethrows the raw
 * adapter error, NOT QZPayProviderSyncError):
 *
 * qzpay-core's subscriptions.create path re-throws the raw adapter
 * error on the `throw` strategy (no QZPayProviderSyncError wrapping).
 * `isBillingProviderError()` returns false, so the fallback generic 500
 * is still emitted for every error mode in the monthly flow.
 *
 * ### Retry-After header
 *
 * Annual flow 503 (PROVIDER_RATE_LIMITED) responses carry a
 * `Retry-After` header (default 30 s). Monthly flow does not emit it
 * because it cannot reach the PROVIDER_RATE_LIMITED mapping.
 *
 * Tested endpoint: `POST /api/v1/protected/billing/subscriptions/start-paid`
 *   - Annual flow (uses `checkout.create` adapter call).
 *   - Monthly flow (uses `subscriptions.create` adapter call).
 *
 * Out of scope:
 *   - Addon purchase, plan-change, refund error paths — same shape, but
 *     scope-limited to start-paid here.
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
 *   - 4xx (except 422/429): treated as opaque provider errors → 502.
 *   - 422: business rule violation → 400 (VALIDATION_ERROR).
 *   - 429: rate limit → 503 (PROVIDER_RATE_LIMITED + Retry-After).
 *   - 5xx: server-side provider errors → 502 (PROVIDER_ERROR).
 *   - 504: treated as timeout → 504 (PROVIDER_TIMEOUT).
 *
 * Annual and monthly flows use different qzpay-core code paths:
 *   - Annual (checkout.create): errors wrapped in QZPayProviderSyncError
 *     → isBillingProviderError() returns true → new mapping table.
 *   - Monthly (subscriptions.create): errors re-thrown raw (not wrapped)
 *     → isBillingProviderError() returns false → falls to generic 500.
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

/**
 * Maps an MP adapter status to the expected HTTP status the API returns.
 * Annual flow only — checkout.create wraps in QZPayProviderSyncError.
 */
function expectedHttpStatus(mpStatus: number): number {
    if (mpStatus === 422) return 400;
    if (mpStatus === 429) return 503;
    if (mpStatus === 504) return 504;
    // 4xx (other) and 5xx → PROVIDER_ERROR → 502
    return 502;
}

/**
 * Maps an MP adapter status to the expected ServiceErrorCode string.
 * Annual flow only.
 */
function expectedErrorCode(mpStatus: number): string {
    if (mpStatus === 422) return 'VALIDATION_ERROR';
    if (mpStatus === 429) return 'PROVIDER_RATE_LIMITED';
    if (mpStatus === 504) return 'PROVIDER_TIMEOUT';
    return 'PROVIDER_ERROR';
}

describe('SPEC-149 T-010 — MercadoPago error handling (post provider-error propagation)', () => {
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
     * Post-failure assertions for the annual flow (checkout.create with
     * QZPayProviderSyncError wrapping).
     *
     * The local `billing_subscriptions` row is inserted BEFORE the
     * billing.checkout.create() call, so it survives the provider failure
     * in `pending_provider`. The checkout session is marked `expired` by
     * qzpay-core's throw-strategy handler but that lives in the checkouts
     * table, not subscriptions. The subscription reaper cron will collect
     * the row after PENDING_PROVIDER_TTL_MS if the user never retries.
     */
    async function assertAnnualProviderFailureInvariants(opts: {
        readonly expectedOutcome: 'error' | 'timeout' | 'malformed';
    }): Promise<void> {
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, customerId));
        expect(subs).toHaveLength(1);
        expect(['pending_provider', 'incomplete']).toContain(subs[0]?.status);

        const calls = mpStub.config.getCalls('checkout.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe(opts.expectedOutcome);
    }

    /**
     * Post-failure assertions for the monthly flow (subscriptions.create
     * with raw re-throw — no QZPayProviderSyncError wrapping).
     *
     * qzpay-core's subscriptions.create path on the throw strategy issues a
     * soft-delete of the local row before re-throwing. The billing storage
     * adapter uses soft-deletes (`deletedAt`), so the row remains visible in
     * unfiltered queries. The adapter call is still recorded on the stub.
     */
    async function assertMonthlyProviderFailureInvariants(opts: {
        readonly expectedOutcome: 'error' | 'timeout' | 'malformed';
    }): Promise<void> {
        // The soft-deleted row is still returned by an unfiltered select.
        // Scoped to this test's customer to avoid cross-test contamination.
        const subs = await testDb
            .getDb()
            .select()
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.customerId, customerId));
        expect(subs).toHaveLength(1);

        const calls = mpStub.config.getCalls('subscriptions.create');
        expect(calls).toHaveLength(1);
        expect(calls[0]?.outcome).toBe(opts.expectedOutcome);
    }

    // -----------------------------------------------------------------------
    // Annual flow — checkout.create errors are wrapped in QZPayProviderSyncError
    // and mapped to the new HTTP table.
    // -----------------------------------------------------------------------

    describe('annual flow — checkout.create errors mapped to provider-error HTTP table (SPEC-149)', () => {
        it.each(HTTP_ERROR_MODES)('MP %s %s → HTTP %s + code %s', async (status, code) => {
            mpStub.config.setError('checkout.create', status, `Stub error ${status}`, code);

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            );

            // Post-SPEC-149 mapping:
            //   422 → 400 (VALIDATION_ERROR)
            //   429 → 503 (PROVIDER_RATE_LIMITED)
            //   504 → 504 (PROVIDER_TIMEOUT)
            //   4xx (other) / 5xx → 502 (PROVIDER_ERROR)
            expect(response.status).toBe(expectedHttpStatus(status));

            const body = (await response.json()) as {
                readonly success: boolean;
                readonly error: { readonly code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe(expectedErrorCode(status));

            // Retry-After header is emitted only for PROVIDER_RATE_LIMITED (MP 429).
            if (status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                expect(retryAfter).not.toBeNull();
                expect(Number(retryAfter)).toBeGreaterThan(0);
            }

            await assertAnnualProviderFailureInvariants({
                expectedOutcome: 'error'
            });
        });

        it('returns 504 (PROVIDER_TIMEOUT) when the adapter times out (408 from mp-stub setTimeout)', async () => {
            // setTimeout simulates the stub waiting `delayMs` then throwing
            // an HttpLikeError with status=408 code='TIMEOUT'. qzpay-core's
            // checkout.create catch block wraps it in QZPayProviderSyncError,
            // billing-provider-error.ts maps 408 → PROVIDER_TIMEOUT → 504.
            mpStub.config.setTimeout('checkout.create', 50);

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            );

            expect(response.status).toBe(504);

            const body = (await response.json()) as {
                readonly success: boolean;
                readonly error: { readonly code: string };
            };
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('PROVIDER_TIMEOUT');

            await assertAnnualProviderFailureInvariants({
                expectedOutcome: 'timeout'
            });
        });

        it('returns 500 (MISSING_INIT_POINT) when the adapter returns a malformed response', async () => {
            // setMalformed returns the raw value without throwing. qzpay-core
            // returns the malformed shape as the checkout result, the service
            // extracts no providerInitPoint/providerSandboxInitPoint, and
            // throws SubscriptionCheckoutError('MISSING_INIT_POINT') → 500.
            // This path does NOT go through QZPayProviderSyncError, so the
            // HTTP-mapping table does not apply here.
            mpStub.config.setMalformed('checkout.create', { not: 'a checkout response' });

            const response = await client.post(
                '/api/v1/protected/billing/subscriptions/start-paid',
                {
                    planSlug: cheapPlanName,
                    billingInterval: 'annual'
                }
            );

            expect(response.status).toBe(500);

            await assertAnnualProviderFailureInvariants({
                expectedOutcome: 'malformed'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Monthly flow — subscriptions.create re-throws the raw adapter error
    // (not QZPayProviderSyncError), so the generic 500 path still applies.
    // -----------------------------------------------------------------------

    describe('monthly flow — subscriptions.create re-throws raw error, still surfaces as 500', () => {
        it.each(HTTP_ERROR_MODES)(
            'returns 500 when MP returns %s %s (raw re-throw, no QZPayProviderSyncError wrapping)',
            async (status, code) => {
                mpStub.config.setError(
                    'subscriptions.create',
                    status,
                    `Stub error ${status}`,
                    code
                );

                const response = await client.post(
                    '/api/v1/protected/billing/subscriptions/start-paid',
                    {
                        planSlug: cheapPlanName,
                        billingInterval: 'monthly'
                    }
                );

                // qzpay-core subscriptions.create path re-throws the raw adapter
                // error on the `throw` strategy. isBillingProviderError() checks
                // for QZPayProviderSyncError — returns false for raw re-throws.
                // The code falls through to the generic 500 handler.
                expect(response.status).toBe(500);

                await assertMonthlyProviderFailureInvariants({
                    expectedOutcome: 'error'
                });
            }
        );

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

            await assertMonthlyProviderFailureInvariants({
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

            await assertMonthlyProviderFailureInvariants({
                expectedOutcome: 'malformed'
            });
        });
    });
});
