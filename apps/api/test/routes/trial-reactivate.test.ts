/**
 * Unit tests for the trial reactivate endpoint handler (HOS-114).
 *
 * Tests cover:
 * - Successful reactivation from trial to a real paid checkout (checkoutUrl +
 *   incomplete status)
 * - Billing not configured (503)
 * - No billing account (400)
 * - Missing planId in body (400)
 * - Empty string planId in body (400)
 * - Service throws a plain error (500 HTTPException)
 * - Service throws a `SubscriptionCheckoutError` (mapped 4xx/5xx via the
 *   shared mapper)
 * - Correct parameters (including the resolved return URLs) forwarded to
 *   `reactivateFromTrial`
 * - Canceled subscription reactivation (service handles internally)
 * - User without billing customer
 * - Billing middleware bypass (billingEnabled missing)
 *
 * @module test/routes/trial-reactivate
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks (must be hoisted before any imports)
// ---------------------------------------------------------------------------

const { mockGetQZPayBilling } = vi.hoisted(() => ({
    mockGetQZPayBilling: vi.fn()
}));

const { mockReactivateFromTrial } = vi.hoisted(() => ({
    mockReactivateFromTrial: vi.fn()
}));

/**
 * Captured handler reference so we can call it directly in tests.
 * `createSimpleRoute` is mocked to intercept the config and store the handler.
 * Must be hoisted via vi.hoisted so it is available when vi.mock factories run.
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
            reactivateFromTrial: mockReactivateFromTrial
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

// Importing the module triggers createSimpleRoute calls which populate capturedHandler.
// The last call to createSimpleRoute inside trial.ts is reactivateTrialRoute.
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
 * Creates a minimal mock Hono context for the reactivate handler.
 *
 * @param options - Configuration for the mock context
 * @returns A mock context object compatible with the handler signature
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
 * Retrieves the reactivate handler that was captured during module load.
 * Throws if the handler was not captured (module did not load correctly).
 */
function getReactivateHandler(): (c: unknown) => Promise<unknown> {
    const entry = handlerStore.handlers.find((h) => h.path === '/reactivate');
    if (!entry) {
        throw new Error(
            `reactivate handler was not captured. Captured paths: [${handlerStore.handlers.map((h) => h.path).join(', ')}]`
        );
    }
    return entry.handler;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * Tests for the POST /api/v1/protected/billing/trial/reactivate route handler.
 *
 * The handler routes a trial-to-paid reactivation through a real MercadoPago
 * checkout by calling TrialService.reactivateFromTrial with the customer ID,
 * planId, and the resolved checkout return URLs.
 */
describe('reactivateTrialRoute handler', () => {
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
            const handler = getReactivateHandler();
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
            const handler = getReactivateHandler();
            const ctx = createMockContext({ billingCustomerId: null });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 400,
                message: 'No billing account found'
            });
        });
    });

    describe('when billingCustomerId is an empty string (user without billing customer)', () => {
        it('should throw HTTPException 400', async () => {
            // Arrange - empty string is also falsy, simulates a missing billing account
            const handler = getReactivateHandler();
            const ctx = createMockContext({ billingCustomerId: '' as unknown as null });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 400 });
        });
    });

    // -----------------------------------------------------------------------
    // Guard: request body validation
    // -----------------------------------------------------------------------

    describe('when body is missing planId', () => {
        it('should throw HTTPException 400 with validation error', async () => {
            // Arrange
            const handler = getReactivateHandler();
            const ctx = createMockContext({ body: {} });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 400,
                message: 'Invalid request body'
            });
        });
    });

    describe('when body has an empty string planId', () => {
        it('should throw HTTPException 400 with validation error', async () => {
            // Arrange
            const handler = getReactivateHandler();
            const ctx = createMockContext({ body: { planId: '' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 400,
                message: 'Invalid request body'
            });
        });
    });

    describe('when body is entirely absent (null)', () => {
        it('should throw HTTPException 400 with validation error', async () => {
            // Arrange
            const handler = getReactivateHandler();
            const ctx = createMockContext({ body: null });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 400 });
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('when reactivateFromTrial succeeds', () => {
        it('should return the full result shape including checkoutUrl and status=incomplete', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_paid_456',
                checkoutUrl: 'https://mp.test/checkout/reactivate-abc',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub_paid_456',
                checkoutUrl: 'https://mp.test/checkout/reactivate-abc',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
        });

        it('should call reactivateFromTrial with customerId, planId, and the resolved checkout return URLs', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_paid_789',
                checkoutUrl: 'https://mp.test/checkout/xyz',
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
            expect(mockReactivateFromTrial).toHaveBeenCalledWith({
                customerId: 'cust_abc',
                planId: 'plan_enterprise',
                urls: EXPECTED_URLS
            });
        });

        it('should include the checkoutUrl returned by the service in the response', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_paid_unique_99',
                checkoutUrl: 'https://mp.test/checkout/unique-99',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act
            const result = (await handler(ctx)) as { checkoutUrl: string };

            // Assert
            expect(result.checkoutUrl).toBe('https://mp.test/checkout/unique-99');
        });
    });

    // -----------------------------------------------------------------------
    // Service failure paths
    // -----------------------------------------------------------------------

    describe('when reactivateFromTrial throws a plain error', () => {
        it('should throw HTTPException 500 with generic message', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockRejectedValue(new Error('No trial subscription found'));
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 500,
                message: 'Failed to reactivate'
            });
        });

        it('should throw HTTPException 500 when service throws with a non-Error object', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockRejectedValue('unexpected string error');
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({
                status: 500,
                message: 'Failed to reactivate'
            });
        });
    });

    describe('when reactivateFromTrial throws a SubscriptionCheckoutError', () => {
        it('should map PLAN_NOT_FOUND to HTTPException 404', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockRejectedValue(
                new SubscriptionCheckoutError('PLAN_NOT_FOUND', "Plan 'x' not found")
            );
            const ctx = createMockContext({ body: { planId: 'unknown-plan' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 404 });
        });

        it('should map INVALID_REACTIVATION_PLAN to HTTPException 422', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockRejectedValue(
                new SubscriptionCheckoutError('INVALID_REACTIVATION_PLAN', 'Free plan rejected')
            );
            const ctx = createMockContext({ body: { planId: 'free-plan' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 422 });
        });

        it('should map ANNUAL_REACTIVATION_UNSUPPORTED to HTTPException 422', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockRejectedValue(
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
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockRejectedValue(
                new SubscriptionCheckoutError('MISSING_INIT_POINT', 'No checkout URL')
            );
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act & Assert
            await expect(handler(ctx)).rejects.toMatchObject({ status: 500 });
        });
    });

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    describe('when reactivating a canceled subscription (not just trialing)', () => {
        it('should still call the service and return success when it resolves', async () => {
            // Arrange - service handles both trialing and canceled statuses internally
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue({
                success: true,
                subscriptionId: 'sub_reactivated_from_canceled',
                checkoutUrl: 'https://mp.test/checkout/from-canceled',
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            });
            const ctx = createMockContext({
                billingCustomerId: 'cust_canceled_user',
                body: { planId: 'plan_pro' }
            });

            // Act
            const result = (await handler(ctx)) as { success: boolean; subscriptionId: string };

            // Assert
            expect(result.success).toBe(true);
            expect(result.subscriptionId).toBe('sub_reactivated_from_canceled');
            expect(mockReactivateFromTrial).toHaveBeenCalledWith({
                customerId: 'cust_canceled_user',
                planId: 'plan_pro',
                urls: EXPECTED_URLS
            });
        });
    });
});
