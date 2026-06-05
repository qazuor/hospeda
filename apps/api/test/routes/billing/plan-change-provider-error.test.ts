/**
 * Provider error wiring tests for `handlePlanChange` (SPEC-149 T-006).
 *
 * Verifies that `QZPayProviderSyncError` thrown by the billing provider
 * (in any phase of the plan-change flow) is:
 *  1. Detected via `isBillingProviderError`.
 *  2. Mapped to the correct `ServiceError` code via `mapProviderErrorToServiceError`.
 *  3. Captured to Sentry via `captureBillingError` with the right tags.
 *  4. Re-thrown as a `ServiceError` (not wrapped in HTTPException 500).
 *
 * Covers both the upgrade branch (`billing.subscriptions.getByCustomerId` +
 * `initiatePaidPlanUpgrade`) and the downgrade branch
 * (`billing.subscriptions.getByCustomerId` + `scheduleSubscriptionDowngrade`).
 *
 * Regression guards ensure non-provider errors still follow the original
 * error-handling path (HTTPException 500 for unknown errors, SubscriptionCheckout/
 * DowngradeError for domain errors).
 *
 * @module test/routes/billing/plan-change-provider-error
 */

import { QZPayProviderSyncError } from '@qazuor/qzpay-core';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports of the route file).
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/sentry')>();
    return {
        ...actual,
        captureBillingError: vi.fn()
    };
});

vi.mock('../../../src/lib/billing-provider-error', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/lib/billing-provider-error')>();
    return { ...actual };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual };
});

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

// Stub upgrade service so we control provider errors in both paths
vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        initiatePaidPlanUpgrade: vi.fn()
    };
});

// Stub downgrade service so we control provider errors in both paths
vi.mock('../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        scheduleSubscriptionDowngrade: vi.fn()
    };
});

// ---------------------------------------------------------------------------
// Imports (after mocks).
// ---------------------------------------------------------------------------

import { captureBillingError } from '../../../src/lib/sentry';
import { getQZPayBilling } from '../../../src/middlewares/billing';
import { handlePlanChange } from '../../../src/routes/billing/plan-change';
import { initiatePaidPlanUpgrade } from '../../../src/services/subscription-checkout.service';
import {
    SubscriptionDowngradeError,
    scheduleSubscriptionDowngrade
} from '../../../src/services/subscription-downgrade.service';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust_plan_change_test';
const ACTOR_ID = '00000000-0000-4000-8000-000000000099';
const CURRENT_PLAN_ID = 'plan_basic';
const TARGET_PLAN_ID_UPGRADE = 'plan_pro';
const TARGET_PLAN_ID_DOWNGRADE = 'plan_free';

/**
 * Build the stub-shaped cause that `buildHttpLikeError` in mp-stub.ts produces:
 * a plain Error with a numeric `.status` field.
 */
function buildStubCause(status: number, code?: string): Error {
    const err = new Error(`Stub error ${status}`) as Error & {
        status: number;
        code?: string;
    };
    err.name = 'MpStubHttpError';
    err.status = status;
    if (code !== undefined) {
        err.code = code;
    }
    return err;
}

/**
 * Wrap a cause in a `QZPayProviderSyncError` (thrown when
 * `providerSyncErrorStrategy: 'throw'`).
 */
function buildProviderSyncError(
    cause?: Error,
    operation = 'subscription_fetch'
): QZPayProviderSyncError {
    return new QZPayProviderSyncError(
        'Failed in mercadopago',
        'mercadopago',
        operation,
        { customerId: CUSTOMER_ID },
        cause
    );
}

/**
 * Create a minimal Hono-like context for the upgrade path.
 * The billing mock will be a plan where target > current (isUpgrade = true).
 */
function makeUpgradeContext(
    body: unknown = { newPlanId: TARGET_PLAN_ID_UPGRADE, billingInterval: 'monthly' }
) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: ACTOR_ID, role: 'USER', permissions: [] }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

/**
 * Create a minimal Hono-like context for the downgrade path.
 * The billing mock will be a plan where target < current (isDowngrade).
 */
function makeDowngradeContext(
    body: unknown = { newPlanId: TARGET_PLAN_ID_DOWNGRADE, billingInterval: 'monthly' }
) {
    const store = new Map<string, unknown>([
        ['billingEnabled', true],
        ['billingCustomerId', CUSTOMER_ID],
        ['actor', { id: ACTOR_ID, role: 'USER', permissions: [] }]
    ]);
    return {
        get: vi.fn((k: string) => store.get(k)),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

/**
 * Build a billing mock for the UPGRADE path.
 * Current plan price (100k) < target plan price (200k) → isUpgrade=true.
 * `getByCustomerId` is healthy by default (returns an active subscription).
 * `createThrows` optionally makes `getByCustomerId` throw a provider error
 * to test the outer catch (provider error before branch dispatch).
 */
function makeUpgradeBillingMock(opts: { getByCustomerIdThrows?: Error } = {}) {
    const activeSub = {
        id: 'sub_upgrade_t006',
        planId: CURRENT_PLAN_ID,
        status: 'active',
        interval: 'month',
        intervalCount: 1
    };

    const getByCustomerId =
        opts.getByCustomerIdThrows !== undefined
            ? vi.fn().mockRejectedValue(opts.getByCustomerIdThrows)
            : vi.fn().mockResolvedValue([activeSub]);

    return {
        subscriptions: {
            getByCustomerId,
            changePlan: vi.fn()
        },
        plans: {
            get: vi.fn().mockImplementation((id: string) => {
                if (id === CURRENT_PLAN_ID) {
                    return Promise.resolve({
                        id: CURRENT_PLAN_ID,
                        prices: [
                            {
                                id: 'price_basic',
                                billingInterval: 'month',
                                unitAmount: 100_000,
                                intervalCount: 1
                            }
                        ]
                    });
                }
                return Promise.resolve({
                    id: TARGET_PLAN_ID_UPGRADE,
                    prices: [
                        {
                            id: 'price_pro',
                            billingInterval: 'month',
                            unitAmount: 200_000,
                            intervalCount: 1
                        }
                    ]
                });
            })
        }
    };
}

/**
 * Build a billing mock for the DOWNGRADE path.
 * Current plan price (200k) > target plan price (50k) → isDowngrade.
 */
function makeDowngradeBillingMock(opts: { getByCustomerIdThrows?: Error } = {}) {
    const activeSub = {
        id: 'sub_downgrade_t006',
        planId: CURRENT_PLAN_ID,
        status: 'active',
        interval: 'month',
        intervalCount: 1
    };

    const getByCustomerId =
        opts.getByCustomerIdThrows !== undefined
            ? vi.fn().mockRejectedValue(opts.getByCustomerIdThrows)
            : vi.fn().mockResolvedValue([activeSub]);

    return {
        subscriptions: {
            getByCustomerId,
            changePlan: vi.fn()
        },
        plans: {
            get: vi.fn().mockImplementation((id: string) => {
                if (id === CURRENT_PLAN_ID) {
                    return Promise.resolve({
                        id: CURRENT_PLAN_ID,
                        prices: [
                            {
                                id: 'price_basic',
                                billingInterval: 'month',
                                unitAmount: 200_000,
                                intervalCount: 1
                            }
                        ]
                    });
                }
                return Promise.resolve({
                    id: TARGET_PLAN_ID_DOWNGRADE,
                    prices: [
                        {
                            id: 'price_free',
                            billingInterval: 'month',
                            unitAmount: 50_000,
                            intervalCount: 1
                        }
                    ]
                });
            })
        }
    };
}

function mockBillingWith(billing: ReturnType<typeof makeUpgradeBillingMock>) {
    vi.mocked(getQZPayBilling).mockReturnValue(
        billing as unknown as ReturnType<typeof getQZPayBilling>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePlanChange — provider error wiring (SPEC-149 T-006)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-set the captureBillingError mock after clearAllMocks wipes implementations.
        vi.mocked(captureBillingError).mockReturnValue('sentinel-event-id');
    });

    // ── Outer-catch provider errors (getByCustomerId / plans.get throw) ──────

    describe('outer try/catch: provider error before branch dispatch', () => {
        it('MP 429 → ServiceError PROVIDER_RATE_LIMITED (not HTTPException 500)', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(429, 'RATE_LIMITED'));
            mockBillingWith(makeUpgradeBillingMock({ getByCustomerIdThrows: providerErr }));

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError &&
                    err.code === ServiceErrorCode.PROVIDER_RATE_LIMITED
            );
        });

        it('MP 408 timeout → ServiceError PROVIDER_TIMEOUT', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(408, 'TIMEOUT'));
            mockBillingWith(makeUpgradeBillingMock({ getByCustomerIdThrows: providerErr }));

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_TIMEOUT
            );
        });

        it('MP 500 → ServiceError PROVIDER_ERROR (not generic HTTPException 500)', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(500, 'SERVER_ERROR'));
            mockBillingWith(makeUpgradeBillingMock({ getByCustomerIdThrows: providerErr }));

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_ERROR
            );
        });

        it('MP 422 validation → ServiceError VALIDATION_ERROR', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(422, 'INVALID_CARD'));
            mockBillingWith(makeUpgradeBillingMock({ getByCustomerIdThrows: providerErr }));

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.VALIDATION_ERROR
            );
        });

        it('captureBillingError called with operation=plan_change and providerStatus on 429', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(429, 'RATE_LIMITED'));
            mockBillingWith(makeUpgradeBillingMock({ getByCustomerIdThrows: providerErr }));

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toBeInstanceOf(ServiceError);

            expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
            const [capturedErr, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
            expect(capturedErr).toBeInstanceOf(ServiceError);
            expect(capturedCtx).toMatchObject({
                operation: 'plan_change',
                providerStatus: 429
            });
        });

        it('captureBillingError called once on MP 500 with correct providerStatus', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(500));
            mockBillingWith(makeUpgradeBillingMock({ getByCustomerIdThrows: providerErr }));

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toBeInstanceOf(ServiceError);

            expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
            const [, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
            expect(capturedCtx).toMatchObject({ providerStatus: 500 });
        });
    });

    // ── Upgrade branch: provider error from initiatePaidPlanUpgrade ──────────

    describe('upgrade branch: provider error from initiatePaidPlanUpgrade', () => {
        it('MP 429 → ServiceError PROVIDER_RATE_LIMITED', async () => {
            const providerErr = buildProviderSyncError(
                buildStubCause(429, 'RATE_LIMITED'),
                'checkout_create'
            );
            mockBillingWith(makeUpgradeBillingMock());
            vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(providerErr);

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError &&
                    err.code === ServiceErrorCode.PROVIDER_RATE_LIMITED
            );
        });

        it('MP 408 timeout → ServiceError PROVIDER_TIMEOUT', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(408, 'TIMEOUT'));
            mockBillingWith(makeUpgradeBillingMock());
            vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(providerErr);

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_TIMEOUT
            );
        });

        it('MP 500 → ServiceError PROVIDER_ERROR', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(500));
            mockBillingWith(makeUpgradeBillingMock());
            vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(providerErr);

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_ERROR
            );
        });

        it('MP 422 → ServiceError VALIDATION_ERROR', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(422));
            mockBillingWith(makeUpgradeBillingMock());
            vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(providerErr);

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.VALIDATION_ERROR
            );
        });

        it('captureBillingError called with operation=plan_change and providerStatus on 429', async () => {
            const providerErr = buildProviderSyncError(
                buildStubCause(429, 'RATE_LIMITED'),
                'checkout_create'
            );
            mockBillingWith(makeUpgradeBillingMock());
            vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(providerErr);

            const ctx = makeUpgradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toBeInstanceOf(ServiceError);

            expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
            const [capturedErr, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
            expect(capturedErr).toBeInstanceOf(ServiceError);
            expect(capturedCtx).toMatchObject({
                operation: 'plan_change',
                providerStatus: 429
            });
        });
    });

    // ── Downgrade branch: provider error from scheduleSubscriptionDowngrade ──

    describe('downgrade branch: provider error from scheduleSubscriptionDowngrade', () => {
        it('MP 429 → ServiceError PROVIDER_RATE_LIMITED', async () => {
            const providerErr = buildProviderSyncError(
                buildStubCause(429, 'RATE_LIMITED'),
                'subscription_update'
            );
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(providerErr);

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError &&
                    err.code === ServiceErrorCode.PROVIDER_RATE_LIMITED
            );
        });

        it('MP 408 timeout → ServiceError PROVIDER_TIMEOUT', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(408, 'TIMEOUT'));
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(providerErr);

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_TIMEOUT
            );
        });

        it('MP 500 → ServiceError PROVIDER_ERROR', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(500));
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(providerErr);

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.PROVIDER_ERROR
            );
        });

        it('MP 422 → ServiceError VALIDATION_ERROR', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(422));
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(providerErr);

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toSatisfy(
                (err: unknown) =>
                    err instanceof ServiceError && err.code === ServiceErrorCode.VALIDATION_ERROR
            );
        });

        it('captureBillingError called with operation=plan_change and providerStatus on 429', async () => {
            const providerErr = buildProviderSyncError(
                buildStubCause(429, 'RATE_LIMITED'),
                'subscription_update'
            );
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(providerErr);

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toBeInstanceOf(ServiceError);

            expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
            const [capturedErr, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
            expect(capturedErr).toBeInstanceOf(ServiceError);
            expect(capturedCtx).toMatchObject({
                operation: 'plan_change',
                providerStatus: 429
            });
        });

        it('captureBillingError called once on MP 500 with correct providerStatus', async () => {
            const providerErr = buildProviderSyncError(buildStubCause(500));
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(providerErr);

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toBeInstanceOf(ServiceError);

            expect(vi.mocked(captureBillingError)).toHaveBeenCalledTimes(1);
            const [, capturedCtx] = vi.mocked(captureBillingError).mock.calls[0] ?? [];
            expect(capturedCtx).toMatchObject({ providerStatus: 500 });
        });
    });

    // ── Regression guards: non-provider errors keep old behavior ────────────

    describe('regression guards: non-provider errors keep original handling', () => {
        it('plain Error from getByCustomerId → HTTPException 500 (not ServiceError)', async () => {
            const plainError = new Error('unexpected DB blowup');
            mockBillingWith(makeUpgradeBillingMock({ getByCustomerIdThrows: plainError }));

            const ctx = makeUpgradeContext();
            const caught = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(caught).not.toBeInstanceOf(ServiceError);
            expect(caught).toMatchObject({ status: 500 });
            // captureBillingError must NOT be called for non-provider errors
            expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
        });

        it('plain Error from initiatePaidPlanUpgrade → HTTPException 500 (not ServiceError)', async () => {
            mockBillingWith(makeUpgradeBillingMock());
            vi.mocked(initiatePaidPlanUpgrade).mockRejectedValue(new Error('Network down'));

            const ctx = makeUpgradeContext();
            const caught = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(caught).not.toBeInstanceOf(ServiceError);
            expect(caught).toMatchObject({ status: 500 });
            expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
        });

        it('plain Error from scheduleSubscriptionDowngrade → HTTPException 500', async () => {
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(new Error('DB gone'));

            const ctx = makeDowngradeContext();
            const caught = await handlePlanChange(ctx as never).catch((e: unknown) => e);

            expect(caught).not.toBeInstanceOf(ServiceError);
            expect(caught).toMatchObject({ status: 500 });
            expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
        });

        it('SubscriptionDowngradeError still maps via mapDowngradeErrorToHttp (not captureBillingError)', async () => {
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(
                new SubscriptionDowngradeError('NOT_A_DOWNGRADE', 'target >= current')
            );

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 422 });
            expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
        });

        it('captureBillingError is NOT called for non-provider errors in the downgrade branch', async () => {
            mockBillingWith(makeDowngradeBillingMock());
            vi.mocked(scheduleSubscriptionDowngrade).mockRejectedValue(new Error('timeout'));

            const ctx = makeDowngradeContext();
            await expect(handlePlanChange(ctx as never)).rejects.toMatchObject({ status: 500 });
            expect(vi.mocked(captureBillingError)).not.toHaveBeenCalled();
        });
    });
});
