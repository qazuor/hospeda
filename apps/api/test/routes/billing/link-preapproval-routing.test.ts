/**
 * Integration test for the billing route MOUNT ORDER regression (HOS-191 Path C).
 *
 * WHY this test exists (cannot be replaced by unit tests):
 * The existing `link-preapproval.test.ts` mocks `createRouter`/`createCRUDRoute`
 * and invokes `handleLinkPreapproval` directly, bypassing Hono's routing engine
 * AND the real `billingAdminGuardMiddleware` entirely. That means it CANNOT
 * detect a mount-order bug: if `linkPreapprovalRouter` is registered AFTER
 * `qzpayWrapper` in `createBillingRoutesHandler()`, the REAL
 * `billingAdminGuardMiddleware` (applied via `qzpayWrapper.use('*', ...)`) sees
 * `POST /subscriptions/link-preapproval`, matches its `subscriptions` +
 * `POST` admin-only rule (whose `allowedSubPaths` only lists `start-paid`,
 * `change-plan`, `cancel` — NOT `link-preapproval`), and rejects every
 * non-admin actor with 403 "Billing admin guard: non-admin user attempted
 * admin-only operation" BEFORE the request ever reaches qzpay's own
 * `POST /subscriptions/:id`-shaped route. This is exactly the prod bug a real
 * payment smoke found: authenticated USERs returning from MercadoPago's
 * checkout got 403 on this endpoint, so their paid subscription never linked
 * and stayed stuck in `pending_provider`.
 *
 * This test mounts the REAL `createBillingRoutesHandler()` (preserving its
 * real mount order) into a minimal app and fires an actual HTTP request
 * through Hono, using the REAL `billingAdminGuardMiddleware` (not mocked), so
 * it catches the 403 regression the unit test cannot see. All other
 * middlewares/dependencies are mocked as pass-throughs / stubs so the test
 * needs no real DB or MercadoPago access.
 *
 * @module test/routes/billing/link-preapproval-routing
 */

import type { RoleEnum } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
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

// Mock @qazuor/qzpay-hono to return a minimal Hono router that simulates the
// real qzpay-mercadopago >=2.6 (HOS-191 camino C) prebuilt `POST /subscriptions/:id`
// route. This is the route that WOULD wrongly capture
// `/subscriptions/link-preapproval` if this test's assertions ever passed for
// the wrong reason (e.g. a future admin-guard rule change that stops
// rejecting but still lets the request fall through to the wrong handler).
vi.mock('@qazuor/qzpay-hono', async () => {
    const { Hono } = await import('hono');
    return {
        createBillingRoutes: vi.fn(() => {
            const router = new Hono();
            router.post('/subscriptions/:id', (c) =>
                c.json({ route: 'qzpay-post-subscription', id: c.req.param('id') })
            );
            return router;
        })
    };
});

// Mock billing middleware module: getQZPayBilling returns a truthy stub so
// createQZPayBillingRouter actually calls createBillingRoutes (instead of
// returning an empty router), and so handleLinkPreapproval's own
// `getQZPayBilling()` call (same module) doesn't short-circuit with 503.
// requireBilling passes through unconditionally — the handler reads
// `billingEnabled` from context directly (set by the test's actor middleware
// below), so requireBilling's own context read is irrelevant here.
vi.mock('../../../src/middlewares/billing', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        getQZPayBilling: vi.fn(() => ({})),
        requireBilling: async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

// billingOwnershipMiddleware is not the focus of this test (it sits AFTER the
// admin guard inside qzpayWrapper and is only reached by actors the admin
// guard lets through). Pass it through so an admin actor's request can reach
// the mocked qzpay router without needing real DB-backed ownership checks.
vi.mock('../../../src/middlewares/billing-ownership.middleware', () => ({
    billingOwnershipMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
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

// `billingAdminGuardMiddleware` is deliberately NOT mocked — it is the exact
// mechanism under test. Real @repo/schemas PermissionEnum-based logic decides
// whether the actor set on context (below) is treated as admin.

// `handleLinkPreapproval`'s remaining dependencies: mocked defensively so the
// module import graph never touches a real DB / MercadoPago client. None of
// these are actually invoked in this test's scenarios because the handler
// throws its 400 "no billing account" guard before reaching them (see the
// `billingCustomerId: undefined` context fixture below).
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        createMercadoPagoAdapter: vi.fn()
    };
});

vi.mock('../../../src/lib/qzpay-logger', () => ({
    qzpayLogger: {}
}));

vi.mock('../../../src/services/billing/link-preapproval.service', () => ({
    linkPreapprovalToLocalSub: vi.fn()
}));

// ---------------------------------------------------------------------------
// Imports — after mocks.
// ---------------------------------------------------------------------------

import { createBillingRoutesHandler } from '../../../src/routes/billing/index';
import { createRouter } from '../../../src/utils/create-app';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

process.env.NODE_ENV = 'test';

const LINK_PREAPPROVAL_URL = '/api/v1/protected/billing/subscriptions/link-preapproval';

const VALID_BODY = {
    preapprovalId: 'pa-1',
    localSubscriptionId: '00000000-0000-4000-8000-000000000001'
};

/** Regular authenticated USER actor — no admin permission. */
const NON_ADMIN_ACTOR: Actor = {
    id: '00000000-0000-4000-8000-000000000099',
    role: 'USER' as RoleEnum,
    permissions: [],
    email: 'user@test.com',
    name: 'Test User'
};

/** Admin actor — carries ACCESS_API_ADMIN, the only permission the guard checks. */
const ADMIN_ACTOR: Actor = {
    id: '00000000-0000-4000-8000-000000000001',
    role: 'ADMIN' as RoleEnum,
    permissions: [PermissionEnum.ACCESS_API_ADMIN],
    email: 'admin@test.com',
    name: 'Test Admin'
};

/**
 * Mounts the real billing router behind a minimal middleware that seeds the
 * context variables `billingAdminGuardMiddleware` and `handleLinkPreapproval`
 * read directly (`actor`, `billingEnabled`, `billingCustomerId`). This stands
 * in for the real app's actor/billing-context middlewares, which run upstream
 * of `createBillingRoutesHandler()` in production but are out of scope here.
 *
 * `billingCustomerId` is deliberately left unset so any actor that passes the
 * admin guard reaches `handleLinkPreapproval`'s own 400 "no billing account
 * found" guard — a benign, deterministic outcome that still proves the
 * request was never rejected by the admin guard.
 */
function buildTestApp(actor: Actor) {
    const app = createRouter();
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        c.set('billingEnabled', true);
        c.set('billingCustomerId', undefined);
        await next();
    });
    app.route('/api/v1/protected/billing', createBillingRoutesHandler());
    return app;
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('Billing route mount order — link-preapproval routing regression (HOS-191)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /subscriptions/link-preapproval', () => {
        it('does not reject a non-admin USER with the billing admin guard 403', async () => {
            // Arrange: mount the REAL billing handler (real mount order) for a
            // regular authenticated USER — no ACCESS_API_ADMIN permission.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(LINK_PREAPPROVAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(VALID_BODY)
            });
            const body = (await res.json()) as Record<string, unknown>;

            // Assert — primary regression guard. If linkPreapprovalRouter were
            // mounted AFTER qzpayWrapper, the REAL billingAdminGuardMiddleware
            // would reject this non-admin actor with 403 here.
            expect(res.status).not.toBe(403);
            expect(body.error).not.toBe('FORBIDDEN');
            expect(JSON.stringify(body)).not.toContain('administrator privileges');

            // Assert — the request reached handleLinkPreapproval (not qzpay's
            // POST /subscriptions/:id fallback), proven by its deterministic
            // 400 "no billing account" outcome (billingCustomerId is unset).
            expect(res.status).toBe(400);
            expect(body).not.toHaveProperty('route', 'qzpay-post-subscription');
            const error = body.error as Record<string, unknown> | undefined;
            expect(error?.message).toBe('No billing account found');
        });

        it('also lets an ADMIN actor reach the handler (symmetry check)', async () => {
            // Arrange.
            const app = buildTestApp(ADMIN_ACTOR);

            // Act.
            const res = await app.request(LINK_PREAPPROVAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(VALID_BODY)
            });
            const body = (await res.json()) as Record<string, unknown>;

            // Assert — same deterministic 400, proving the admin actor also
            // reaches handleLinkPreapproval rather than being routed elsewhere.
            expect(res.status).not.toBe(403);
            expect(res.status).toBe(400);
            const error = body.error as Record<string, unknown> | undefined;
            expect(error?.message).toBe('No billing account found');
        });
    });
});
