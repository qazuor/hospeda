/**
 * Unit tests for the past-due grace period middleware.
 *
 * Verifies all branching behavior of `pastDueGraceMiddleware`:
 * - Pass-through conditions (billing disabled, no customer, no past-due sub)
 * - Grace period active: next() called, header set
 * - Grace period expired: 402 returned with GRACE_PERIOD_EXPIRED
 * - Unexpected errors: fail open (next() called)
 *
 * @module test/middlewares/past-due-grace.middleware
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks - must be declared before any imports from the mocked modules
// ---------------------------------------------------------------------------

/** Controls what `getQZPayBilling()` returns in each test. */
const { mockGetQZPayBilling } = vi.hoisted(() => ({
    mockGetQZPayBilling: vi.fn()
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: mockGetQZPayBilling
}));

// The api logger is provided by @repo/logger which is already mocked in
// test/setup.ts via vi.mock('@repo/logger'). The logger module re-exports
// the mocked logger, so no additional mock is needed here.
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Subject under test (imported after mocks are declared)
// ---------------------------------------------------------------------------

import { pastDueGraceMiddleware } from '../../src/middlewares/past-due-grace.middleware';

// ---------------------------------------------------------------------------
// Helper types and factories
// ---------------------------------------------------------------------------

/**
 * Minimal subset of `QZPaySubscriptionWithHelpers` used by the middleware.
 */
interface MockSubscription {
    id: string;
    isPastDue: Mock;
    isInGracePeriod: Mock;
    daysRemainingInGrace: Mock;
}

/**
 * Options for building a mock Hono context.
 */
interface MockContextOptions {
    billingEnabled?: boolean;
    billingCustomerId?: string | null;
    reqPath?: string;
}

/**
 * Creates a minimal mock Hono context for `AppBindings`.
 *
 * @param options - Overrides for context values
 * @returns Mock context with jest spies on `header` and `json`
 */
function createMockContext(options: MockContextOptions = {}) {
    const billingEnabled = options.billingEnabled ?? true;
    const reqPath = options.reqPath ?? '/api/v1/protected/test';

    // Use 'in' check so that explicitly passing undefined stores undefined
    // (JS destructuring defaults replace undefined with the default value)
    const billingCustomerId =
        'billingCustomerId' in options ? options.billingCustomerId : 'cust_123';

    const contextStore = new Map<string, unknown>([
        ['billingEnabled', billingEnabled],
        ['billingCustomerId', billingCustomerId]
    ]);

    return {
        get: vi.fn((key: string) => contextStore.get(key)),
        header: vi.fn(),
        json: vi.fn((body: unknown, status: number) => ({ body, status })),
        req: { path: reqPath }
    };
}

/**
 * Creates a mock subscription with controlled helper method return values.
 *
 * @param overrides - Partial subscription helper return values
 * @returns Mock subscription object
 */
function createMockSubscription(
    overrides: {
        isPastDue?: boolean;
        isInGracePeriod?: boolean;
        daysRemainingInGrace?: number | null;
    } = {}
): MockSubscription {
    const { isPastDue = false, isInGracePeriod = false, daysRemainingInGrace = null } = overrides;

    return {
        id: 'sub_abc123',
        isPastDue: vi.fn().mockReturnValue(isPastDue),
        isInGracePeriod: vi.fn().mockReturnValue(isInGracePeriod),
        daysRemainingInGrace: vi.fn().mockReturnValue(daysRemainingInGrace)
    };
}

/**
 * Configures `getQZPayBilling` to return a mock billing instance whose
 * `subscriptions.getByCustomerId` resolves with the given subscriptions.
 *
 * @param subscriptions - Subscriptions to return from the mock
 */
function setupBillingWith(subscriptions: MockSubscription[]): void {
    mockGetQZPayBilling.mockReturnValue({
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue(subscriptions)
        }
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pastDueGraceMiddleware', () => {
    /** `next` function spy shared across all tests. */
    let next: Mock;

    beforeEach(() => {
        next = vi.fn().mockResolvedValue(undefined);
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Pass-through: billing disabled
    // -----------------------------------------------------------------------

    describe('when billing is disabled', () => {
        it('should call next() without checking subscriptions', async () => {
            // Arrange
            const ctx = createMockContext({ billingEnabled: false });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(mockGetQZPayBilling).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
            expect(ctx.header).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Pass-through: no billing customer
    // -----------------------------------------------------------------------

    describe('when no billing customer is set', () => {
        it('should call next() without checking subscriptions (null customer)', async () => {
            // Arrange
            const ctx = createMockContext({ billingCustomerId: null });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(mockGetQZPayBilling).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should call next() without checking subscriptions (undefined customer)', async () => {
            // Arrange
            const ctx = createMockContext({ billingCustomerId: undefined as unknown as null });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(mockGetQZPayBilling).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Pass-through: active subscription (not past due)
    // -----------------------------------------------------------------------

    describe('when subscription is active (isPastDue = false)', () => {
        it('should call next() without setting grace header', async () => {
            // Arrange
            const activeSub = createMockSubscription({ isPastDue: false });
            setupBillingWith([activeSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
            expect(activeSub.isInGracePeriod).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Pass-through: trialing subscription (not past due)
    // -----------------------------------------------------------------------

    describe('when subscription is trialing (isPastDue = false)', () => {
        it('should call next() immediately', async () => {
            // Arrange
            const trialSub = createMockSubscription({ isPastDue: false });
            setupBillingWith([trialSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Pass-through: no subscriptions returned
    // -----------------------------------------------------------------------

    describe('when customer has no subscriptions', () => {
        it('should call next() without blocking', async () => {
            // Arrange
            setupBillingWith([]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
            expect(ctx.header).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Grace period active
    // -----------------------------------------------------------------------

    describe('when subscription is past due and within grace period', () => {
        it('should call next() and set X-Grace-Period-Days-Remaining header', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: true,
                daysRemainingInGrace: 2
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).toHaveBeenCalledWith('X-Grace-Period-Days-Remaining', '2');
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should set header to "3" when daysRemainingInGrace returns 3 (boundary - day 0 of expiry)', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: true,
                daysRemainingInGrace: 3
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).toHaveBeenCalledWith('X-Grace-Period-Days-Remaining', '3');
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should set header to "0" when daysRemainingInGrace returns null (defaults to 0)', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: true,
                daysRemainingInGrace: null
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).toHaveBeenCalledWith('X-Grace-Period-Days-Remaining', '0');
        });
    });

    // -----------------------------------------------------------------------
    // Grace period expired
    // -----------------------------------------------------------------------

    describe('when subscription is past due and grace period has expired', () => {
        it('should return 402 with GRACE_PERIOD_EXPIRED error', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -1
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledOnce();

            const [body, status] = (ctx.json as Mock).mock.calls[0] as [
                { error: string; message: string; daysOverdue: number },
                number
            ];
            expect(status).toBe(402);
            expect(body.error).toBe('GRACE_PERIOD_EXPIRED');
            expect(body).toHaveProperty('message');
            expect(body).toHaveProperty('daysOverdue');
            // daysOverdue = Math.abs(-1) = 1
            expect(body.daysOverdue).toBe(1);
        });

        it('should return 402 and not set grace header when grace exactly expired (daysRemaining = 0)', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: 0
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).not.toHaveBeenCalled();
            expect(ctx.header).not.toHaveBeenCalled();

            const [body, status] = (ctx.json as Mock).mock.calls[0] as [
                { error: string; daysOverdue: number },
                number
            ];
            expect(status).toBe(402);
            expect(body.error).toBe('GRACE_PERIOD_EXPIRED');
            // Math.abs(0) = 0
            expect(body.daysOverdue).toBe(0);
        });

        it('should not call next() when blocking with 402', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -5
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Unexpected errors: fail open
    // -----------------------------------------------------------------------

    describe('when getByCustomerId throws an unexpected error', () => {
        it('should call next() and not propagate the error (fail open)', async () => {
            // Arrange
            const networkError = new Error('Network timeout');
            mockGetQZPayBilling.mockReturnValue({
                subscriptions: {
                    getByCustomerId: vi.fn().mockRejectedValue(networkError)
                }
            });
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
            expect(ctx.header).not.toHaveBeenCalled();
        });

        it('should fail open for non-Error thrown values', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue({
                subscriptions: {
                    getByCustomerId: vi.fn().mockRejectedValue('string error')
                }
            });
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should fail open when getQZPayBilling returns null', async () => {
            // Arrange
            mockGetQZPayBilling.mockReturnValue(null);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act - findPastDueSubscription returns null when billing is null,
            // so the middleware treats it as "no past-due sub found"
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Multiple subscriptions: only past-due one triggers logic
    // -----------------------------------------------------------------------

    describe('when customer has multiple subscriptions', () => {
        it('should use the first past-due subscription when mixed statuses present', async () => {
            // Arrange
            const activeSub = createMockSubscription({ isPastDue: false });
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: true,
                daysRemainingInGrace: 1
            });
            setupBillingWith([activeSub, pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            // activeSub.isPastDue() returns false, so Array.find moves to pastDueSub
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).toHaveBeenCalledWith('X-Grace-Period-Days-Remaining', '1');
        });

        it('should call next() with no header when all subscriptions are active', async () => {
            // Arrange
            const active1 = createMockSubscription({ isPastDue: false });
            const active2 = createMockSubscription({ isPastDue: false });
            setupBillingWith([active1, active2]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.header).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Grace-exempt paths (recovery paths bypass grace enforcement)
    // -----------------------------------------------------------------------

    describe('when request path is grace-exempt', () => {
        it('should call next() for /trial/reactivate even with expired grace', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -3
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext({
                reqPath: '/api/v1/billing/trial/reactivate'
            });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should call next() for /trial/reactivate-subscription even with expired grace', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -1
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext({
                reqPath: '/api/v1/billing/trial/reactivate-subscription'
            });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should call next() for /checkout even with expired grace', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -5
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext({
                reqPath: '/api/v1/billing/checkout'
            });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should still block non-exempt path /subscriptions with expired grace', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -1
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext({
                reqPath: '/api/v1/billing/subscriptions'
            });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledOnce();
            const [_body, status] = (ctx.json as Mock).mock.calls[0] as [unknown, number];
            expect(status).toBe(402);
        });
    });

    // -----------------------------------------------------------------------
    // Multiple past-due subscriptions: deterministic selection
    // -----------------------------------------------------------------------

    describe('when multiple past_due subscriptions exist', () => {
        it('should use the subscription with fewest grace days remaining (most urgent)', async () => {
            // Arrange
            const sub1 = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: true,
                daysRemainingInGrace: 2
            });
            const sub2 = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: 0
            });
            setupBillingWith([sub1, sub2]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert - sub2 (0 days, expired) should be chosen, resulting in 402
            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledOnce();
            const [_body, status] = (ctx.json as Mock).mock.calls[0] as [unknown, number];
            expect(status).toBe(402);
        });

        it('should use the most expired subscription when both are past grace', async () => {
            // Arrange
            const sub1 = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -1
            });
            const sub2 = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: true,
                daysRemainingInGrace: 1
            });
            setupBillingWith([sub1, sub2]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert - sub1 (-1 days, most urgent) should be chosen, resulting in 402
            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).toHaveBeenCalledOnce();
            const [body, status] = (ctx.json as Mock).mock.calls[0] as [
                { daysOverdue: number },
                number
            ];
            expect(status).toBe(402);
            expect(body.daysOverdue).toBe(1); // Math.abs(-1)
        });
    });

    // -----------------------------------------------------------------------
    // Response shape validation
    // -----------------------------------------------------------------------

    describe('402 response body shape', () => {
        it('should include error, message, and daysOverdue fields', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -3
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            const [body] = (ctx.json as Mock).mock.calls[0] as [
                { error: string; message: string; daysOverdue: number }
            ];
            expect(body).toMatchObject({
                error: 'GRACE_PERIOD_EXPIRED',
                message: expect.any(String),
                daysOverdue: 3 // Math.abs(-3)
            });
        });
    });
});
