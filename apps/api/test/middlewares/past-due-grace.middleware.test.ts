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

import { HTTPException } from 'hono/http-exception';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Deterministic clock
// ---------------------------------------------------------------------------

/**
 * Milliseconds in one day. Mirrors `ONE_DAY_MS` in the middleware so that
 * `currentPeriodEnd` offsets in the expired-grace tests map 1:1 to the
 * middleware's `daysOverdue` computation.
 */
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Grace window honored by qzpay-core (must match `QZPAY_GRACE_WINDOW_DAYS` in
 * the middleware). The middleware computes:
 *   daysOverdue = max(0, ceil((now - currentPeriodEnd) / 1d) - QZPAY_GRACE_WINDOW_DAYS)
 */
const QZPAY_GRACE_WINDOW_DAYS = 7;

/**
 * Fixed "now" for all tests. The expired-grace branch of the middleware reads
 * `Date.now()`, so we pin the system clock to make `daysOverdue` deterministic
 * instead of relative to the wall clock at test run time.
 */
const FIXED_NOW = new Date('2026-06-01T00:00:00.000Z');

/**
 * Builds a `currentPeriodEnd` that lands the requested number of days past the
 * grace window, so the middleware reports exactly `daysOverdue` overdue days.
 *
 * @param daysOverdue - Desired `daysOverdue` value the middleware should report
 * @returns A `Date` set `daysOverdue + QZPAY_GRACE_WINDOW_DAYS` days before `FIXED_NOW`
 */
function periodEndForOverdue(daysOverdue: number): Date {
    return new Date(FIXED_NOW.getTime() - (daysOverdue + QZPAY_GRACE_WINDOW_DAYS) * ONE_DAY_MS);
}

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
    currentPeriodEnd?: Date;
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
        currentPeriodEnd?: Date;
    } = {}
): MockSubscription {
    const {
        isPastDue = false,
        isInGracePeriod = false,
        daysRemainingInGrace = null,
        currentPeriodEnd
    } = overrides;

    return {
        id: 'sub_abc123',
        isPastDue: vi.fn().mockReturnValue(isPastDue),
        isInGracePeriod: vi.fn().mockReturnValue(isInGracePeriod),
        daysRemainingInGrace: vi.fn().mockReturnValue(daysRemainingInGrace),
        currentPeriodEnd
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
        // Pin the clock so the expired-grace `daysOverdue` calc (which reads
        // Date.now()) is deterministic rather than relative to the wall clock.
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
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
            // Arrange — cycle ended 8 days ago, so daysOverdue = 8 - 7 (grace) = 1
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -1,
                currentPeriodEnd: periodEndForOverdue(1)
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act / Assert — thrown, not `c.json`-ed, so the shared error formatter
            // builds the body (HOS-283). The old hand-rolled shape put a STRING
            // in `error` instead of the `{code, message}` envelope, which the
            // web client could not parse at all.
            const thrown = await middleware(ctx as never, next).catch((e: unknown) => e);
            expect(thrown).toBeInstanceOf(HTTPException);
            const httpError = thrown as HTTPException;
            expect(httpError.status).toBe(402);
            expect(httpError.message).toContain('grace period has expired');
            expect(httpError.cause).toEqual({
                code: 'GRACE_PERIOD_EXPIRED',
                // daysOverdue computed from currentPeriodEnd: ceil(8d) - 7d grace = 1
                daysOverdue: 1
            });
            expect(next).not.toHaveBeenCalled();
            expect(ctx.json).not.toHaveBeenCalled();
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
            const thrown = await middleware(ctx as never, next).catch((e: unknown) => e);

            // Assert
            expect(next).not.toHaveBeenCalled();
            expect(ctx.header).not.toHaveBeenCalled();
            expect(thrown).toBeInstanceOf(HTTPException);
            expect((thrown as HTTPException).status).toBe(402);
            expect((thrown as HTTPException).cause).toEqual({
                code: 'GRACE_PERIOD_EXPIRED',
                daysOverdue: 0
            });
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
            await middleware(ctx as never, next).catch(() => undefined);

            // Assert
            expect(next).not.toHaveBeenCalled();
        });

        // HOS-283: the block is now a THROW, and the catch below it fails OPEN.
        // Without the `instanceof HTTPException` re-throw guard, this gate would
        // swallow its own decision and let the past-due customer through — the
        // gate would silently stop gating.
        it('must not be swallowed by the fail-open catch', async () => {
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
            const thrown = await middleware(ctx as never, next).catch((e: unknown) => e);

            // Assert — the request is blocked, not allowed through
            expect(thrown).toBeInstanceOf(HTTPException);
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
                reqPath: '/api/v1/protected/billing/trial/reactivate'
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
                reqPath: '/api/v1/protected/billing/trial/reactivate-subscription'
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
                reqPath: '/api/v1/protected/billing/checkout'
            });
            const middleware = pastDueGraceMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.json).not.toHaveBeenCalled();
        });

        it('should call next() for commerce owner start-subscription even with expired grace (HOS-166)', async () => {
            // Arrange — dual-persona user: accommodation subscription is past-due
            // and grace-expired, but they are paying for a NEW commerce listing.
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -3
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext({
                reqPath:
                    '/api/v1/protected/commerce/listings/gastronomy/11111111-1111-1111-1111-111111111111/start-subscription'
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
                reqPath: '/api/v1/protected/billing/subscriptions'
            });
            const middleware = pastDueGraceMiddleware();

            // Act
            const thrown = await middleware(ctx as never, next).catch((e: unknown) => e);

            // Assert
            expect(next).not.toHaveBeenCalled();
            expect(thrown).toBeInstanceOf(HTTPException);
            expect((thrown as HTTPException).status).toBe(402);
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
            const thrown = await middleware(ctx as never, next).catch((e: unknown) => e);

            // Assert - sub2 (0 days, expired) should be chosen, resulting in 402
            expect(next).not.toHaveBeenCalled();
            expect(thrown).toBeInstanceOf(HTTPException);
            expect((thrown as HTTPException).status).toBe(402);
        });

        it('should use the most expired subscription when both are past grace', async () => {
            // Arrange
            const sub1 = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -1,
                currentPeriodEnd: periodEndForOverdue(1)
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
            const thrown = await middleware(ctx as never, next).catch((e: unknown) => e);

            // Assert - sub1 (-1 days, most urgent) should be chosen, resulting in 402
            expect(next).not.toHaveBeenCalled();
            expect(thrown).toBeInstanceOf(HTTPException);
            expect((thrown as HTTPException).status).toBe(402);
            expect((thrown as HTTPException).cause).toMatchObject({
                daysOverdue: 1 // ceil(8d) - 7d grace = 1
            });
        });
    });

    // -----------------------------------------------------------------------
    // Response shape validation
    // -----------------------------------------------------------------------

    describe('402 response body shape', () => {
        it('carries the cause the error formatter turns into reason + details', async () => {
            // Arrange
            const pastDueSub = createMockSubscription({
                isPastDue: true,
                isInGracePeriod: false,
                daysRemainingInGrace: -3,
                currentPeriodEnd: periodEndForOverdue(3)
            });
            setupBillingWith([pastDueSub]);
            const ctx = createMockContext();
            const middleware = pastDueGraceMiddleware();

            // Act
            const thrown = await middleware(ctx as never, next).catch((e: unknown) => e);

            // Assert — the wire body is built by `createErrorHandler`, which maps
            // this cause to `code: ENTITLEMENT_REQUIRED` + `reason:
            // GRACE_PERIOD_EXPIRED` + `details.daysOverdue` (HOS-283; asserted
            // end-to-end in test/middlewares/response.test.ts).
            expect(thrown).toBeInstanceOf(HTTPException);
            const httpError = thrown as HTTPException;
            expect(httpError.message).toEqual(expect.any(String));
            expect(httpError.cause).toMatchObject({
                code: 'GRACE_PERIOD_EXPIRED',
                daysOverdue: 3 // ceil(10d) - 7d grace = 3
            });
        });
    });
});
