/**
 * Unit tests for the custom `GET /plans` override (billing-interval-override
 * tooling) — `handleProtectedPlansList` / `isTestPlan` in
 * `apps/api/src/routes/billing/protected-plans-list.ts`.
 *
 * Covers:
 * - Excludes any plan with `metadata.testPlan === true` from the default
 *   (paginated) branch.
 * - Excludes it from the `?active=true` branch too.
 * - Response shape matches qzpay-hono's `GET /plans` byte-for-byte
 *   (`{ success, data, pagination }` / `{ success, data }`).
 * - 503 when billing is not configured.
 *
 * @module test/routes/billing/protected-plans-list
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(),
    requireBilling: vi.fn()
}));

vi.mock('../../../src/middlewares/billing-auth.middleware', () => ({
    billingAuthMiddleware: vi.fn(async (_c: unknown, next: () => Promise<void>) => {
        await next();
    })
}));

// `protected-plans-list.ts` calls `createRouter()` at module top level to
// build `protectedPlansListRouter`. The REAL `createRouter` module
// (`utils/create-app.ts`) has its own module-level side effect
// (`const app = createApp()`) that requires the full middleware chain
// (billingMiddleware, entitlementMiddleware, etc.) to be resolvable — mock
// it away entirely, mirroring the pattern in
// `test/routes/subscription-pause.test.ts`.
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

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { getQZPayBilling } from '../../../src/middlewares/billing';
import {
    handleProtectedPlansList,
    isTestPlan
} from '../../../src/routes/billing/protected-plans-list';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REAL_PLAN = {
    id: 'plan-real',
    name: 'owner-premium',
    metadata: {}
};

const TEST_PLAN = {
    id: 'plan-test-daily',
    name: 'owner-test-daily',
    metadata: { testPlan: true }
};

/**
 * Minimal fake Hono `Context` — only what `handleProtectedPlansList` touches:
 * `req.query(key)` and `json(body, status?)`.
 */
function createMockContext(query: Record<string, string> = {}) {
    return {
        req: {
            query: (key: string) => query[key]
        },
        json: vi.fn((body: unknown, status?: number) => ({ body, status: status ?? 200 }))
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isTestPlan', () => {
    it('returns true when metadata.testPlan === true', () => {
        expect(isTestPlan(TEST_PLAN)).toBe(true);
    });

    it('returns false for a plan with no testPlan marker', () => {
        expect(isTestPlan(REAL_PLAN)).toBe(false);
    });

    it('returns false when metadata is missing entirely', () => {
        expect(isTestPlan({})).toBe(false);
    });
});

describe('handleProtectedPlansList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 503 when billing is not configured', async () => {
        (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue(null);
        const ctx = createMockContext();

        await handleProtectedPlansList(ctx as never);

        expect(ctx.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' })
            }),
            503
        );
    });

    describe('default (paginated) branch', () => {
        it('excludes owner-test-daily and matches the qzpay-hono response shape', async () => {
            const list = vi.fn().mockResolvedValue({
                data: [REAL_PLAN, TEST_PLAN],
                total: 2,
                hasMore: false
            });
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list, getActive: vi.fn() }
            });
            const ctx = createMockContext();

            await handleProtectedPlansList(ctx as never);

            // Default limit matches qzpay-hono's PaginationSchema default (20), not 50.
            expect(list).toHaveBeenCalledWith({ limit: 20, offset: 0 });
            expect(ctx.json).toHaveBeenCalledWith({
                success: true,
                data: [REAL_PLAN],
                pagination: { limit: 20, offset: 0, hasMore: false, total: 2 }
            });
            const [body] = ctx.json.mock.calls[0] as [{ data: Array<{ name: string }> }];
            expect(body.data.map((p) => p.name)).not.toContain('owner-test-daily');
        });

        it('forwards limit/offset query params to plans.list', async () => {
            const list = vi.fn().mockResolvedValue({ data: [], total: 0, hasMore: false });
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list, getActive: vi.fn() }
            });
            const ctx = createMockContext({ limit: '10', offset: '20' });

            await handleProtectedPlansList(ctx as never);

            expect(list).toHaveBeenCalledWith({ limit: 10, offset: 20 });
        });
    });

    describe('?active=true branch', () => {
        it('excludes owner-test-daily and returns the no-pagination shape', async () => {
            const getActive = vi.fn().mockResolvedValue([REAL_PLAN, TEST_PLAN]);
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list: vi.fn(), getActive }
            });
            const ctx = createMockContext({ active: 'true' });

            await handleProtectedPlansList(ctx as never);

            expect(getActive).toHaveBeenCalledOnce();
            expect(ctx.json).toHaveBeenCalledWith({
                success: true,
                data: [REAL_PLAN]
            });
        });
    });
});
