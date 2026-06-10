/**
 * SPEC-187 P2-T4 — `ownerEntitlementMiddleware` unit tests.
 * SPEC-211 Phase 1 (T-007) — `resolveOwnerLimitsForOwnerId` unit tests (AC-1.1).
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
 *
 * The SPEC-211 additions test `resolveOwnerLimitsForOwnerId` independently
 * (it is exported and called directly by the chat route handler, not as a
 * Hono middleware). The DB mock is extended with a `mockUserRoleLookup` helper
 * for the `resolveOwnerRole` branch (no `innerJoin`, users-only query).
 */
import {
    EntitlementKey,
    LimitKey,
    getDefaultEntitlements,
    getUnlimitedEntitlements
} from '@repo/billing';
import { RoleEnum } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    ownerEntitlementMiddleware,
    resolveOwnerLimitsForOwnerId
} from '../../src/middlewares/owner-entitlement';
import { createErrorHandler } from '../../src/middlewares/response';
import type { AppBindings } from '../../src/types';

// Mock the billing module — ownerEntitlementMiddleware uses getQZPayBilling
// to look up the OWNING HOST's customer and plan.
vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// Mock the DB module — ownerEntitlementMiddleware uses getDb() to resolve
// accommodation → ownerId (with innerJoin), and resolveOwnerRole uses getDb()
// to resolve ownerId → role (without innerJoin).
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

// Mock PlanService — resolveOwnerLimitsForOwnerId uses it for the owner-basico
// fallback limits when the owner has no active subscription.
// Use vi.hoisted so the mock factory runs BEFORE the module-level import,
// which means mockGetBySlug is accessible at mock-factory evaluation time.
const { mockGetBySlug } = vi.hoisted(() => {
    return { mockGetBySlug: vi.fn() };
});
vi.mock('../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug
    }))
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

/**
 * Helper: stub the DB for the `resolveOwnerRole` query shape used by
 * `resolveOwnerLimitsForOwnerId`.
 *
 * The query in resolveOwnerRole is:
 *   db.select({ role: users.role }).from(users).where(...).limit(1)
 *
 * Unlike the accommodation lookup there is NO innerJoin, so the chain is:
 *   select → from → where → limit
 */
function mockUserRoleLookup(role: RoleEnum | null) {
    const whereChain = {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(role !== null ? [{ role }] : [])
    };
    const fromChain = {
        from: vi.fn().mockReturnValue(whereChain)
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

// ---------------------------------------------------------------------------
// SPEC-211 Phase 1 (T-007, AC-1.1) — resolveOwnerLimitsForOwnerId
// ---------------------------------------------------------------------------

/**
 * Unit tests for `resolveOwnerLimitsForOwnerId`.
 *
 * Tests cover the three acceptance criteria from AC-1.1:
 * 1. Owner WITH an active subscription → returns correct limits map from plan
 *    (+ customer-level overrides applied).
 * 2. Owner with NO active subscription → returns owner-basico fallback limits.
 * 3. Customer-level limit override merges correctly (override wins over plan).
 *
 * The function is called directly (not via a Hono route) since it is a plain
 * async export consumed inline by the chat route handler. The billing client
 * and PlanService are stubbed to avoid real-network/DB calls. The DB mock
 * is set up via `mockUserRoleLookup` to handle the `resolveOwnerRole` users
 * query shape (no innerJoin).
 */
describe('resolveOwnerLimitsForOwnerId (SPEC-211 T-007 AC-1.1)', () => {
    let mockBilling: {
        customers: { getByExternalId: ReturnType<typeof vi.fn> };
        subscriptions: { getByCustomerId: ReturnType<typeof vi.fn> };
        plans: { get: ReturnType<typeof vi.fn> };
        entitlements: { getByCustomerId: ReturnType<typeof vi.fn> };
        limits: { getByCustomerId: ReturnType<typeof vi.fn> };
    };

    beforeEach(() => {
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
        // Default: owner-basico fallback returns a plan with a finite chat limit.
        mockGetBySlug.mockResolvedValue({
            success: true,
            data: {
                slug: 'owner-basico',
                limits: {
                    [LimitKey.MAX_AI_CHAT_PER_MONTH]: 20,
                    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: 20
                },
                entitlements: []
            }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('AC-1.1.1 — owner with active subscription returns plan limits (+ overrides)', () => {
        it('resolves the limits map from the plan when the owner has an active subscription', async () => {
            // Arrange — owner-001 is a HOST with an active subscription to a plan
            // that grants MAX_AI_CHAT_PER_MONTH=100 and MAX_AI_TEXT_IMPROVE_PER_MONTH=100.
            // No customer-level overrides in this case.
            mockUserRoleLookup(RoleEnum.HOST);
            mockBilling.customers.getByExternalId.mockResolvedValue({ id: 'cust-001' });
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-001', status: 'active', planId: 'plan-owner-pro' }
            ]);
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-owner-pro',
                slug: 'owner-pro',
                entitlements: [],
                limits: {
                    [LimitKey.MAX_AI_CHAT_PER_MONTH]: 100,
                    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: 100
                }
            });
            mockBilling.limits.getByCustomerId.mockResolvedValue([]);

            // Act
            const result = await resolveOwnerLimitsForOwnerId('owner-001');

            // Assert — the limits map matches exactly what the plan declared.
            expect(result).toBeInstanceOf(Map);
            expect(result.get(LimitKey.MAX_AI_CHAT_PER_MONTH)).toBe(100);
            expect(result.get(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH)).toBe(100);
            // billing.limits.getByCustomerId was called for customer-level overrides.
            expect(mockBilling.limits.getByCustomerId).toHaveBeenCalledWith('cust-001');
        });
    });

    describe('AC-1.1.2 — owner with NO active subscription returns owner-basico fallback', () => {
        it('returns the owner-basico plan limits when the owner has no active subscription', async () => {
            // Arrange — owner has a customer row but all subscriptions are cancelled.
            // The fallback must be owner-basico (matching the HOST branch of loadEntitlements).
            mockUserRoleLookup(RoleEnum.HOST);
            mockBilling.customers.getByExternalId.mockResolvedValue({ id: 'cust-no-sub' });
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-expired', status: 'cancelled', planId: 'plan-owner-basico' }
            ]);
            // PlanService.getBySlug('owner-basico') returns a plan with a concrete limit.
            mockGetBySlug.mockResolvedValue({
                success: true,
                data: {
                    slug: 'owner-basico',
                    limits: {
                        [LimitKey.MAX_AI_CHAT_PER_MONTH]: 20,
                        [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: 20
                    },
                    entitlements: []
                }
            });

            // Act
            const result = await resolveOwnerLimitsForOwnerId('owner-no-sub');

            // Assert — the limits map reflects owner-basico defaults (not tourist-free).
            expect(result).toBeInstanceOf(Map);
            expect(result.get(LimitKey.MAX_AI_CHAT_PER_MONTH)).toBe(20);
            expect(result.get(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH)).toBe(20);
            // PlanService was consulted for the fallback.
            expect(mockGetBySlug).toHaveBeenCalledWith('owner-basico');
            // billing.plans.get was NOT called (no active subscription to look up).
            expect(mockBilling.plans.get).not.toHaveBeenCalled();
        });
    });

    describe('AC-1.1.3 — customer-level limit override wins over plan value', () => {
        it('merges customer-level limit overrides on top of plan limits (customer wins)', async () => {
            // Arrange — owner has an active subscription to owner-pro (chat=100)
            // but the operator has granted a customer-level override bumping chat to 500.
            mockUserRoleLookup(RoleEnum.HOST);
            mockBilling.customers.getByExternalId.mockResolvedValue({ id: 'cust-vip' });
            mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
                { id: 'sub-vip', status: 'active', planId: 'plan-owner-pro' }
            ]);
            mockBilling.plans.get.mockResolvedValue({
                id: 'plan-owner-pro',
                slug: 'owner-pro',
                entitlements: [],
                limits: {
                    [LimitKey.MAX_AI_CHAT_PER_MONTH]: 100,
                    [LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH]: 100
                }
            });
            // Customer-level override: chat bumped to 500, text-improve stays at plan value.
            mockBilling.limits.getByCustomerId.mockResolvedValue([
                { limitKey: LimitKey.MAX_AI_CHAT_PER_MONTH, maxValue: 500 }
            ]);

            // Act
            const result = await resolveOwnerLimitsForOwnerId('owner-vip');

            // Assert — customer override (500) wins over the plan value (100).
            expect(result).toBeInstanceOf(Map);
            expect(result.get(LimitKey.MAX_AI_CHAT_PER_MONTH)).toBe(500);
            // Plan-level value preserved for keys without a customer override.
            expect(result.get(LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH)).toBe(100);
            // Verify that both plan and customer lookups were performed.
            expect(mockBilling.plans.get).toHaveBeenCalledWith('plan-owner-pro');
            expect(mockBilling.limits.getByCustomerId).toHaveBeenCalledWith('cust-vip');
        });
    });
});
