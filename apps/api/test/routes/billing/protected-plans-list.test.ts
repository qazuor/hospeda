/**
 * Unit tests for the custom `GET /plans` override (billing-interval-override
 * tooling) — `handleProtectedPlansList` / `isTestPlan` in
 * `apps/api/src/routes/billing/protected-plans-list.ts`.
 *
 * Covers:
 * - Excludes any plan with `metadata.testPlan === true` from the default
 *   (paginated) branch.
 * - Excludes it from the `?active=true` branch too.
 * - HOS-1062 F1: excludes a plan marked `metadata.publicListing = 'unlisted'`
 *   from BOTH branches. This endpoint answers any authenticated user with full
 *   prices, so a negotiated plan reaching it publishes that agreement — the same
 *   damage the public endpoint's filter exists to prevent, one tier down.
 * - HOS-1062 F1: `pagination.total`/`hasMore` count only what the response
 *   carries. They used to be qzpay's pre-filter numbers, which would announce
 *   the existence of plans the array deliberately withholds.
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
    isPubliclyListedStoragePlan,
    isTestPlan,
    servablePlans
} from '../../../src/routes/billing/protected-plans-list';
import { apiLogger } from '../../../src/utils/logger';

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
 * A negotiated plan: ACTIVE and charging, withheld from every catalogue.
 * `isActive` is deliberately absent from these raw storage fixtures — this
 * endpoint never filtered on it, which is precisely why the mark has to.
 */
const UNLISTED_PLAN = {
    id: 'plan-municipalidad',
    name: 'partner-municipalidad-cdu',
    metadata: { publicListing: 'unlisted' }
};

/** A plan whose mark is present but unreadable — withheld, never published. */
const UNREADABLE_MARK_PLAN = {
    id: 'plan-typo',
    name: 'partner-typo',
    metadata: { publicListing: 'unlited' }
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

describe('isPubliclyListedStoragePlan (HOS-1062 F1)', () => {
    it('serves an unmarked plan', () => {
        // Every plan in production is this case.
        expect(isPubliclyListedStoragePlan(REAL_PLAN)).toBe(true);
    });

    it('withholds a plan marked unlisted', () => {
        expect(isPubliclyListedStoragePlan(UNLISTED_PLAN)).toBe(false);
    });

    it('withholds a plan whose mark is present but unreadable', () => {
        expect(isPubliclyListedStoragePlan(UNREADABLE_MARK_PLAN)).toBe(false);
    });
});

describe('servablePlans (HOS-1062 F1)', () => {
    it('withholds both marks at once, and keeps catalogue order', () => {
        // One function for both branches: `?active=true` and the paginated
        // default cannot diverge in what they withhold.
        const other = { id: 'plan-2', name: 'owner-basico', metadata: {} };

        expect(servablePlans([REAL_PLAN, TEST_PLAN, UNLISTED_PLAN, other])).toEqual([
            REAL_PLAN,
            other
        ]);
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

            // ONE query, as before HOS-1062 — the catalogue fits in a single
            // 100-row page. What changed is that the window is applied to the
            // servable list here rather than delegated to qzpay, so `total`
            // counts what the response carries (1) instead of what the table
            // holds (2).
            expect(list).toHaveBeenCalledOnce();
            expect(list).toHaveBeenCalledWith({ limit: 100, offset: 0 });
            expect(ctx.json).toHaveBeenCalledWith({
                success: true,
                data: [REAL_PLAN],
                pagination: { limit: 20, offset: 0, hasMore: false, total: 1 }
            });
            const [body] = ctx.json.mock.calls[0] as [{ data: Array<{ name: string }> }];
            expect(body.data.map((p) => p.name)).not.toContain('owner-test-daily');
        });

        it('withholds an unlisted plan and does not count it in the total', async () => {
            // Both halves matter. The array must not carry the negotiated plan,
            // and `total` must not announce that one exists: a client that reads
            // `total: 2` against one row has been told there is a plan it is not
            // allowed to see.
            const list = vi.fn().mockResolvedValue({
                data: [REAL_PLAN, UNLISTED_PLAN],
                total: 2,
                hasMore: false
            });
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list, getActive: vi.fn() }
            });
            const ctx = createMockContext();

            await handleProtectedPlansList(ctx as never);

            expect(ctx.json).toHaveBeenCalledWith({
                success: true,
                data: [REAL_PLAN],
                pagination: { limit: 20, offset: 0, hasMore: false, total: 1 }
            });
        });

        it('leaks no field of an unlisted plan, not just no whole row', async () => {
            const list = vi.fn().mockResolvedValue({
                data: [REAL_PLAN, UNLISTED_PLAN, UNREADABLE_MARK_PLAN],
                total: 3,
                hasMore: false
            });
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list, getActive: vi.fn() }
            });
            const ctx = createMockContext();

            await handleProtectedPlansList(ctx as never);

            const [body] = ctx.json.mock.calls[0] as [unknown];
            const serialised = JSON.stringify(body);
            expect(serialised).not.toContain('partner-municipalidad-cdu');
            expect(serialised).not.toContain('partner-typo');
        });

        it('applies limit/offset to the servable list, not to the raw catalogue', async () => {
            // Before HOS-1062 these params were forwarded to qzpay verbatim. They
            // now page the filtered list, which is the only way `hasMore` can be
            // true exactly when there is another SERVABLE row to fetch.
            const catalogue = [
                { id: 'p1', name: 'plan-1', metadata: {} },
                UNLISTED_PLAN,
                { id: 'p2', name: 'plan-2', metadata: {} },
                { id: 'p3', name: 'plan-3', metadata: {} }
            ];
            const list = vi.fn().mockResolvedValue({
                data: catalogue,
                total: catalogue.length,
                hasMore: false
            });
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list, getActive: vi.fn() }
            });
            const ctx = createMockContext({ limit: '1', offset: '1' });

            await handleProtectedPlansList(ctx as never);

            expect(ctx.json).toHaveBeenCalledWith({
                success: true,
                data: [catalogue[2]],
                pagination: { limit: 1, offset: 1, hasMore: true, total: 3 }
            });
        });

        it('announces a catalogue qzpay under-delivered against its own total', async () => {
            // qzpay's `total` is handed to the walk so `hasMore: false` becomes a
            // claim that gets CHECKED. Without that wiring a short catalogue is
            // served as a complete one, with correct-looking pagination on top.
            const list = vi.fn().mockResolvedValue({ data: [REAL_PLAN], total: 4, hasMore: false });
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list, getActive: vi.fn() }
            });
            const ctx = createMockContext();

            await handleProtectedPlansList(ctx as never);

            expect(apiLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ fetched: 1, expected: 4 }),
                expect.stringContaining('truncated')
            );
        });

        it('walks every catalogue page before filtering', async () => {
            // A catalogue larger than one qzpay page must not answer from its
            // first 100 rows: `total` would undercount and the last page would
            // come back empty. One query today, N only when the table grows.
            const firstPage = { id: 'p1', name: 'plan-1', metadata: {} };
            const secondPage = { id: 'p2', name: 'plan-2', metadata: {} };
            const list = vi
                .fn()
                .mockResolvedValueOnce({
                    data: [firstPage, UNLISTED_PLAN],
                    total: 3,
                    hasMore: true
                })
                .mockResolvedValueOnce({ data: [secondPage], total: 3, hasMore: false });
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list, getActive: vi.fn() }
            });
            const ctx = createMockContext();

            await handleProtectedPlansList(ctx as never);

            expect(list).toHaveBeenNthCalledWith(1, { limit: 100, offset: 0 });
            expect(list).toHaveBeenNthCalledWith(2, { limit: 100, offset: 100 });
            expect(ctx.json).toHaveBeenCalledWith({
                success: true,
                data: [firstPage, secondPage],
                pagination: { limit: 20, offset: 0, hasMore: false, total: 2 }
            });
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

        it('withholds an unlisted plan from the branch a consumer reaches for by default', async () => {
            // `?active=true` is the branch with no pagination envelope and the
            // one most callers use, so an unlisted plan escaping HERE is the
            // likeliest leak of the two.
            const getActive = vi
                .fn()
                .mockResolvedValue([REAL_PLAN, UNLISTED_PLAN, UNREADABLE_MARK_PLAN]);
            (getQZPayBilling as ReturnType<typeof vi.fn>).mockReturnValue({
                plans: { list: vi.fn(), getActive }
            });
            const ctx = createMockContext({ active: 'true' });

            await handleProtectedPlansList(ctx as never);

            expect(ctx.json).toHaveBeenCalledWith({
                success: true,
                data: [REAL_PLAN]
            });
        });
    });
});
