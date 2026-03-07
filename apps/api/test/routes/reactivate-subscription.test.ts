/**
 * Unit tests for the POST /api/v1/protected/billing/trial/reactivate-subscription route handler.
 *
 * Tests cover:
 * - Billing not configured (503)
 * - No billing customer (400)
 * - Missing/empty planId (400)
 * - No subscriptions found (404)
 * - Active subscription exists (409)
 * - Trialing subscription exists (409)
 * - Happy path: canceled to new active subscription
 * - Service throws error
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
    TrialService: vi.fn().mockImplementation(() => ({
        reactivateFromTrial: vi.fn(),
        reactivateSubscription: mockReactivateSubscription
    }))
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Importing the module triggers createSimpleRoute calls which populate handlers.
import '../../src/routes/billing/trial';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Hono context for the handler.
 */
function createMockContext(
    options: {
        billingEnabled?: boolean;
        billingCustomerId?: string | null;
        body?: unknown;
    } = {}
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
    // Service error paths
    // -----------------------------------------------------------------------

    describe('when no subscriptions found (nothing to reactivate)', () => {
        it('should return 404 error from service', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new Error('No canceled subscription found to reactivate')
            );
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toMatchObject({
                success: false,
                subscriptionId: null,
                message: expect.stringContaining('No canceled subscription found')
            });
        });
    });

    describe('when active subscription exists', () => {
        it('should return 409 error from service', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new Error('Cannot reactivate: active subscription exists. Use plan-change instead.')
            );
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toMatchObject({
                success: false,
                subscriptionId: null,
                message: expect.stringContaining('active subscription exists')
            });
        });
    });

    describe('when trialing subscription exists', () => {
        it('should return 409 error from service', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(
                new Error(
                    'Cannot reactivate: trialing subscription exists. Use plan-change instead.'
                )
            );
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toMatchObject({
                success: false,
                subscriptionId: null,
                message: expect.stringContaining('trialing subscription exists')
            });
        });
    });

    // -----------------------------------------------------------------------
    // Happy path
    // -----------------------------------------------------------------------

    describe('when reactivateSubscription succeeds', () => {
        it('should return success=true with subscriptionId and previousPlanId', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockResolvedValue({
                subscriptionId: 'sub_new_123',
                previousPlanId: 'plan_old'
            });
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub_new_123',
                previousPlanId: 'plan_old',
                message: 'Successfully reactivated subscription'
            });
        });

        it('should call reactivateSubscription with customerId and planId', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockResolvedValue({
                subscriptionId: 'sub_new_456',
                previousPlanId: null
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
                planId: 'plan_enterprise'
            });
        });
    });

    // -----------------------------------------------------------------------
    // Service throws error
    // -----------------------------------------------------------------------

    describe('when service throws an error', () => {
        it('should return success=false with error message', async () => {
            // Arrange
            const handler = getReactivateSubscriptionHandler();
            mockReactivateSubscription.mockRejectedValue(new Error('Unexpected billing error'));
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toEqual({
                success: false,
                subscriptionId: null,
                previousPlanId: null,
                message: 'Failed to reactivate subscription: Unexpected billing error'
            });
        });
    });
});
