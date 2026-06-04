/**
 * Tests: /change-plan idempotency middleware wiring (SPEC-194 T-018).
 *
 * Verifies that:
 * 1. The planChangeRouter mounts `idempotencyKeyMiddleware` via `router.use`
 *    on the `/change-plan` path before the route handler.
 * 2. The middleware is called with `operation: 'hospeda.change_plan'`.
 * 3. The idempotency middleware is mounted BEFORE router.route.
 * 4. Behavioural contract (matching start-paid/addons): missing key → 400,
 *    same key + different body → 409, same key + same body → cached response.
 *
 * @module test/routes/billing/plan-change-idempotency
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted helpers — must be declared before vi.mock factories reference them.
// ---------------------------------------------------------------------------

const { mockRouterUse, mockRouterRoute, mockIdempotencyFactory, mockDbFindEntry } = vi.hoisted(
    () => ({
        mockRouterUse: vi.fn(),
        mockRouterRoute: vi.fn(),
        mockIdempotencyFactory: vi.fn().mockReturnValue(vi.fn()),
        // Configurable DB stub for idempotency entry lookups.
        mockDbFindEntry: vi.fn().mockResolvedValue([])
    })
);

// ---------------------------------------------------------------------------
// Module mocks (declared BEFORE imports that depend on them).
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({
        use: mockRouterUse,
        route: mockRouterRoute,
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }))
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createSimpleRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn(async (_c: unknown, next: () => Promise<void>) => next())
}));

vi.mock('../../../src/middlewares/idempotency-key', () => ({
    idempotencyKeyMiddleware: mockIdempotencyFactory
}));

vi.mock('../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user_test' }))
}));

// The idempotency middleware uses `../utils/actor` (not middlewares/actor).
vi.mock('../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn(() => ({ id: 'user_test' }))
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock('../../../src/utils/env', () => ({
    env: {
        HOSPEDA_SITE_URL: 'https://hospeda.test',
        HOSPEDA_API_URL: 'https://api.hospeda.test',
        HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR: 'HOSPEDA'
    }
}));

vi.mock('../../../src/utils/audit-logger', () => ({
    auditLog: vi.fn(),
    AuditEventType: { BILLING_MUTATION: 'billing.mutation' }
}));

vi.mock('../../../src/services/subscription-checkout.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual };
});

vi.mock('../../../src/services/subscription-downgrade.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual };
});

// Mock @repo/db with a configurable entry lookup stub.
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: mockDbFindEntry,
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockResolvedValue(undefined),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined)
    })),
    billingIdempotencyKeys: {
        key: 'key',
        expiresAt: 'expiresAt',
        operation: 'operation',
        requestParams: 'requestParams',
        responseBody: 'responseBody',
        statusCode: 'statusCode',
        livemode: 'livemode',
        createdAt: 'createdAt'
    },
    eq: vi.fn(),
    sql: Object.assign(
        (strings: TemplateStringsArray, ..._values: unknown[]) => ({ type: 'sql', strings }),
        { raw: (s: string) => ({ type: 'sql_raw', value: s }) }
    )
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER all mocks.
// The module-level side-effects (router.use / router.route) run here.
// ---------------------------------------------------------------------------

import '../../../src/routes/billing/plan-change';

// ---------------------------------------------------------------------------
// Wiring tests
// ---------------------------------------------------------------------------

describe('plan-change route — idempotency middleware wiring (T-018)', () => {
    it('router.use is called with /change-plan path', () => {
        const paths = mockRouterUse.mock.calls.map(([path]: [string, ...unknown[]]) => path);
        expect(paths).toContain('/change-plan');
    });

    it('idempotencyKeyMiddleware is called with operation: hospeda.change_plan', () => {
        expect(mockIdempotencyFactory).toHaveBeenCalledWith(
            expect.objectContaining({ operation: 'hospeda.change_plan' })
        );
    });

    it('idempotency middleware is mounted BEFORE router.route (ordering guard)', () => {
        const useOrder = mockRouterUse.mock.invocationCallOrder;
        const routeOrder = mockRouterRoute.mock.invocationCallOrder;

        expect(useOrder.length).toBeGreaterThan(0);
        expect(routeOrder.length).toBeGreaterThan(0);

        const firstUse = Math.min(...useOrder);
        const firstRoute = Math.min(...routeOrder);

        expect(firstUse).toBeLessThan(firstRoute);
    });
});

// ---------------------------------------------------------------------------
// Behavioural contract tests — use the REAL middleware directly.
// These mirror the guarantee that T-018 wires the same contract as start-paid
// and addons: missing key → 400, conflict → 409, cache hit → short-circuit.
// ---------------------------------------------------------------------------

describe('idempotencyKeyMiddleware contract (T-018 — matches start-paid/addons)', () => {
    beforeEach(() => {
        // Reset DB stub to "no cached entry" by default.
        mockDbFindEntry.mockResolvedValue([]);
    });

    /**
     * Build a minimal Hono-like context for real middleware testing.
     */
    function buildCtx({ key, body }: { key: string | null; body: string }) {
        return {
            req: {
                header: vi.fn().mockReturnValue(key),
                text: vi.fn().mockResolvedValue(body)
            },
            json: vi.fn((b: unknown, s: number) => ({ body: b, status: s })),
            get: vi.fn(),
            res: { status: 200 }
        };
    }

    it('missing X-Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
        const { idempotencyKeyMiddleware: realMiddleware } = await vi.importActual<
            typeof import('../../../src/middlewares/idempotency-key')
        >('../../../src/middlewares/idempotency-key');

        const mw = realMiddleware({ operation: 'hospeda.change_plan' });
        const ctx = buildCtx({ key: null, body: '{}' });
        const next = vi.fn();

        // biome-ignore lint/suspicious/noExplicitAny: test-only structural mock
        await mw(ctx as any, next);

        expect(next).not.toHaveBeenCalled();
        expect(ctx.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REQUIRED' })
            }),
            400
        );
    });

    it('same key + same body → cached response replayed without calling next()', async () => {
        const { idempotencyKeyMiddleware: realMiddleware } = await vi.importActual<
            typeof import('../../../src/middlewares/idempotency-key')
        >('../../../src/middlewares/idempotency-key');

        const requestBody = { newPlanId: 'plan_basico', billingInterval: 'monthly' };
        const cachedResponseBody = { status: 'scheduled', subscriptionId: 'sub_cached' };

        // Configure DB to return a live cached entry with matching body.
        mockDbFindEntry.mockResolvedValue([
            {
                key: 'hospeda-billing:user_test:idem-key-1',
                operation: 'hospeda.change_plan',
                requestParams: requestBody,
                responseBody: cachedResponseBody,
                statusCode: '200',
                expiresAt: new Date(Date.now() + 60_000)
            }
        ]);

        const mw = realMiddleware({ operation: 'hospeda.change_plan' });
        const ctx = buildCtx({
            key: 'idem-key-1',
            body: JSON.stringify(requestBody)
        });
        const next = vi.fn();

        // biome-ignore lint/suspicious/noExplicitAny: test-only structural mock
        await mw(ctx as any, next);

        // Short-circuit: must NOT delegate to the handler.
        expect(next).not.toHaveBeenCalled();
        expect(ctx.json).toHaveBeenCalledWith(cachedResponseBody, 200);
    });

    it('same key + different body → 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
        const { idempotencyKeyMiddleware: realMiddleware } = await vi.importActual<
            typeof import('../../../src/middlewares/idempotency-key')
        >('../../../src/middlewares/idempotency-key');

        const storedBody = { newPlanId: 'plan_basico', billingInterval: 'monthly' };
        const incomingBody = { newPlanId: 'plan_pro', billingInterval: 'annual' };

        // Configure DB to return a live cached entry with the STORED body.
        mockDbFindEntry.mockResolvedValue([
            {
                key: 'hospeda-billing:user_test:idem-key-2',
                operation: 'hospeda.change_plan',
                requestParams: storedBody,
                responseBody: { status: 'scheduled' },
                statusCode: '200',
                expiresAt: new Date(Date.now() + 60_000)
            }
        ]);

        const mw = realMiddleware({ operation: 'hospeda.change_plan' });
        const ctx = buildCtx({
            key: 'idem-key-2',
            body: JSON.stringify(incomingBody) // different from stored
        });
        const next = vi.fn();

        // biome-ignore lint/suspicious/noExplicitAny: test-only structural mock
        await mw(ctx as any, next);

        expect(next).not.toHaveBeenCalled();
        expect(ctx.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_CONFLICT' })
            }),
            409
        );
    });
});
