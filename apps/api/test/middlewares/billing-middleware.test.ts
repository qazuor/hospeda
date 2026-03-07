/**
 * Tests for Billing Middleware
 *
 * Validates billing middleware initialization, lazy loading,
 * context setup, error handling, and the requireBilling guard.
 *
 * @module test/middlewares/billing-middleware
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies
const mockGetDb = vi.fn();
const mockCreateBillingAdapter = vi.fn();
const mockCreateMercadoPagoAdapter = vi.fn();
const mockCreateQZPayBilling = vi.fn();
const mockCreateQZPayMiddleware = vi.fn();

vi.mock('@repo/db', () => ({
    getDb: () => mockGetDb(),
    createBillingAdapter: (...args: unknown[]) => mockCreateBillingAdapter(...args)
}));

vi.mock('@repo/billing', () => ({
    createMercadoPagoAdapter: (...args: unknown[]) => mockCreateMercadoPagoAdapter(...args)
}));

vi.mock('@qazuor/qzpay-core', () => ({
    createQZPayBilling: (...args: unknown[]) => mockCreateQZPayBilling(...args)
}));

vi.mock('@qazuor/qzpay-hono', () => ({
    createQZPayMiddleware: (...args: unknown[]) => mockCreateQZPayMiddleware(...args)
}));

// Mock logger
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: (...args: unknown[]) => mockLoggerInfo(...args),
        warn: (...args: unknown[]) => mockLoggerWarn(...args),
        error: (...args: unknown[]) => mockLoggerError(...args),
        debug: vi.fn()
    }
}));

// Mock Sentry
const mockSentryIsEnabled = vi.fn();
const mockSentrySetContext = vi.fn();
const mockSentrySetTag = vi.fn();
const mockSentryCaptureException = vi.fn();
const mockSetUserFromContext = vi.fn();

vi.mock('../../src/lib/sentry', () => ({
    Sentry: {
        isEnabled: () => mockSentryIsEnabled(),
        setContext: (...args: unknown[]) => mockSentrySetContext(...args),
        setTag: (...args: unknown[]) => mockSentrySetTag(...args),
        captureException: (...args: unknown[]) => mockSentryCaptureException(...args)
    },
    setUserFromContext: (...args: unknown[]) => mockSetUserFromContext(...args)
}));

/**
 * Create a mock Hono context
 */
function createMockContext(
    overrides: {
        path?: string;
        method?: string;
        store?: Record<string, unknown>;
        headers?: Record<string, string>;
        requestId?: string;
    } = {}
) {
    const store: Record<string, unknown> = overrides.store ?? {};

    return {
        req: {
            path: overrides.path ?? '/api/v1/protected/billing/subscriptions',
            method: overrides.method ?? 'GET',
            query: () => ({}),
            header: () => overrides.headers ?? { 'content-type': 'application/json' }
        },
        res: { status: 200 },
        get: (key: string) => store[key],
        set: (key: string, value: unknown) => {
            store[key] = value;
        },
        json: vi.fn().mockImplementation((body: unknown, status?: number) => ({
            body,
            status: status ?? 200
        })),
        _store: store
    } as unknown as Record<string, unknown>;
}

describe('sentryMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset module registry for fresh imports
        vi.resetModules();
    });

    it('should skip when Sentry is not enabled', async () => {
        const { sentryMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(false);
        const ctx = createMockContext();
        const next = vi.fn();

        const middleware = sentryMiddleware();
        await middleware(ctx as never, next);

        expect(next).toHaveBeenCalled();
        expect(mockSentrySetContext).not.toHaveBeenCalled();
    });

    it('should set request context when Sentry is enabled', async () => {
        const { sentryMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({ path: '/api/v1/test', method: 'POST' });
        const next = vi.fn();

        const middleware = sentryMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetContext).toHaveBeenCalledWith(
            'request',
            expect.objectContaining({
                method: 'POST',
                url: '/api/v1/test'
            })
        );
    });

    it('should set request ID tag when available', async () => {
        const { sentryMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({
            store: { requestId: 'req-abc-123' }
        });
        const next = vi.fn();

        const middleware = sentryMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetTag).toHaveBeenCalledWith('request_id', 'req-abc-123');
    });

    it('should set user context from Hono context', async () => {
        const { sentryMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext();
        const next = vi.fn();

        const middleware = sentryMiddleware();
        await middleware(ctx as never, next);

        expect(mockSetUserFromContext).toHaveBeenCalledWith(ctx);
    });

    it('should capture exception and re-throw on error', async () => {
        const { sentryMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext();
        const testError = new Error('Route handler crashed');
        const next = vi.fn().mockRejectedValue(testError);

        const middleware = sentryMiddleware();

        await expect(middleware(ctx as never, next)).rejects.toThrow('Route handler crashed');
        expect(mockSentryCaptureException).toHaveBeenCalledWith(testError, expect.any(Object));
    });

    it('should sanitize sensitive headers', async () => {
        const { sentryMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({
            headers: {
                'content-type': 'application/json',
                authorization: 'Bearer secret-token',
                cookie: 'session=abc',
                'x-api-key': 'key-123',
                'x-auth-token': 'auth-456'
            }
        });
        const next = vi.fn();

        const middleware = sentryMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetContext).toHaveBeenCalledWith(
            'request',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'content-type': 'application/json',
                    authorization: '[REDACTED]',
                    cookie: '[REDACTED]',
                    'x-api-key': '[REDACTED]',
                    'x-auth-token': '[REDACTED]'
                })
            })
        );
    });
});

describe('sentryBillingMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should skip when Sentry is not enabled', async () => {
        const { sentryBillingMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(false);
        const ctx = createMockContext();
        const next = vi.fn();

        const middleware = sentryBillingMiddleware();
        await middleware(ctx as never, next);

        expect(next).toHaveBeenCalled();
        expect(mockSentrySetTag).not.toHaveBeenCalled();
    });

    it('should set module tag to billing', async () => {
        const { sentryBillingMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({ path: '/api/v1/protected/billing/plans' });
        const next = vi.fn();

        const middleware = sentryBillingMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetTag).toHaveBeenCalledWith('module', 'billing');
    });

    it('should tag subscription operations', async () => {
        const { sentryBillingMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({ path: '/api/v1/protected/billing/subscriptions/123' });
        const next = vi.fn();

        const middleware = sentryBillingMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetTag).toHaveBeenCalledWith('billing_operation', 'subscription');
    });

    it('should tag payment operations', async () => {
        const { sentryBillingMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({ path: '/api/v1/protected/billing/payments' });
        const next = vi.fn();

        const middleware = sentryBillingMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetTag).toHaveBeenCalledWith('billing_operation', 'payment');
    });

    it('should tag addon operations', async () => {
        const { sentryBillingMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({ path: '/api/v1/protected/billing/addons' });
        const next = vi.fn();

        const middleware = sentryBillingMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetTag).toHaveBeenCalledWith('billing_operation', 'addon');
    });

    it('should tag promo code operations', async () => {
        const { sentryBillingMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({ path: '/api/v1/protected/billing/promo-codes' });
        const next = vi.fn();

        const middleware = sentryBillingMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetTag).toHaveBeenCalledWith('billing_operation', 'promo_code');
    });

    it('should tag trial operations', async () => {
        const { sentryBillingMiddleware } = await import('../../src/middlewares/sentry');
        mockSentryIsEnabled.mockReturnValue(true);
        const ctx = createMockContext({ path: '/api/v1/protected/billing/trial' });
        const next = vi.fn();

        const middleware = sentryBillingMiddleware();
        await middleware(ctx as never, next);

        expect(mockSentrySetTag).toHaveBeenCalledWith('billing_operation', 'trial');
    });
});

describe('requireBilling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should return 503 when billing is not enabled', async () => {
        const { requireBilling } = await import('../../src/middlewares/billing');
        const ctx = createMockContext({ store: { billingEnabled: false } });
        const next = vi.fn();

        await requireBilling(ctx as never, next);

        expect(next).not.toHaveBeenCalled();
        expect((ctx as Record<string, unknown>).json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'SERVICE_UNAVAILABLE'
                })
            }),
            503
        );
    });

    it('should call next when billing is enabled', async () => {
        const { requireBilling } = await import('../../src/middlewares/billing');
        const ctx = createMockContext({ store: { billingEnabled: true } });
        const next = vi.fn();

        await requireBilling(ctx as never, next);

        expect(next).toHaveBeenCalled();
    });
});

describe('billingMiddleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('should set billingEnabled false when env vars are missing', async () => {
        // No MERCADO_PAGO_ACCESS_TOKEN or HOSPEDA_DATABASE_URL
        const originalEnv = { ...process.env };
        process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = undefined;
        process.env.HOSPEDA_DATABASE_URL = undefined;

        const { billingMiddleware } = await import('../../src/middlewares/billing');
        const store: Record<string, unknown> = {};
        const ctx = createMockContext({ store });
        const next = vi.fn();

        await billingMiddleware(ctx as never, next);

        expect(store.billingEnabled).toBe(false);
        expect(next).toHaveBeenCalled();

        process.env = originalEnv;
    });

    it('should log warning when billing env vars are missing', async () => {
        const originalEnv = { ...process.env };
        process.env.HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN = undefined;
        process.env.HOSPEDA_DATABASE_URL = undefined;

        const { billingMiddleware } = await import('../../src/middlewares/billing');
        const ctx = createMockContext();
        const next = vi.fn();

        await billingMiddleware(ctx as never, next);

        expect(mockLoggerWarn).toHaveBeenCalledWith(
            expect.stringContaining('Missing environment variables')
        );

        process.env = originalEnv;
    });
});
