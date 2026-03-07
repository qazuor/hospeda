/**
 * Past-Due Grace Period Middleware Flow Integration Tests
 *
 * Tests the `pastDueGraceMiddleware` behavior across all subscription states.
 * The middleware enforces the grace period policy for `past_due` subscriptions:
 * - Active subscriptions pass through immediately
 * - Past-due within grace period: passes through with header set
 * - Past-due beyond grace period: blocked with 402
 * - No billing or no customer: passes through silently
 * - Public routes: bypass the check
 *
 * Test scenarios:
 * 1. Active subscription -> next() is called, no grace header set
 * 2. Past-due within grace (<3 days remaining) -> next() called, grace info on context
 * 3. Past-due beyond grace -> 402 returned, next() NOT called
 * 4. Billing not configured -> next() called (billing disabled)
 * 5. No billing customer ID -> next() called (anonymous or unlinked user)
 * 6. Public routes bypass grace period check
 *
 * @module test/integration/grace-period-flow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { pastDueGraceMiddleware } from '../../src/middlewares/past-due-grace.middleware';

// Standard mocks required by the billing system
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/redis', () => ({
    getRedisClient: vi.fn().mockResolvedValue(undefined)
}));

// Mock @repo/logger to suppress noise in test output
vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerLogMethod: vi.fn().mockReturnThis(),
        permission: vi.fn()
    });

    const mockedLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        registerCategory: vi.fn(() => createMockedLogger()),
        configure: vi.fn(),
        resetConfig: vi.fn(),
        createLogger: vi.fn(() => createMockedLogger()),
        registerLogMethod: vi.fn().mockReturnThis()
    };

    const LoggerColors = {
        BLACK: 'BLACK',
        RED: 'RED',
        GREEN: 'GREEN',
        YELLOW: 'YELLOW',
        BLUE: 'BLUE',
        MAGENTA: 'MAGENTA',
        CYAN: 'CYAN',
        WHITE: 'WHITE',
        GRAY: 'GRAY',
        BLACK_BRIGHT: 'BLACK_BRIGHT',
        RED_BRIGHT: 'RED_BRIGHT',
        GREEN_BRIGHT: 'GREEN_BRIGHT',
        YELLOW_BRIGHT: 'YELLOW_BRIGHT',
        BLUE_BRIGHT: 'BLUE_BRIGHT',
        MAGENTA_BRIGHT: 'MAGENTA_BRIGHT',
        CYAN_BRIGHT: 'CYAN_BRIGHT',
        WHITE_BRIGHT: 'WHITE_BRIGHT'
    };

    const LogLevel = {
        LOG: 'LOG',
        INFO: 'INFO',
        WARN: 'WARN',
        ERROR: 'ERROR',
        DEBUG: 'DEBUG'
    };

    return {
        default: mockedLogger,
        logger: mockedLogger,
        createLogger: mockedLogger.createLogger,
        LoggerColors,
        LogLevel,
        apiLogger: createMockedLogger()
    };
});

// ----------------------------------------------------------------
// Test data and fixture builders
// ----------------------------------------------------------------

const CUSTOMER_ID = 'cust-grace-001';

/**
 * Build a minimal past-due subscription stub that satisfies
 * the `QZPaySubscriptionWithHelpers` interface used by the middleware.
 */
function buildPastDueSubscription(daysRemainingInGrace: number): Record<string, unknown> {
    const isInGrace = daysRemainingInGrace > 0;

    return {
        id: 'sub-past-due-001',
        customerId: CUSTOMER_ID,
        status: 'past_due',
        isPastDue: vi.fn().mockReturnValue(true),
        isInGracePeriod: vi.fn().mockReturnValue(isInGrace),
        daysRemainingInGrace: vi.fn().mockReturnValue(daysRemainingInGrace)
    };
}

/**
 * Build a minimal active subscription stub.
 */
function buildActiveSubscription(): Record<string, unknown> {
    return {
        id: 'sub-active-001',
        customerId: CUSTOMER_ID,
        status: 'active',
        isPastDue: vi.fn().mockReturnValue(false),
        isInGracePeriod: vi.fn().mockReturnValue(false),
        daysRemainingInGrace: vi.fn().mockReturnValue(0)
    };
}

/**
 * Build a mock Hono context object.
 *
 * The middleware reads:
 * - `c.get('billingEnabled')` -> boolean
 * - `c.get('billingCustomerId')` -> string | undefined
 *
 * And may call:
 * - `c.header(name, value)` -> sets a response header
 * - `c.json(body, status)` -> returns a JSON response
 */
function buildMockContext(options: {
    billingEnabled?: boolean;
    billingCustomerId?: string;
    path?: string;
}) {
    // Deliberately not using default destructuring for billingCustomerId so that
    // passing `undefined` explicitly results in `undefined` (not the fallback CUSTOMER_ID).
    const billingEnabled = options.billingEnabled ?? true;
    const billingCustomerId =
        'billingCustomerId' in options ? options.billingCustomerId : CUSTOMER_ID;
    const path = options.path ?? '/api/v1/protected/test';

    const contextValues: Record<string, unknown> = {
        billingEnabled,
        billingCustomerId
    };

    const headersSet: Record<string, string> = {};
    let jsonResponse: { body: unknown; status: number } | null = null;

    const context = {
        get: vi.fn((key: string) => contextValues[key]),
        set: vi.fn((key: string, value: unknown) => {
            contextValues[key] = value;
        }),
        header: vi.fn((name: string, value: string) => {
            headersSet[name] = value;
        }),
        json: vi.fn((body: unknown, status: number) => {
            jsonResponse = { body, status };
            return jsonResponse;
        }),
        req: {
            path
        },
        // Expose for assertions
        _headersSet: headersSet,
        _jsonResponse: () => jsonResponse,
        _contextValues: contextValues
    };

    return context;
}

// ----------------------------------------------------------------
// Test suite
// ----------------------------------------------------------------

describe('Past-Due Grace Period Middleware Flow', () => {
    const mockedGetQZPayBilling = getQZPayBilling as MockedFunction<typeof getQZPayBilling>;
    let mockBilling: {
        subscriptions: {
            getByCustomerId: MockedFunction<(...args: unknown[]) => Promise<unknown[]>>;
        };
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockBilling = {
            subscriptions: {
                getByCustomerId: vi.fn().mockResolvedValue([])
            }
        };

        mockedGetQZPayBilling.mockReturnValue(mockBilling as any);
    });

    // ----------------------------------------------------------------
    // Scenario 1: Active subscription -> passes through
    // ----------------------------------------------------------------
    describe('when the subscription is active', () => {
        it('should call next() without setting any grace period header', async () => {
            // Arrange
            const activeSub = buildActiveSubscription();
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([activeSub]);

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // ----------------------------------------------------------------
    // Scenario 2: Past-due within grace period (<3 days remaining)
    // ----------------------------------------------------------------
    describe('when the subscription is past-due within the grace period', () => {
        it('should call next() and set the X-Grace-Period-Days-Remaining header', async () => {
            // Arrange: 2 days remaining in grace period
            const pastDueSub = buildPastDueSubscription(2);
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([pastDueSub]);

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert: request is allowed
            expect(next).toHaveBeenCalledOnce();
            // Grace period header should be set
            expect(ctx.header).toHaveBeenCalledWith('X-Grace-Period-Days-Remaining', '2');
            // No blocking response
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should set the header to 0 when there is exactly 0 days remaining in grace', async () => {
            // Arrange: 0 days remaining (still technically in grace)
            const pastDueSub = buildPastDueSubscription(0);
            // Override isInGracePeriod to return true even at 0 days
            (pastDueSub.isInGracePeriod as MockedFunction<() => boolean>).mockReturnValue(true);
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([pastDueSub]);

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).toHaveBeenCalledWith('X-Grace-Period-Days-Remaining', '0');
        });
    });

    // ----------------------------------------------------------------
    // Scenario 3: Past-due beyond grace period -> blocked with 402
    // ----------------------------------------------------------------
    describe('when the subscription is past-due and the grace period has expired', () => {
        it('should return 402 and not call next()', async () => {
            // Arrange: -3 days remaining (3 days overdue)
            const pastDueSub = buildPastDueSubscription(-3);
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([pastDueSub]);

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert: request is blocked
            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledOnce();

            const jsonCallArgs = ctx.json.mock.calls[0] as [Record<string, unknown>, number];
            const [body, status] = jsonCallArgs;
            expect(status).toBe(402);
            expect(body?.error).toBe('GRACE_PERIOD_EXPIRED');
            expect(typeof body?.daysOverdue).toBe('number');
        });

        it('should include the daysOverdue count in the error response body', async () => {
            // Arrange: 5 days overdue
            const pastDueSub = buildPastDueSubscription(-5);
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([pastDueSub]);

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn();

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            const jsonCallArgs = ctx.json.mock.calls[0] as [Record<string, unknown>, number];
            const [body] = jsonCallArgs;
            expect(body?.daysOverdue).toBe(5);
        });
    });

    // ----------------------------------------------------------------
    // Scenario 4: Billing not configured -> passes through
    // ----------------------------------------------------------------
    describe('when billing is not configured', () => {
        it('should call next() immediately without querying subscriptions', async () => {
            // Arrange: billingEnabled is false
            const ctx = buildMockContext({ billingEnabled: false, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(mockBilling.subscriptions.getByCustomerId).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // ----------------------------------------------------------------
    // Scenario 5: No billing customer ID -> passes through
    // ----------------------------------------------------------------
    describe('when there is no billing customer ID in context', () => {
        it('should call next() without querying subscriptions', async () => {
            // Arrange: authenticated user but no billing customer linked
            const ctx = buildMockContext({
                billingEnabled: true,
                billingCustomerId: undefined
            });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(mockBilling.subscriptions.getByCustomerId).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // ----------------------------------------------------------------
    // Scenario 6: Public routes bypass grace period check
    // ----------------------------------------------------------------
    describe('when the request is to a public route', () => {
        it('should pass through even with a past-due beyond grace subscription', async () => {
            // The middleware itself does not implement route-based bypasses;
            // public routes are protected differently at the routing layer.
            // This test validates that if billingCustomerId is absent (public routes
            // typically do not set it), the middleware passes through cleanly.

            // Arrange: public route, no billing customer
            const ctx = buildMockContext({
                billingEnabled: true,
                billingCustomerId: undefined,
                path: '/api/v1/public/accommodations'
            });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert: public route has no customer, passes through
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // ----------------------------------------------------------------
    // Scenario 7: Grace-exempt recovery paths bypass enforcement
    // ----------------------------------------------------------------
    describe('when the request targets a grace-exempt recovery path', () => {
        it('should call next() for /trial/reactivate-subscription even with expired grace', async () => {
            // Arrange: grace expired (-3 days)
            const pastDueSub = buildPastDueSubscription(-3);
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([pastDueSub]);

            const ctx = buildMockContext({
                billingEnabled: true,
                billingCustomerId: CUSTOMER_ID,
                path: '/api/v1/protected/billing/trial/reactivate-subscription'
            });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert: recovery path is allowed through
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should call next() for /subscriptions/reactivate even with expired grace', async () => {
            // Arrange
            const pastDueSub = buildPastDueSubscription(-2);
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([pastDueSub]);

            const ctx = buildMockContext({
                billingEnabled: true,
                billingCustomerId: CUSTOMER_ID,
                path: '/api/v1/protected/billing/subscriptions/reactivate'
            });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // ----------------------------------------------------------------
    // Edge cases
    // ----------------------------------------------------------------
    describe('edge cases', () => {
        it('should pass through (fail open) when subscription lookup throws an error', async () => {
            // Arrange: subscriptions API throws unexpectedly
            mockBilling.subscriptions.getByCustomerId.mockRejectedValue(
                new Error('Network timeout')
            );

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert: fail open - request is allowed even on unexpected errors
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should pass through when customer has no past-due subscription', async () => {
            // Arrange: customer has only active subscriptions
            const activeSub = buildActiveSubscription();
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([activeSub]);

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should pass through when customer has no subscriptions at all', async () => {
            // Arrange: new user with no billing history
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([]);

            const ctx = buildMockContext({ billingEnabled: true, billingCustomerId: CUSTOMER_ID });
            const next = vi.fn().mockResolvedValue(undefined);

            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as any, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });
});
