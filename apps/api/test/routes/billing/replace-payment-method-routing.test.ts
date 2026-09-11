/**
 * Integration test for the billing route MOUNT ORDER regression (HOS-1244).
 *
 * WHY this test exists (cannot be replaced by unit tests):
 * `replace-payment-method.test.ts` invokes `handleReplacePaymentMethod`
 * directly with a mocked context, bypassing Hono's routing engine AND the
 * real middleware stack. It CANNOT see what staging measured on 2026-09-08:
 * a past-due customer (plain USER role) pressing «Actualizar medio de pago»
 * got `403 — Billing admin guard: non-admin user attempted admin-only
 * operation` and never reached the handler.
 *
 * The mechanism: `cancelWrapper` and `qzpayWrapper` inside
 * `createBillingRoutesHandler()` apply `billingAdminGuardMiddleware` via
 * `.use('*')`, which Hono composes for ANY request matching the mount
 * prefix — whether or not that sub-app owns the exact path (this is the
 * same trap HOS-191 hit with link-preapproval, see
 * `link-preapproval-routing.test.ts`). The guard's `allowedSubPaths` for the
 * `subscriptions` segment lists `start-paid`, `change-plan`, `cancel`,
 * `uncancel` — NOT `replace-payment-method` — so while
 * `replacePaymentMethodRouter` sat BELOW those wrappers, every non-admin
 * POST was rejected before the handler ran.
 *
 * `allowedSubPaths` is deliberately NOT the fix: past the guard, the
 * request would next hit `qzpayWrapper`'s `billingOwnershipMiddleware`,
 * which answers 403 for a foreign row — while this route's documented
 * contract (handler docblock, unit test, and the endpoint gate matrix) is
 * 404 for a foreign id, never 403, because a 403 confirms the id exists.
 * The handler enforces ownership itself (`row.customerId !==
 * billingCustomerId` → 404), so the router is mounted BEFORE both wrappers,
 * ahead of any guard/ownership composition — same remedy as
 * link-preapproval.
 *
 * This test mounts the REAL `createBillingRoutesHandler()` (preserving its
 * real mount order) into a minimal app and fires actual HTTP requests
 * through Hono, keeping BOTH `billingAdminGuardMiddleware` and
 * `billingOwnershipMiddleware` real (not mocked) so the three mount
 * configurations are distinguishable by status + message:
 *
 *   - router below the wrappers (the bug)      → 403 "administrator privileges"
 *   - allowedSubPaths-only fix (wrong remedy)  → 403 "You do not have access
 *     to this billing resource" from the ownership middleware
 *   - router above the wrappers (the fix)      → the handler's own 404
 *     "Subscription not found" (the global `@repo/db` mock resolves every
 *     row lookup to `[]`)
 *
 * Everything else is mocked as pass-through / stubs so the test needs no
 * real DB or MercadoPago access.
 *
 * @module test/routes/billing/replace-payment-method-routing
 */

import { getDb } from '@repo/db';
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

// Mock @qazuor/qzpay-hono to return a minimal Hono router that simulates
// qzpay's prebuilt `POST /subscriptions/:id` route. This is the route that
// WOULD wrongly capture `/subscriptions/:localId/replace-payment-method` if
// this test's assertions ever passed for the wrong reason (e.g. the custom
// router silently dropped its handler and the request fell through).
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
// returning an empty router), and so handleReplacePaymentMethod's own
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

// The idempotency middleware is part of the replace-payment-method router
// itself (not the wrappers under test) and has its own coverage; pass it
// through so no `X-Idempotency-Key` header or `billing_idempotency_keys`
// lookup is needed here.
vi.mock('../../../src/middlewares/idempotency-key', () => ({
    idempotencyKeyMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

// `billingAdminGuardMiddleware` and `billingOwnershipMiddleware` are
// deliberately NOT mocked — they are the exact mechanisms under test. The
// real @repo/schemas PermissionEnum-based guard decides whether the actor
// set on context (below) is treated as admin, and the real ownership
// middleware is what would answer 403 for a foreign row if the router ever
// sat behind qzpayWrapper again.

// `handleReplacePaymentMethod`'s remaining dependencies: mocked defensively
// so the module import graph never touches a real DB / MercadoPago client.
// None of these are actually invoked in this test's scenarios: the handler
// throws its 404 "Subscription not found" guard (the global `@repo/db` mock
// resolves the row lookup to `[]`) before reaching the service.
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

const mockReplacePastDuePaymentMethod = vi.fn();
vi.mock('../../../src/services/billing/past-due-payment-method-replacement.service', () => ({
    replacePastDuePaymentMethod: (...args: unknown[]) => mockReplacePastDuePaymentMethod(...args)
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

const LOCAL_SUB_ID = '11111111-1111-4111-8111-111111111111';
const REPLACE_PAYMENT_METHOD_URL = `/api/v1/protected/billing/subscriptions/${LOCAL_SUB_ID}/replace-payment-method`;
const CHECKOUT_RETRY_URL = `/api/v1/protected/billing/subscriptions/${LOCAL_SUB_ID}/checkout-retry`;

const OWNER_CUSTOMER_ID = 'cust-owner';
const OTHER_CUSTOMER_ID = 'cust-intruder';

/** Regular authenticated USER actor — no admin permission. */
const NON_ADMIN_ACTOR: Actor = {
    id: '00000000-0000-4000-8000-000000000099',
    roles: ['USER' as RoleEnum],
    permissions: [],
    email: 'user@test.com',
    name: 'Test User'
};

/** Admin actor — carries ACCESS_API_ADMIN, the only permission the guard checks. */
const ADMIN_ACTOR: Actor = {
    id: '00000000-0000-4000-8000-000000000001',
    roles: ['ADMIN' as RoleEnum],
    permissions: [PermissionEnum.ACCESS_API_ADMIN],
    email: 'admin@test.com',
    name: 'Test Admin'
};

/**
 * Mounts the real billing router behind a minimal middleware that seeds the
 * context variables the middleware stack and handler read directly
 * (`actor`, `billingEnabled`, `billingCustomerId`). This stands in for the
 * real app's actor/billing-context middlewares, which run upstream of
 * `createBillingRoutesHandler()` in production but are out of scope here.
 *
 * `billingCustomerId` IS set: with it, the deterministic outcome of reaching
 * the handler is its own 404 "Subscription not found" (the global `@repo/db`
 * mock resolves the row lookup to `[]`) — a signal distinct from BOTH 403s
 * the middleware stack can produce (see the module docblock).
 */
function buildTestApp(actor: Actor) {
    const app = createRouter();
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        c.set('billingEnabled', true);
        c.set('billingCustomerId', OWNER_CUSTOMER_ID);
        await next();
    });
    app.route('/api/v1/protected/billing', createBillingRoutesHandler());
    return app;
}

async function postReplacePaymentMethod(actor: Actor) {
    const app = buildTestApp(actor);
    const res = await app.request(REPLACE_PAYMENT_METHOD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    const body = (await res.json()) as Record<string, unknown>;
    return { res, body };
}

async function postCheckoutRetry(actor: Actor) {
    const app = buildTestApp(actor);
    const res = await app.request(CHECKOUT_RETRY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    const body = (await res.json()) as Record<string, unknown>;
    return { res, body };
}

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('Billing route mount order — replace-payment-method routing regression (HOS-1244)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('POST /subscriptions/:localId/replace-payment-method', () => {
        it('does not reject a non-admin USER with the billing admin guard 403', async () => {
            // Arrange + Act: a past-due customer (plain USER role — exactly
            // who this recovery route exists for) fires the request.
            const { res, body } = await postReplacePaymentMethod(NON_ADMIN_ACTOR);

            // Assert — primary regression guard. If replacePaymentMethodRouter
            // were mounted AFTER cancelWrapper/qzpayWrapper, the REAL
            // billingAdminGuardMiddleware would reject this non-admin actor
            // with 403 here (the measured HOS-1244 bug).
            expect(res.status).not.toBe(403);
            expect(JSON.stringify(body)).not.toContain('administrator privileges');

            // Assert — the request did NOT fall through to the ownership
            // middleware either (that 403 is what an `allowedSubPaths`-only
            // fix would produce for a row the caller does not own).
            expect(JSON.stringify(body)).not.toContain(
                'You do not have access to this billing resource'
            );

            // Assert — the request reached handleReplacePaymentMethod (not
            // qzpay's POST /subscriptions/:id fallback), proven by its
            // deterministic 404: the global `@repo/db` mock resolves the row
            // lookup to `[]`, so the handler's own "not found" fires.
            expect(res.status).toBe(404);
            expect(body).not.toHaveProperty('route', 'qzpay-post-subscription');
            const error = body.error as Record<string, unknown> | undefined;
            expect(error?.message).toBe('Subscription not found');
            expect(mockReplacePastDuePaymentMethod).not.toHaveBeenCalled();
        });

        it('also lets an ADMIN actor reach the handler (symmetry check)', async () => {
            // Arrange + Act.
            const { res, body } = await postReplacePaymentMethod(ADMIN_ACTOR);

            // Assert — same deterministic 404, proving the admin actor also
            // reaches handleReplacePaymentMethod rather than being routed
            // elsewhere.
            expect(res.status).not.toBe(403);
            expect(res.status).toBe(404);
            const error = body.error as Record<string, unknown> | undefined;
            expect(error?.message).toBe('Subscription not found');
        });

        it('answers 404 (never 403) for a row owned by someone else — ownership is enforced by the handler, not a middleware', async () => {
            // Arrange: the row lookup returns a subscription owned by a
            // DIFFERENT billing customer. The route's contract (error-contract
            // docs + endpoint gate matrix) is 404 here: a 403 would confirm
            // the id exists.
            vi.mocked(getDb).mockReturnValueOnce({
                select: () => ({
                    from: () => ({
                        where: () => ({
                            limit: () =>
                                Promise.resolve([
                                    {
                                        id: LOCAL_SUB_ID,
                                        customerId: OTHER_CUSTOMER_ID,
                                        planId: 'plan-001',
                                        status: 'past_due',
                                        billingInterval: 'month',
                                        productDomain: null,
                                        metadata: null
                                    }
                                ])
                        })
                    })
                })
            } as never);

            // Act.
            const { res, body } = await postReplacePaymentMethod(NON_ADMIN_ACTOR);

            // Assert.
            expect(res.status).toBe(404);
            const error = body.error as Record<string, unknown> | undefined;
            expect(error?.message).toBe('Subscription not found');
            expect(mockReplacePastDuePaymentMethod).not.toHaveBeenCalled();
        });
    });

    // checkout-retry (HOS-937) shares the EXACT mount-shape and the exact
    // exposure: a POST to `/subscriptions/:id/checkout-retry` was rejected by
    // the same composed guard middleware with the same 403 for a non-admin
    // USER — measured with a throwaway probe on 2026-09-10 during HOS-1244.
    // The owner authorized the same remedy in the same PR.
    describe('POST /subscriptions/:localId/checkout-retry (same guard-403 class, fixed alongside)', () => {
        it('does not reject a non-admin USER with the billing admin guard 403', async () => {
            const { res, body } = await postCheckoutRetry(NON_ADMIN_ACTOR);

            expect(res.status).not.toBe(403);
            expect(JSON.stringify(body)).not.toContain('administrator privileges');
            expect(JSON.stringify(body)).not.toContain(
                'You do not have access to this billing resource'
            );

            // Reaching the handler is proven by its own 404: the global
            // `@repo/db` mock resolves the row lookup to `[]`.
            expect(res.status).toBe(404);
            expect(body).not.toHaveProperty('route', 'qzpay-post-subscription');
            const error = body.error as Record<string, unknown> | undefined;
            expect(error?.message).toBe('Subscription not found');
        });
    });
});
