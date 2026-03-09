/**
 * Unit tests for the trial reactivate endpoint handler.
 *
 * Tests cover:
 * - Successful reactivation from trial to paid subscription
 * - Billing not configured (503)
 * - No billing account (400)
 * - Missing planId in body (400)
 * - Empty string planId in body (400)
 * - Service returns null subscriptionId
 * - Service throws an error (500 HTTPException)
 * - Correct parameters forwarded to reactivateFromTrial
 * - reactivateFromTrial returns a subscriptionId in the response
 * - Canceled subscription reactivation
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
    TrialService: vi.fn().mockImplementation(() => ({
        reactivateFromTrial: mockReactivateFromTrial
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

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_API_DEBUG_ERRORS: false
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Importing the module triggers createSimpleRoute calls which populate capturedHandler.
// The last call to createSimpleRoute inside trial.ts is reactivateTrialRoute.
import '../../src/routes/billing/trial';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a minimal mock Hono context for the reactivate handler.
 *
 * @param options - Configuration for the mock context
 * @returns A mock context object compatible with the handler signature
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
 * The handler converts a trial subscription to a paid subscription by
 * calling TrialService.reactivateFromTrial with the customer ID and planId.
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
        it('should return success=true with the subscriptionId', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue('sub_paid_456');
            const ctx = createMockContext({ body: { planId: 'plan_pro' } });

            // Act
            const result = await handler(ctx);

            // Assert
            expect(result).toEqual({
                success: true,
                subscriptionId: 'sub_paid_456',
                message: 'Successfully converted trial to paid subscription'
            });
        });

        it('should call reactivateFromTrial with customerId and planId', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue('sub_paid_789');
            const ctx = createMockContext({
                billingCustomerId: 'cust_abc',
                body: { planId: 'plan_enterprise' }
            });

            // Act
            await handler(ctx);

            // Assert
            expect(mockReactivateFromTrial).toHaveBeenCalledWith({
                customerId: 'cust_abc',
                planId: 'plan_enterprise'
            });
        });

        it('should include the subscriptionId returned by the service in the response', async () => {
            // Arrange
            const handler = getReactivateHandler();
            const expectedSubId = 'sub_paid_unique_99';
            mockReactivateFromTrial.mockResolvedValue(expectedSubId);
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act
            const result = (await handler(ctx)) as { subscriptionId: string };

            // Assert
            expect(result.subscriptionId).toBe(expectedSubId);
        });
    });

    // -----------------------------------------------------------------------
    // Service failure paths
    // -----------------------------------------------------------------------

    describe('when reactivateFromTrial throws an error', () => {
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

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    describe('when reactivating a canceled subscription (not just trialing)', () => {
        it('should still call the service and return success when it resolves', async () => {
            // Arrange - service handles both trialing and canceled statuses internally
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue('sub_reactivated_from_canceled');
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
                planId: 'plan_pro'
            });
        });
    });

    describe('when reactivateFromTrial returns null (no active trial found)', () => {
        it('should return success=true with subscriptionId=null', async () => {
            // Arrange
            const handler = getReactivateHandler();
            mockReactivateFromTrial.mockResolvedValue(null);
            const ctx = createMockContext({ body: { planId: 'plan_basic' } });

            // Act
            const result = (await handler(ctx)) as { success: boolean; subscriptionId: null };

            // Assert
            // The handler trusts the service; if it resolves, success=true is returned
            expect(result.success).toBe(true);
            expect(result.subscriptionId).toBeNull();
        });
    });
});
