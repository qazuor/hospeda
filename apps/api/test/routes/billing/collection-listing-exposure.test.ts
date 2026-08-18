/**
 * Regression test for the billing COLLECTION LISTING exposure (H-66 / HOS-446).
 *
 * WHAT WAS BROKEN
 * ---------------
 * `createBillingRoutesHandler()` mounts qzpay-hono's pre-built billing CRUD
 * under the PROTECTED tier (`/api/v1/protected/billing`). qzpay's list handlers
 * do not scope by customer — `billing.customers.list({ limit, offset })` returns
 * every row — and the two guards in front of them each deferred to the other:
 *
 * - `billingAdminGuardMiddleware` lets every GET through ("filtered by
 *   ownership middleware").
 * - `billingOwnershipMiddleware` passes through when the path names no resource
 *   ("No resource ID in path: pass through (list endpoints…)").
 *
 * The effective boundary became "does the path carry an id?" instead of "is this
 * mine?", so any authenticated user could `GET /customers` and read every other
 * customer's name and email. Measured in production against real accounts.
 *
 * WHAT THIS TEST ASSERTS
 * ----------------------
 * Status alone would be a weak assertion, so every case also asserts that NO
 * foreign row reaches the response body. The mocked qzpay router deliberately
 * serves third-party PII, and the same mock proves the instrument works: a
 * resource-scoped GET still reaches it (see "instrument check"), so a blanket
 * 404 from a broken mount cannot make these assertions pass for the wrong
 * reason.
 *
 * @module test/routes/billing/collection-listing-exposure
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

/**
 * Foreign PII served by the mocked qzpay collection handlers. If any of these
 * strings reaches a response body, the leak is live.
 */
const FOREIGN_EMAIL = 'tercero.ajeno@example-victim.test';
const FOREIGN_NAME = 'Tercero Ajeno';
const FOREIGN_CUSTOMER_ID = 'cus-foreign-0001';

/** The billing customer the test actor actually owns. */
const OWN_CUSTOMER_ID = 'cus-own-0001';

// Mock @qazuor/qzpay-hono with a router carrying the real pre-built shape:
// bare-collection listings that return EVERY row (the upstream behaviour), plus
// one resource-scoped route used as the instrument check.
vi.mock('@qazuor/qzpay-hono', async () => {
    const { Hono } = await import('hono');
    return {
        createBillingRoutes: vi.fn(() => {
            const router = new Hono();
            const unscopedCustomers = [
                { id: OWN_CUSTOMER_ID, name: 'Propio', email: 'propio@example.test' },
                { id: FOREIGN_CUSTOMER_ID, name: FOREIGN_NAME, email: FOREIGN_EMAIL }
            ];

            router.get('/customers', (c) =>
                c.json({ success: true, data: unscopedCustomers, pagination: { total: 2 } })
            );
            router.get('/subscriptions', (c) =>
                c.json({
                    success: true,
                    data: [{ id: 'sub-foreign', customerId: FOREIGN_CUSTOMER_ID }],
                    pagination: { total: 1 }
                })
            );
            router.get('/invoices', (c) =>
                c.json({
                    success: true,
                    data: [{ id: 'inv-foreign', customerId: FOREIGN_CUSTOMER_ID }],
                    pagination: { total: 1 }
                })
            );
            router.get('/payments', (c) =>
                c.json({
                    success: true,
                    data: [{ id: 'pay-foreign', customerId: FOREIGN_CUSTOMER_ID, amount: 1800000 }],
                    pagination: { total: 1 }
                })
            );
            router.get('/promo-codes', (c) =>
                c.json({
                    success: true,
                    data: [{ code: 'GRUPO_WHATSAPP', effectKind: 'discount' }],
                    pagination: { total: 1 }
                })
            );
            router.get('/promo-codes/:code', (c) =>
                c.json({
                    success: true,
                    data: { code: c.req.param('code'), discountType: 'percentage', maxUses: 100 }
                })
            );

            // Instrument check: a resource-scoped GET that must stay reachable.
            router.get('/customers/:id', (c) =>
                c.json({ route: 'qzpay-get-customer', id: c.req.param('id') })
            );

            return router;
        })
    };
});

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

vi.mock('../../../src/middlewares/sentry', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        sentryBillingMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
            await next();
        }
    };
});

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

// `billingAdminGuardMiddleware` and `billingOwnershipMiddleware` are
// deliberately NOT mocked: the pair of pass-through decisions they make is the
// mechanism under test.

// ---------------------------------------------------------------------------
// Imports — after mocks.
// ---------------------------------------------------------------------------

import { createBillingRoutesHandler } from '../../../src/routes/billing/index';
import { createRouter } from '../../../src/utils/create-app';

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

process.env.NODE_ENV = 'test';

const BILLING_BASE = '/api/v1/protected/billing';

/** Regular authenticated USER — the exact shape that leaked in production. */
const NON_ADMIN_ACTOR: Actor = {
    id: '00000000-0000-4000-8000-000000000099',
    roles: ['USER' as RoleEnum],
    permissions: [],
    email: 'user@test.com',
    name: 'Test User'
};

const ADMIN_ACTOR: Actor = {
    id: '00000000-0000-4000-8000-000000000001',
    roles: ['ADMIN' as RoleEnum],
    permissions: [PermissionEnum.ACCESS_API_ADMIN],
    email: 'admin@test.com',
    name: 'Test Admin'
};

/**
 * Mounts the real billing router behind a middleware seeding the context
 * variables the billing guards read (`actor`, `billingEnabled`,
 * `billingCustomerId`), standing in for the upstream app middlewares.
 */
function buildTestApp(actor: Actor) {
    const app = createRouter();
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        c.set('billingEnabled', true);
        c.set('billingCustomerId', OWN_CUSTOMER_ID);
        await next();
    });
    app.route(BILLING_BASE, createBillingRoutesHandler());
    return app;
}

/** Every bare-collection listing qzpay exposes that must not serve user data. */
const BLOCKED_LISTINGS = [
    '/customers',
    '/subscriptions',
    '/invoices',
    '/payments',
    '/promo-codes'
] as const;

// ---------------------------------------------------------------------------
// Tests.
// ---------------------------------------------------------------------------

describe('Billing collection listings are not exposed at the protected tier (H-66)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('instrument check', () => {
        it('the mocked qzpay router IS reachable for a resource-scoped GET', async () => {
            // Arrange: without this, a router that registered nothing at all
            // would 404 everywhere and make every assertion below pass for the
            // wrong reason.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/customers/${OWN_CUSTOMER_ID}`);
            const body = (await res.json()) as Record<string, unknown>;

            // Assert.
            expect(res.status).toBe(200);
            expect(body).toHaveProperty('route', 'qzpay-get-customer');
        });
    });

    describe.each(BLOCKED_LISTINGS)('GET %s', (path) => {
        it('does not reach qzpay for a regular authenticated user', async () => {
            // Arrange.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}${path}`);
            const raw = await res.text();

            // Assert — the listing is not served at this tier.
            expect(res.status).toBe(404);

            // Assert — and, more importantly, no row reached the caller. A
            // status-only assertion would still pass if the body leaked.
            expect(raw).not.toContain('"data":[{');
            expect(raw).not.toContain(FOREIGN_CUSTOMER_ID);
        });
    });

    describe('foreign PII never reaches the response body', () => {
        it('GET /customers leaks neither a third-party email nor name', async () => {
            // Arrange.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const raw = await (await app.request(`${BILLING_BASE}/customers`)).text();

            // Assert — this is the finding verbatim: names and emails of real
            // people served to anyone holding a session.
            expect(raw).not.toContain(FOREIGN_EMAIL);
            expect(raw).not.toContain(FOREIGN_NAME);
        });

        it('GET /payments leaks no third-party amount', async () => {
            // Arrange.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const raw = await (await app.request(`${BILLING_BASE}/payments`)).text();

            // Assert.
            expect(raw).not.toContain('1800000');
            expect(raw).not.toContain('pay-foreign');
        });

        it('GET /promo-codes does not enumerate the coupon catalog', async () => {
            // Arrange: the content plan fixed that coupons are never published.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const raw = await (await app.request(`${BILLING_BASE}/promo-codes`)).text();

            // Assert.
            expect(raw).not.toContain('GRUPO_WHATSAPP');
        });
    });

    describe('sibling read path in the same router', () => {
        it('GET /promo-codes/:code does not hand over a coupon to a guessed name', async () => {
            // Arrange: blocking the listing while leaving the by-name lookup
            // open would move the catalog behind a guess, not behind a gate —
            // and coupon names are guessable by construction. Verified live:
            // LANZAMIENTO50, BIENVENIDO30 and FREEMONTH all resolved 200 on the
            // first try before this block existed.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/promo-codes/LANZAMIENTO50`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(404);
            expect(raw).not.toContain('discountType');
            expect(raw).not.toContain('maxUses');
        });

        it('leaves the sanitized POST /promo-codes/validate path alone', async () => {
            // Arrange: that route is Hospeda's own and is how checkout answers
            // "is this code valid" without exposing the row. It must not be
            // collateral damage — a 404 here would break checkout.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/promo-codes/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'LANZAMIENTO50' })
            });

            // Assert — reached its own handler, whatever it decides.
            expect(res.status).not.toBe(404);
        });
    });

    describe('the block is actor-blind', () => {
        it('answers an admin actor identically — admin listings live under /admin/billing', async () => {
            // Arrange: the response must not vary by actor, so nothing about
            // the caller can be inferred from it and no cached variant can
            // differ. Admin billing has its own tier and its own routes.
            const app = buildTestApp(ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/customers`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(404);
            expect(raw).not.toContain(FOREIGN_EMAIL);
        });
    });
});
