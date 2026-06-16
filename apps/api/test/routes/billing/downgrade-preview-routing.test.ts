/**
 * Integration test for the billing route MOUNT ORDER regression (SPEC-203 T-011a).
 *
 * WHY this test exists (cannot be replaced by unit tests):
 * The existing `downgrade-preview.test.ts` mocks `createRouter`/`createCRUDRoute`
 * and invokes the handler directly, bypassing Hono's routing engine entirely.
 * That means it CANNOT detect a mount-order bug: if `downgradePreviewRouter` is
 * registered AFTER `qzpayWrapper` in `createBillingRoutesHandler()`, Hono's
 * first-match algorithm routes `GET /subscriptions/downgrade-preview` to qzpay's
 * `GET /subscriptions/:id` (with `:id = "downgrade-preview"`), which is wrapped
 * by `billingOwnershipMiddleware` and returns 403 to every authenticated owner.
 *
 * This test mounts the REAL `createBillingRoutesHandler()` (preserving its real
 * mount order) into a minimal app and fires an actual HTTP request through Hono,
 * so it catches the 403 regression the unit test cannot see.
 *
 * @module test/routes/billing/downgrade-preview-routing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE any imports to satisfy Vitest's hoisting.
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock @qazuor/qzpay-hono to return a minimal Hono router that simulates
// qzpay's prebuilt `GET /subscriptions/:id`. This is the route that would
// WRONGLY capture `/subscriptions/downgrade-preview` if mount order regresses.
vi.mock('@qazuor/qzpay-hono', async () => {
    const { Hono } = await import('hono');
    return {
        createBillingRoutes: vi.fn(() => {
            const router = new Hono();
            // Simulate qzpay's prebuilt subscription lookup route.
            // If the mount order is wrong, this route matches first and
            // billingOwnershipMiddleware returns 403 — caught by our assertion.
            router.get('/subscriptions/:id', (c) =>
                c.json({ route: 'qzpay-get-subscription', id: c.req.param('id') })
            );
            return router;
        })
    };
});

// Mock billing middleware: getQZPayBilling returns a truthy object so
// createQZPayBillingRouter actually calls createBillingRoutes (instead of
// returning an empty router). requireBilling passes through unconditionally.
vi.mock('../../../src/middlewares/billing', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getQZPayBilling: vi.fn(() => ({})), // truthy → createBillingRoutes is called
        requireBilling: async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

// billingOwnershipMiddleware is the middleware that produces the 403 when the
// mount order is wrong. We wire it to ALWAYS return 403 so that ANY request
// reaching the qzpayWrapper is blocked — reproducing the exact bug symptom.
// The downgrade-preview route must be mounted BEFORE the wrapper to avoid this.
vi.mock('../../../src/middlewares/billing-ownership.middleware', () => ({
    billingOwnershipMiddleware:
        () => async (c: { json: (body: unknown, status: number) => unknown }) =>
            c.json({ success: false, error: { code: 'FORBIDDEN' } }, 403)
}));

// All other billing guard middlewares are pass-throughs to isolate the
// mount-order behaviour from unrelated permission/sentry/grace logic.
vi.mock('../../../src/middlewares/billing-admin-guard.middleware', () => ({
    billingAdminGuardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/billing-perm.middleware', () => ({
    billingPermMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

vi.mock('../../../src/middlewares/past-due-grace.middleware', () => ({
    pastDueGraceMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

// Preserve all other sentry exports; override only sentryBillingMiddleware.
vi.mock('../../../src/middlewares/sentry', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        sentryBillingMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

// computeDowngradeExcess returns a fixed minimal DowngradePreview so the
// handler can complete without DB or billing-catalog access.
vi.mock('../../../src/services/subscription-downgrade-excess.service', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        computeDowngradeExcess: vi.fn().mockResolvedValue({
            accommodations: { cap: 5, activeCount: 2, excessCount: 0, items: [] },
            promotions: { cap: 3, activeCount: 1, excessCount: 0, items: [] },
            photos: [],
            grandfatherFlags: [],
            hasExcess: false
        }),
        defaultExcessDeps: {}
    };
});

// Provide a deterministic authenticated owner actor so getActorFromContext
// succeeds without a real session or DB lookup.
vi.mock('../../../src/middlewares/actor', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getActorFromContext: () => ({
            id: '00000000-0000-4000-8000-000000000099',
            role: 'HOST',
            permissions: [],
            email: 'host@test.com',
            name: 'Test Host'
        })
    };
});

// ---------------------------------------------------------------------------
// Imports — after mocks.
// ---------------------------------------------------------------------------

import { createBillingRoutesHandler } from '../../../src/routes/billing/index';
import { createRouter } from '../../../src/utils/create-app';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

process.env.NODE_ENV = 'test';

const TARGET_PLAN = 'owner-basico';
const PREVIEW_URL = `/api/v1/protected/billing/subscriptions/downgrade-preview?targetPlan=${TARGET_PLAN}`;

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('Billing route mount order — downgrade-preview routing regression (SPEC-203 T-011a)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /subscriptions/downgrade-preview', () => {
        it('returns 200 with the preview payload — NOT 403 from qzpay ownership guard', async () => {
            // Arrange: mount the REAL billing handler (real mount order) on a minimal app.
            const app = createRouter();
            app.route('/api/v1/protected/billing', createBillingRoutesHandler());

            // Act.
            const res = await app.request(PREVIEW_URL);
            const body = (await res.json()) as Record<string, unknown>;

            // Assert — primary regression guard.
            // If downgradePreviewRouter were mounted AFTER qzpayWrapper, the
            // ownership middleware mock above would have returned 403 here.
            expect(res.status).not.toBe(403);
            expect(res.status).toBe(200);

            // Assert — request reached the downgrade-preview handler, not qzpay's
            // GET /subscriptions/:id fallback (which returns `route: 'qzpay-get-subscription'`).
            expect(body).not.toHaveProperty('route', 'qzpay-get-subscription');

            // Assert — the preview fields the downgrade-preview handler returns
            // are present in the response (directly or wrapped by ResponseFactory).
            const data = (body.data ?? body) as Record<string, unknown>;
            expect(data).toHaveProperty('hasExcess', false);
            expect(data).toHaveProperty('accommodations');
            expect(data).toHaveProperty('promotions');
        });

        it('response body does not contain the qzpay route marker', async () => {
            // Redundant but explicit: guards against a future refactor that injects
            // a different status while still routing to the wrong handler.
            const app = createRouter();
            app.route('/api/v1/protected/billing', createBillingRoutesHandler());

            const res = await app.request(PREVIEW_URL);
            const body = (await res.json()) as Record<string, unknown>;

            expect(body).not.toHaveProperty('route');
            expect(JSON.stringify(body)).not.toContain('qzpay-get-subscription');
        });
    });
});
