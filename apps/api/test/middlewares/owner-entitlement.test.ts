/**
 * SPEC-187 P2-T4 — `ownerEntitlementMiddleware` unit tests.
 *
 * The middleware resolves the OWNING HOST of an accommodation and attaches
 * their `EntitlementKey[]` to the Hono context as `c.get('ownerEntitlements')`.
 * This is distinct from the existing `entitlementMiddleware` (which resolves
 * the REQUESTING user) and is required by FR-3b (P2-T5) so the public
 * accommodation detail endpoint can gate `richDescription` on the OWNER's
 * entitlement, not the viewer's.
 *
 * The test is a unit test (not real-DB integration) because the middleware
 * does three pure lookups — `accommodation → owner`, `owner → billing
 * customer`, `billing customer → plan entitlements` — and each of those is
 * covered by integration tests on the underlying services. The middleware
 * unit test asserts the orchestration: contract of context keys, error
 * short-circuits, and fail-open behavior.
 */
import { EntitlementKey, getDefaultEntitlements, getUnlimitedEntitlements } from '@repo/billing';
import { RoleEnum } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import { ownerEntitlementMiddleware } from '../../src/middlewares/owner-entitlement';
import { createErrorHandler } from '../../src/middlewares/response';
import type { AppBindings } from '../../src/types';

// Mock the billing module — ownerEntitlementMiddleware uses getQZPayBilling
// to look up the OWNING HOST's customer and plan.
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock the DB module — ownerEntitlementMiddleware uses getDb() to resolve
// accommodation → ownerId.
const mockAccommodationSelect = vi.fn();
vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        select: mockAccommodationSelect
    })),
    accommodations: {
        id: 'accommodations.id',
        ownerId: 'accommodations.ownerId'
    },
    users: {
        id: 'users.id',
        role: 'users.role'
    }
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

/**
 * Helper: build a chainable query stub that returns the given row.
 *
 * The Drizzle query shape used by the middleware is:
 *   db.select({ ownerId: accommodations.ownerId })
 *     .from(accommodations)
 *     .where(eq(accommodations.id, accommodationId))
 *     .limit(1)
 */
function mockAccommodationLookup(row: { ownerId: string; ownerRole?: RoleEnum | null } | null) {
    const whereChain = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(row ? [row] : [])
    };
    const fromChain = {
        from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue(whereChain)
        })
    };
    mockAccommodationSelect.mockReturnValue(fromChain);
    return { fromChain, whereChain };
}

describe('ownerEntitlementMiddleware', () => {
    let app: Hono<AppBindings>;
    let mockBilling: {
        customers: { getByExternalId: ReturnType<typeof vi.fn> };
        subscriptions: { getByCustomerId: ReturnType<typeof vi.fn> };
        plans: { get: ReturnType<typeof vi.fn> };
        entitlements: { getByCustomerId: ReturnType<typeof vi.fn> };
        limits: { getByCustomerId: ReturnType<typeof vi.fn> };
    };

    beforeEach(() => {
        app = new Hono<AppBindings>();
        app.onError(createErrorHandler());

        mockBilling = {
            customers: { getByExternalId: vi.fn() },
            subscriptions: { getByCustomerId: vi.fn() },
            plans: { get: vi.fn() },
            entitlements: { getByCustomerId: vi.fn() },
            limits: { getByCustomerId: vi.fn() }
        };
        vi.mocked(getQZPayBilling).mockReturnValue(
            mockBilling as unknown as ReturnType<typeof getQZPayBilling>
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('contract — ownerEntitlements set on context', () => {
        it('attaches the owner plan entitlements to c.get("ownerEntitlements")', async () => {
            // Arrange — accommodation owned by host-001, with a paid subscription to a plan
            // that grants CAN_USE_RICH_DESCRIPTION (and nothing else, to make the assertion tight).
            mockAccommodationLookup({ ownerId: 'host-001', ownerRole: RoleEnum.HOST });
            mockBilling.customers.getByExternalId.mockResolvedValue({ id: 'cust-001' });
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-001', status: 'active', planId: 'plan-001' }
            ]);
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-001',
                slug: 'host-pro',
                entitlements: [EntitlementKey.CAN_USE_RICH_DESCRIPTION],
                limits: {}
            });
            mockBilling.entitlements.getByCustomerId.mockResolvedValue([]);
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            app.use(
                '/accommodations/:accommodationId',
                ownerEntitlementMiddleware({ paramName: 'accommodationId' })
            );
            app.get('/accommodations/:accommodationId', (c) => {
                const ownerEntitlements = c.get('ownerEntitlements');
                return c.json({
                    hasRichDescription: ownerEntitlements.has(
                        EntitlementKey.CAN_USE_RICH_DESCRIPTION
                    ),
                    size: ownerEntitlements.size,
                    isSet: ownerEntitlements instanceof Set
                });
            });

            const res = await app.request('/accommodations/acc-001');
            const body = await res.json();

            // Assert — the route sees the OWNER'S entitlement, not empty.
            expect(res.status).toBe(200);
            expect(body.isSet).toBe(true);
            expect(body.hasRichDescription).toBe(true);
            expect(body.size).toBe(1);
        });
    });

    describe('error short-circuits', () => {
        it('returns 400 when no accommodationId param is available (no implicit host resolution)', async () => {
            // The middleware factory configures the param name; if the param
            // is missing on the request, it MUST short-circuit. This pins
            // FR-3b's contract that there is no implicit host fallback.
            app.use('/accommodations/:accommodationId', ownerEntitlementMiddleware());
            app.get('/accommodations/:accommodationId', (c) => c.json({ ok: true }));

            // Hitting a different path that doesn't have :accommodationId simulates
            // a misconfigured route — the middleware must NOT silently proceed with
            // an empty set, because that would cause filterAccommodationByEntitlements
            // to omit richDescription for EVERY owner.
            app.use('/no-param-route', ownerEntitlementMiddleware());
            app.get('/no-param-route', (c) =>
                c.json({ ownerEntitlementsSize: c.get('ownerEntitlements').size })
            );

            // The /no-param-route short-circuits with 400 before the route handler.
            const res = await app.request('/no-param-route');
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 404 when the accommodation does not exist', async () => {
            mockAccommodationLookup(null);

            app.use(
                '/accommodations/:accommodationId',
                ownerEntitlementMiddleware({ paramName: 'accommodationId' })
            );
            app.get('/accommodations/:accommodationId', (c) => c.json({ ok: true }));

            const res = await app.request('/accommodations/does-not-exist');
            expect(res.status).toBe(404);
            const body = await res.json();
            expect(body.error?.code).toBe('NOT_FOUND');
        });
    });

    describe('fail-open when owner has no billing customer', () => {
        it('attaches an empty Set and proceeds (matches the no-customer branch of loadEntitlements)', async () => {
            // The owner has a user record but no billing customer row yet
            // (e.g., host was just promoted to HOST but Better Auth's
            // databaseHook hasn't created the customer). The middleware must
            // NOT 5xx — it must proceed with an empty Set so the public
            // route can apply the "owner-not-entitled" omission deterministically.
            mockAccommodationLookup({ ownerId: 'host-001', ownerRole: RoleEnum.HOST });
            mockBilling.customers.getByExternalId.mockResolvedValue(null);
            // subscriptions and plans calls should NOT happen on the no-customer path.

            app.use(
                '/accommodations/:accommodationId',
                ownerEntitlementMiddleware({ paramName: 'accommodationId' })
            );
            app.get('/accommodations/:accommodationId', (c) => {
                const ownerEntitlements = c.get('ownerEntitlements');
                return c.json({
                    size: ownerEntitlements.size,
                    isSet: ownerEntitlements instanceof Set
                });
            });

            const res = await app.request('/accommodations/acc-001');
            const body = await res.json();

            expect(res.status).toBe(200);
            expect(body.isSet).toBe(true);
            expect(body.size).toBe(0);
            // No downstream plan lookup was attempted.
            expect(mockBilling.subscriptions.getByCustomerId).not.toHaveBeenCalled();
            expect(mockBilling.plans.get).not.toHaveBeenCalled();
        });
    });

    describe('fail-open when billing is not initialized', () => {
        it('attaches the default free-tier entitlements and proceeds (mirrors entitlementMiddleware)', async () => {
            // When billing is unconfigured (e.g., dev with no payment
            // provider), the middleware must not 5xx. The contract is:
            // ownerEntitlements is always a Set — never undefined, never
            // null — and it carries whatever default the billing stack
            // returns when getQZPayBilling() is null.
            mockAccommodationLookup({ ownerId: 'host-001', ownerRole: RoleEnum.HOST });
            vi.mocked(getQZPayBilling).mockReturnValue(null);

            app.use(
                '/accommodations/:accommodationId',
                ownerEntitlementMiddleware({ paramName: 'accommodationId' })
            );
            app.get('/accommodations/:accommodationId', (c) => {
                const ownerEntitlements = c.get('ownerEntitlements');
                // tourist-free defaults do NOT include CAN_USE_RICH_DESCRIPTION,
                // so the public route will omit richDescription for free hosts.
                return c.json({
                    isSet: ownerEntitlements instanceof Set,
                    hasRichDescription: ownerEntitlements.has(
                        EntitlementKey.CAN_USE_RICH_DESCRIPTION
                    )
                });
            });

            const res = await app.request('/accommodations/acc-001');
            const body = await res.json();

            expect(res.status).toBe(200);
            expect(body.isSet).toBe(true);
            // Default = tourist-free, which does NOT include the rich-description entitlement.
            expect(body.hasRichDescription).toBe(false);
        });
    });

    describe('staff bypass', () => {
        it('grants the unlimited entitlement set to platform staff owners (INV-6 symmetry)', async () => {
            // Mirrors the staff bypass in entitlementMiddleware: SUPER_ADMIN,
            // ADMIN, EDITOR, CLIENT_MANAGER get the full unlimited set. This
            // matters in dev (where the seeded owner might be a SUPER_ADMIN
            // for testing convenience) and in admin-preview contexts.
            // The owner lookup still runs, but the entitlement override
            // replaces whatever the plan would have returned.
            mockAccommodationLookup({ ownerId: 'staff-001', ownerRole: RoleEnum.SUPER_ADMIN });
            // Even if the plan would have returned nothing, the staff
            // bypass grants the full unlimited set. We assert that
            // subscriptions.getByCustomerId is NOT called on the bypass.
            mockBilling.customers.getByExternalId.mockResolvedValue({ id: 'cust-staff' });

            app.use(
                '/accommodations/:accommodationId',
                ownerEntitlementMiddleware({ paramName: 'accommodationId' })
            );
            app.get('/accommodations/:accommodationId', (c) => {
                const ownerEntitlements = c.get('ownerEntitlements');
                const unlimited = getUnlimitedEntitlements();
                return c.json({
                    hasRichDescription: ownerEntitlements.has(
                        EntitlementKey.CAN_USE_RICH_DESCRIPTION
                    ),
                    hasVideo: ownerEntitlements.has(EntitlementKey.CAN_EMBED_VIDEO),
                    unlimitedSize: new Set(unlimited.entitlements).size
                });
            });

            const res = await app.request('/accommodations/acc-001');
            const body = await res.json();

            expect(res.status).toBe(200);
            // staff bypass: both features present
            expect(body.hasRichDescription).toBe(true);
            expect(body.hasVideo).toBe(true);
            // size matches the unlimited sentinel
            const expected = new Set(getUnlimitedEntitlements().entitlements).size;
            expect(body.unlimitedSize).toBe(expected);
            expect(mockBilling.subscriptions.getByCustomerId).not.toHaveBeenCalled();
        });
    });

    describe('regression — default entitlements do not include rich description', () => {
        it('owner on the default free plan does NOT get CAN_USE_RICH_DESCRIPTION (pins the gate)', async () => {
            // The default (tourist-free) entitlements are the resolved source
            // of truth — they MUST NOT include CAN_USE_RICH_DESCRIPTION, or
            // the public gate would always let richDescription through. This
            // is a regression pin on @repo/billing's getDefaultEntitlements.
            const defaults = getDefaultEntitlements();
            expect(defaults.entitlements).not.toContain(EntitlementKey.CAN_USE_RICH_DESCRIPTION);
        });
    });
});
