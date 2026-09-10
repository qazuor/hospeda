/**
 * Regression test for the SINGLE-PLAN read exposure at the protected billing
 * tier (HOS-1186).
 *
 * WHAT WAS BROKEN
 * ---------------
 * HOS-1062 F1 introduced `billing_plans.metadata.publicListing` and filtered the
 * two endpoints that ENUMERATE plans. It left the single-plan reads alone:
 * `protectedPlansListRouter` registers only `GET /`, so
 * `GET /api/v1/protected/billing/plans/:id` and `.../plans/:id/prices` fell
 * through to qzpay-hono's prebuilt handlers, which answer the whole row —
 * `metadata` and `prices[]` included — to ANY authenticated caller. The storage
 * adapter attaches prices inside `findById`, so the negotiated amount came back
 * in that single response; the `/prices` sub-route was a second door to the same
 * number, not a necessary second step.
 *
 * Three guards sat in front of it and none of them stops it: the admin guard
 * lets every GET through, the ownership middleware only fires for a resource
 * that carries a `customerId`, and the collection-listing block exempts the
 * `plans` segment.
 *
 * WHAT THIS TEST ASSERTS
 * ----------------------
 * The mocked qzpay router deliberately serves the withheld row, so a missing or
 * mis-ordered shadow fails these cases with the leak visible in the body rather
 * than by a status code alone. Two instrument checks keep a blanket 404 from
 * making the suite pass for the wrong reason: an unrelated resource-scoped GET
 * still reaches qzpay, and a LISTED plan still answers 200 through the shadow.
 *
 * @module test/routes/billing/protected-plan-by-id
 */

import type { RoleEnum } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fixtures shared with the mocks — declared via vi.hoisted so the factories
// below (hoisted by Vitest) can close over them.
// ---------------------------------------------------------------------------

const { mockPlanGet, mockPlanGetPrices, mockQzpayPlanPayload, mockBillingFacade } = vi.hoisted(
    () => ({
        mockPlanGet: vi.fn(),
        mockPlanGetPrices: vi.fn(),
        /** What the PREBUILT qzpay route would answer — i.e. the leak itself. */
        mockQzpayPlanPayload: vi.fn(),
        /** Lets a single test simulate "billing is not configured". */
        mockBillingFacade: vi.fn()
    })
);

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// Mock @qazuor/qzpay-hono with the real prebuilt SHAPE: a single-plan read and
// its prices sub-route, both answering the raw storage row. If the shadow is
// absent, these are what the caller gets.
vi.mock('@qazuor/qzpay-hono', async () => {
    const { Hono } = await import('hono');
    return {
        createBillingRoutes: vi.fn(() => {
            const router = new Hono();

            router.get('/plans/:id', (c) =>
                c.json({ route: 'qzpay-plan-by-id', success: true, data: mockQzpayPlanPayload() })
            );
            router.get('/plans/:id/prices', (c) =>
                c.json({
                    route: 'qzpay-plan-prices',
                    success: true,
                    data: mockQzpayPlanPayload().prices
                })
            );

            // Instrument check: an unrelated resource-scoped GET that must stay
            // reachable, so a router that registered nothing cannot make the
            // 404 assertions below pass vacuously.
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
        getQZPayBilling: vi.fn(() => mockBillingFacade()),
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

// `billingAdminGuardMiddleware`, `billingOwnershipMiddleware` and
// `billingAuthMiddleware` are deliberately NOT mocked: the first two are the
// guards that fail to stop this, and the third is the only authentication the
// shadow relies on.

// ---------------------------------------------------------------------------
// Imports — after mocks.
// ---------------------------------------------------------------------------

import { createBillingRoutesHandler } from '../../../src/routes/billing/index';
import { createRouter } from '../../../src/utils/create-app';

process.env.NODE_ENV = 'test';

const BILLING_BASE = '/api/v1/protected/billing';

/** An ordinary catalogue plan: every plan in production is this case. */
const LISTED_PLAN = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'owner-premium',
    description: 'Plan publicado',
    active: true,
    metadata: { displayName: 'Premium' },
    prices: [{ id: 'price-listed', unitAmount: 1_500_000, currency: 'ARS' }]
};

/**
 * A negotiated plan: ACTIVE and charging, withheld from every catalogue. The
 * name is guessable by construction and the amount is the agreement itself —
 * both are asserted as absent from every non-admin response body.
 */
const UNLISTED_PLAN = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'partner-municipalidad-cdu',
    description: 'Acuerdo municipal',
    active: true,
    metadata: { publicListing: 'unlisted', displayName: 'Municipalidad CdU' },
    prices: [{ id: 'price-negotiated', unitAmount: 4_200_000, currency: 'ARS' }]
};

/** A plan whose mark is present but unreadable — withheld, never published. */
const UNREADABLE_MARK_PLAN = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'partner-typo',
    active: true,
    metadata: { publicListing: 'unlited' },
    prices: [{ id: 'price-typo', unitAmount: 999_000, currency: 'ARS' }]
};

/** The hidden daily test plan, withheld by the same predicate as the list. */
const TEST_PLAN = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'owner-test-daily',
    active: true,
    metadata: { testPlan: true },
    prices: [{ id: 'price-test', unitAmount: 1_000, currency: 'ARS' }]
};

/**
 * The most common plan in production: never marked at all. Two spellings of it,
 * because this is the fixture whose failure turns a bug into "the whole
 * catalogue went dark" rather than "one plan leaked" — and the mark resolves to
 * `'listed'` for an ABSENT key but to `'unlisted'` for an unreadable one, so the
 * difference between "no metadata" and "bad metadata" is the difference between
 * serving every plan and serving none.
 */
const UNMARKED_PLAN_NO_METADATA = {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'owner-basico',
    active: true,
    prices: [{ id: 'price-basico', unitAmount: 500_000, currency: 'ARS' }]
};

const UNMARKED_PLAN_NULL_METADATA = {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'owner-gratis',
    active: true,
    metadata: null,
    prices: []
};

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
 * variables the billing guards read, standing in for the upstream app
 * middlewares. `actor: null` stands in for an unauthenticated request.
 */
function buildTestApp(actor: Actor | null) {
    const app = createRouter();
    app.use('*', async (c, next) => {
        if (actor) {
            c.set('actor', actor);
        }
        c.set('billingEnabled', true);
        c.set('billingCustomerId', 'cus-own-0001');
        await next();
    });
    app.route(BILLING_BASE, createBillingRoutesHandler());
    return app;
}

/** Points both the shadow's storage read and the qzpay mock at one fixture. */
function serveFixture(plan: Record<string, unknown> | null) {
    mockPlanGet.mockResolvedValue(plan);
    mockPlanGetPrices.mockResolvedValue(plan?.prices ?? []);
    mockQzpayPlanPayload.mockReturnValue(plan ?? {});
}

describe('GET /plans/:id at the protected tier withholds a plan the catalogue withholds (HOS-1186)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBillingFacade.mockReturnValue({
            plans: { get: mockPlanGet, getPrices: mockPlanGetPrices }
        });
    });

    describe('instrument checks', () => {
        it('an unrelated resource-scoped GET still reaches the qzpay router', async () => {
            // Arrange: without this, a mount that 404s everything would make
            // every withholding assertion below pass for the wrong reason.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/customers/cus-own-0001`);
            const body = (await res.json()) as Record<string, unknown>;

            // Assert.
            expect(res.status).toBe(200);
            expect(body).toHaveProperty('route', 'qzpay-get-customer');
        });

        it('an UNMARKED plan answers 200 — with no metadata key at all', async () => {
            // Arrange: the case every plan in production is in. The resolver
            // reads an ABSENT mark as 'listed' and an unreadable one as
            // 'unlisted', so getting this wrong does not leak one plan — it
            // takes the whole catalogue dark behind a 404.
            serveFixture(UNMARKED_PLAN_NO_METADATA);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${UNMARKED_PLAN_NO_METADATA.id}`);
            const body = (await res.json()) as Record<string, unknown>;

            // Assert.
            expect(res.status).toBe(200);
            expect(body).toEqual({ success: true, data: UNMARKED_PLAN_NO_METADATA });
        });

        it('an UNMARKED plan answers 200 — with metadata explicitly null', async () => {
            // Arrange: the shape `mapDbToPlan` tolerates, and a second spelling
            // of the same "never marked" state.
            serveFixture(UNMARKED_PLAN_NULL_METADATA);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(
                `${BILLING_BASE}/plans/${UNMARKED_PLAN_NULL_METADATA.id}`
            );
            const body = (await res.json()) as Record<string, unknown>;

            // Assert.
            expect(res.status).toBe(200);
            expect(body).toEqual({ success: true, data: UNMARKED_PLAN_NULL_METADATA });
        });

        it('a LISTED plan still answers 200, and from the shadow rather than qzpay', async () => {
            // Arrange: this is the case a too-wide fix breaks. A blanket 404 on
            // `/plans/:id` would withhold the whole catalogue by id, which is
            // not the defect — the defect is the WITHHELD row.
            serveFixture(LISTED_PLAN);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${LISTED_PLAN.id}`);
            const body = (await res.json()) as Record<string, unknown>;

            // Assert — served, and served by Hospeda's handler: the prebuilt
            // route stamps `route`, the shadow does not.
            expect(res.status).toBe(200);
            expect(body).not.toHaveProperty('route');
            expect(body).toEqual({ success: true, data: LISTED_PLAN });
            expect(mockPlanGet).toHaveBeenCalledWith(LISTED_PLAN.id);
        });
    });

    describe('a withheld plan is not served, and nothing of it reaches the body', () => {
        it('answers 404 for a plan marked unlisted', async () => {
            // Arrange.
            serveFixture(UNLISTED_PLAN);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${UNLISTED_PLAN.id}`);
            const raw = await res.text();

            // Assert — status, and then the thing that actually matters: the
            // slug and the negotiated amount are absent. A status-only
            // assertion would pass with the row in the body.
            expect(res.status).toBe(404);
            expect(raw).not.toContain('partner-municipalidad-cdu');
            expect(raw).not.toContain('4200000');
            expect(raw).not.toContain('unlisted');
        });

        it('answers 404 for a plan whose mark is present but unreadable', async () => {
            // Arrange: withhold on doubt. A typo in an operator's UPDATE must
            // not publish the agreement.
            serveFixture(UNREADABLE_MARK_PLAN);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${UNREADABLE_MARK_PLAN.id}`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(404);
            expect(raw).not.toContain('partner-typo');
            expect(raw).not.toContain('999000');
        });

        it('answers 404 for the hidden test plan, the same as the listing does', async () => {
            // Arrange: one predicate for the listing and for the single read,
            // so the two cannot drift on what they withhold.
            serveFixture(TEST_PLAN);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${TEST_PLAN.id}`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(404);
            expect(raw).not.toContain('owner-test-daily');
        });

        it('is indistinguishable from a plan that does not exist', async () => {
            // Arrange: if a withheld plan answered differently from a missing
            // one, the endpoint would still confirm that the id exists — which
            // is the same leak one step smaller, and what the error contract's
            // "foreign resource answers 404, never 403" rule exists to prevent.
            serveFixture(UNLISTED_PLAN);
            const app = buildTestApp(NON_ADMIN_ACTOR);
            const withheld = await app.request(`${BILLING_BASE}/plans/${UNLISTED_PLAN.id}`);
            const withheldBody = await withheld.text();

            serveFixture(null);
            const missing = await app.request(
                `${BILLING_BASE}/plans/99999999-9999-4999-8999-999999999999`
            );
            const missingBody = await missing.text();

            // Assert — same status, byte-identical body.
            expect(withheld.status).toBe(missing.status);
            expect(withheldBody).toBe(missingBody);
        });

        it('answers an ADMIN actor identically — admin plan reads live under /admin/billing', async () => {
            // Arrange: the response does not vary by actor, the same invariant
            // the collection-listing block holds at this tier. The admin door
            // is `GET /api/v1/admin/billing/plans/:id` (BILLING_READ_ALL), which
            // this change does not touch — see
            // `test/routes/billing/admin/plans.test.ts`.
            serveFixture(UNLISTED_PLAN);
            const app = buildTestApp(ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${UNLISTED_PLAN.id}`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(404);
            expect(raw).not.toContain('partner-municipalidad-cdu');
            expect(raw).not.toContain('4200000');
        });

        it('requires authentication, and leaks nothing to an unauthenticated caller', async () => {
            // Arrange.
            serveFixture(UNLISTED_PLAN);
            const app = buildTestApp(null);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${UNLISTED_PLAN.id}`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(401);
            expect(raw).not.toContain('partner-municipalidad-cdu');
        });

        it('does not fall through to qzpay when billing is unconfigured', async () => {
            // Arrange: answering 503 is the loud failure; falling through to
            // the prebuilt route would be the silent one.
            serveFixture(UNLISTED_PLAN);
            mockBillingFacade.mockReturnValue(null);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${UNLISTED_PLAN.id}`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(503);
            expect(raw).not.toContain('partner-municipalidad-cdu');
        });
    });

    describe('a malformed id is rejected before the database sees it (H-68)', () => {
        it('answers 400 VALIDATION_ERROR for a non-UUID id, and never reads the catalogue', async () => {
            // Arrange: `billing_plans.id` is a `uuid` column compared without a
            // cast, so handing this to the storage layer raises a DRIVER error,
            // not a miss — which `app.onError` turns into 500 INTERNAL_ERROR
            // with a stack and a Sentry event. The contract puts shape at step 3
            // and forbids a 4xx from being INTERNAL_ERROR, so the check has to
            // run here, before the read.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/not-a-uuid`);
            const body = (await res.json()) as { error?: { code?: string } };

            // Assert — and the second half is the load-bearing one: the DB is
            // never reached, which is what makes the 500 impossible rather than
            // merely relabelled.
            expect(res.status).toBe(400);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(mockPlanGet).not.toHaveBeenCalled();
        });

        it('answers 400 for the literal `undefined` a client builds from an empty variable', async () => {
            // Arrange: the request nobody has to craft — the exact shape named
            // in `apps/api/docs/error-contract.md` as how H-68 was found across
            // 19 protected routes.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/undefined`);

            // Assert.
            expect(res.status).toBe(400);
            expect(mockPlanGet).not.toHaveBeenCalled();
        });

        it('rejects a malformed id on the prices sub-route too', async () => {
            // Arrange: same `uuid` column, same driver error, same 500 — the
            // sub-route needed the check on its own, not by proximity.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/not-a-uuid/prices`);
            const body = (await res.json()) as { error?: { code?: string } };

            // Assert.
            expect(res.status).toBe(400);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
            expect(mockPlanGet).not.toHaveBeenCalled();
            expect(mockPlanGetPrices).not.toHaveBeenCalled();
        });

        it('does not echo the offending value back', async () => {
            // Arrange: the caller already knows what it sent; reflecting a path
            // segment only sends it onward into logs and payloads.
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const raw = await (
                await app.request(`${BILLING_BASE}/plans/whatever-they-typed`)
            ).text();

            // Assert.
            expect(raw).not.toContain('whatever-they-typed');
        });
    });

    describe('the prices sub-route is the same door', () => {
        it('answers 404 for a withheld plan and never reads its prices', async () => {
            // Arrange: the amount is the agreement. The gate runs on the PLAN
            // before any price is loaded, so a withheld plan costs one read and
            // yields nothing.
            serveFixture(UNLISTED_PLAN);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${UNLISTED_PLAN.id}/prices`);
            const raw = await res.text();

            // Assert.
            expect(res.status).toBe(404);
            expect(raw).not.toContain('4200000');
            expect(raw).not.toContain('price-negotiated');
            expect(mockPlanGetPrices).not.toHaveBeenCalled();
        });

        it('still serves the prices of a LISTED plan', async () => {
            // Arrange.
            serveFixture(LISTED_PLAN);
            const app = buildTestApp(NON_ADMIN_ACTOR);

            // Act.
            const res = await app.request(`${BILLING_BASE}/plans/${LISTED_PLAN.id}/prices`);
            const body = (await res.json()) as Record<string, unknown>;

            // Assert.
            expect(res.status).toBe(200);
            expect(body).not.toHaveProperty('route');
            expect(body).toEqual({ success: true, data: LISTED_PLAN.prices });
            expect(mockPlanGetPrices).toHaveBeenCalledWith(LISTED_PLAN.id);
        });
    });
});
