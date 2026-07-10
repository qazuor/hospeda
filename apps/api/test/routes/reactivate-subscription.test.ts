/**
 * Unit tests for the POST /api/v1/protected/billing/trial/reactivate-subscription
 * route handler (HOS-114).
 *
 * Tests cover:
 * - Billing not configured (503)
 * - No billing customer (400)
 * - Missing/empty planId (400)
 * - No subscriptions found (500 HTTPException)
 * - Active subscription exists (500 HTTPException)
 * - Trialing subscription exists (500 HTTPException)
 * - Happy path: real paid checkout (checkoutUrl + status=incomplete)
 * - Service throws a plain error (500 HTTPException)
 * - Service throws a `SubscriptionCheckoutError` (mapped 4xx/5xx via the
 *   shared mapper)
 *
 * @module test/routes/reactivate-subscription
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be hoisted before any imports)
// ---------------------------------------------------------------------------

const { mockGetQZPayBilling } = vi.hoisted(() => ({
    mockGetQZPayBilling: vi.fn()
}));

const { mockReactivateSubscription } = vi.hoisted(() => ({
    mockReactivateSubscription: vi.fn()
}));

/**
 * Captured handler references so we can call them directly in tests.
 * `createSimpleRoute` is mocked to intercept the config and store the handler.
 */
const { handlerStore } = vi.hoisted(() => ({
    handlerStore: {
        handlers: [] as Array<{
            path: string;
            handler: (c: unknown) => Promise<unknown>;
        }>
    }
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling,
    billingMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: vi.fn(),
        route: vi.fn(),
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn(
        (config: { path: string; handler: (c: unknown) => Promise<unknown> }) => {
            handlerStore.handlers.push({ path: config.path, handler: config.handler });
            return config.handler;
        }
    ),
    createAdminRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../src/services/trial.service', () => ({
    TrialService: vi.fn().mockImplementation(function () {
        return {
            reactivateFromTrial: vi.fn(),
            reactivateSubscription: mockReactivateSubscription
        };
    })
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_API_DEBUG_ERRORS: false,
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test'
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Importing the module triggers createSimpleRoute calls which populate handlers.
import '../../src/routes/billing/trial';
import { SubscriptionCheckoutError } from '../../src/services/billing/subscription-checkout-error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Expected checkout return URLs built by the handler for the default 'es' locale. */
const EXPECTED_URLS = {
    paymentMethodReturnUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/**
 * Expected ANNUAL checkout return URLs built by the handler for the default
 * 'es' locale (HOS-123).
 */
const EXPECTED_ANNUAL_URLS = {
    successUrl: 'https://hospeda.test/es/suscriptores/checkout/success/',
    cancelUrl: 'https://hospeda.test/es/suscriptores/checkout/failure/',
    notificationUrl: 'https://api.hospeda.test/api/v1/webhooks/mercadopago'
};

/**
 * Creates a minimal mock Hono context for the handler.
 */
function createMockContext(
    options: { billingEnabled?: boolean; billingCustomerId?: string | null; body?: unknown } = {}
) {
    const {
        billingEnabled = true,
        billingCustomerId = 'cust_123',
        body = { planId: 'plan_basic' }
    } = options;

    const contextStore = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);

    return {
        get: vi.fn((key: string) => contextStore.get(key)),
        req: {
            json: vi.fn().mockResolvedValue(body)
        }
    };
}

/**
 * Retrieves the reactivate-subscription handler from the captured handlers.
 */
function getReactivateSubscriptionHandler(): (c: unknown) => Promise<unknown> {
    const entry = handlerStore.handlers.find((h) => h.path === '/reactivate-subscription');
    if (!entry) {
        throw new Error(
            `reactivate-subscription handler was not captured. Captured paths: [${handlerStore.handlers.map((h) => h.path).join(', ')}]`
        );
    }
    return entry.handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reactivateSubscriptionRoute handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetQZPayBilling.mockReturnValue({ subscriptions: {} });
    });

    // -----------------------------------------------------------------------
    // Guard: billingEnabled
    // -----------------------------------------------------------------------

    describe('when billingEnabled is false', () => {
        it('should throw HTTPException 503', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            const ctx = createMockContext({ billingEnabled: false });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 503,
                message: 'Billing service is not configured'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Guard: billingCustomerId
    // -----------------------------------------------------------------------

    describe('when billingCustomerId is null', () => {
        it('should throw HTTPException 400', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            const ctx = createMockContext({ billingCustomerId: null });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 400,
                message: 'No billing account found'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Guard: request body validation
    // -----------------------------------------------------------------------

    describe('when body is missing planId', () => {
        it('should throw HTTPException 400', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            const ctx = createMockContext({ body: {} });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 400,
                message: 'Invalid request body'
            });
        });
    });

    describe('when body has empty string planId', () => {
        it('should throw HTTPException 400', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            const ctx = createMockContext({ body: { planId: '' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 400,
                message: 'Invalid request body'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Service error paths (HOS-114 T-015b: business errors now map to 4xx
    // via SubscriptionCheckoutError, not a generic 500)
    // -----------------------------------------------------------------------

    describe('when no subscriptions found (nothing to reactivate)', () => {
        it('should throw HTTPException 404 (NO_CANCELED_SUBSCRIPTION)', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError(
                    'NO_CANCELED_SUBSCRIPTION',
                    'No canceled subscription found to reactivate'
                )
            );
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 404,
                message: 'No canceled subscription found to reactivate'
            });
        });
    });

    describe('when active subscription exists', () => {
        it('should throw HTTPException 409 (ACTIVE_SUBSCRIPTION_EXISTS)', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError(
                    'ACTIVE_SUBSCRIPTION_EXISTS',
                    'Cannot reactivate: active subscription exists. Use plan-change instead.'
                )
            );
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 409,
                message: 'Cannot reactivate: active subscription exists. Use plan-change instead.'
            });
        });
    });

    describe('when trialing subscription exists', () => {
        it('should throw HTTPException 409 (ACTIVE_SUBSCRIPTION_EXISTS)', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError(
                    'ACTIVE_SUBSCRIPTION_EXISTS',
                    'Cannot reactivate: trialing subscription exists. Use plan-change instead.'
                )
            );
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 409,
                message: 'Cannot reactivate: trialing subscription exists. Use plan-change instead.'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('when reactivateSubscription succeeds', () => {
        it('should return the full result shape including checkoutUrl and status=incomplete', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_new_123',
                previousPlanId: 'plan_old',
                checkoutUrl: 'https://mp.test/checkout/reactivate-sub-123',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub_new_123',
                previousPlanId: 'plan_old',
                checkoutUrl: 'https://mp.test/checkout/reactivate-sub-123',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
        });

        it('should call reactivateSubscription with customerId, planId, and the resolved checkout return URLs', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_new_456',
                previousPlanId: null,
                checkoutUrl: 'https://mp.test/checkout/reactivate-sub-456',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            const ctx = createMockContext({
                billingCustomerId: 'cust_abc',
                body: { planId: 'plan_enterprise' }
            });

            // Act
            await handler(ctx);

            // Assert
            expect(mockReactivateSubscription).toHaveBeenCalledWith({
                customerId: 'cust_abc',
                planId: 'plan_enterprise',
                billingInterval: 'monthly',
                urls: EXPECTED_URLS
            });
        });
    });

    // -----------------------------------------------------------------------
    // HOS-123: annual billingInterval
    // -----------------------------------------------------------------------

    describe('when billingInterval is "annual"', () => {
        it('should build annual checkout URLs, pass billingInterval through, and return status=pending_provider with previousPlanId', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_annual_sub_1',
                previousPlanId: 'plan_old_annual',
                checkoutUrl: 'https://mp.test/checkout/annual-sub-1',
                status: 'pending_provider',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            const ctx = createMockContext({
                billingCustomerId: 'cust_annual',
                body: { planId: 'plan_pro', billingInterval: 'annual' }
            });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub_annual_sub_1',
                previousPlanId: 'plan_old_annual',
                checkoutUrl: 'https://mp.test/checkout/annual-sub-1',
                status: 'pending_provider',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            expect(mockReactivateSubscription).toHaveBeenCalledWith({
                customerId: 'cust_annual',
                planId: 'plan_pro',
                billingInterval: 'annual',
                urls: EXPECTED_ANNUAL_URLS
            });
        });
    });

    describe('when billingInterval is omitted (defaults to monthly)', () => {
        it('should produce the exact same monthly URLs, service call, and response as before HOS-123 (NG-3 regression)', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_default_monthly',
                previousPlanId: 'plan_old',
                checkoutUrl: 'https://mp.test/checkout/default-monthly-sub',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            const ctx = createMockContext({
                billingCustomerId: 'cust_default',
                body: { planId: 'plan_pro' }
            });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub_default_monthly',
                previousPlanId: 'plan_old',
                checkoutUrl: 'https://mp.test/checkout/default-monthly-sub',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            expect(mockReactivateSubscription).toHaveBeenCalledWith({
                customerId: 'cust_default',
                planId: 'plan_pro',
                billingInterval: 'monthly',
                urls: EXPECTED_URLS
            });
        });
    });

    describe('when service throws NO_ANNUAL_PRICE', () => {
        it('should map to an HTTPException 404 (not a 500)', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError(
                    'NO_ANNUAL_PRICE',
                    "Plan 'plan_pro' has no active annual price"
                )
            );
            const ctx = createMockContext({
                body: { planId: 'plan_pro', billingInterval: 'annual' }
            });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 404 });
        });
    });

    // -----------------------------------------------------------------------
    // Service throws error
    // -----------------------------------------------------------------------

    describe('when service throws a plain error', () => {
        it('should throw HTTPException 500 with generic message', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(new Error('Unexpected billing error'));
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 500,
                message: 'Failed to reactivate subscription'
            });
        });
    });

    describe('when service throws a SubscriptionCheckoutError', () => {
        it('should map PLAN_NOT_FOUND to HTTPException 404', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError('PLAN_NOT_FOUND', "Plan 'x' not found")
            );
            const ctx = createMockContext({ body: { planId: 'unknown-plan' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 404 });
        });

        it('should map INVALID_REACTIVATION_PLAN to HTTPException 422', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError('INVALID_REACTIVATION_PLAN', 'Free plan rejected')
            );
            const ctx = createMockContext({ body: { planId: 'free-plan' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 422 });
        });

        it('should map ANNUAL_REACTIVATION_UNSUPPORTED to HTTPException 422', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError(
                    'ANNUAL_REACTIVATION_UNSUPPORTED',
                    'Annual reactivation is not supported'
                )
            );
            const ctx = createMockContext({ body: { planId: 'annual-only-plan' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 422 });
        });

        it('should map MISSING_INIT_POINT to HTTPException 500', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError('MISSING_INIT_POINT', 'No checkout URL')
            );
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 500 });
        });

        it('should map ACTIVE_SUBSCRIPTION_EXISTS to HTTPException 409 (HOS-114 T-015b)', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError(
                    'ACTIVE_SUBSCRIPTION_EXISTS',
                    'Cannot reactivate: active subscription exists. Use plan-change instead.'
                )
            );
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 409 });
        });

        it('should map NO_CANCELED_SUBSCRIPTION to HTTPException 404 (HOS-114 T-015b)', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new SubscriptionCheckoutError(
                    'NO_CANCELED_SUBSCRIPTION',
                    'No canceled subscription found to reactivate'
                )
            );
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 404 });
        });
    });
});
