/**
 * Parity / regression test — entitlement middleware buildHostDraftDefaultsResult
 * cutover (SPEC-192 T-024).
 *
 * Verifies that:
 * - `buildHostDraftDefaultsResult` resolves entitlements via PlanService.getBySlug
 *   (DB-backed) instead of the static getPlanBySlug config
 * - The resolved result is memoized: PlanService is called exactly once across
 *   two sequential invocations within the TTL window
 * - When PlanService returns NOT_FOUND the function falls back to tourist-free
 *   defaults (same defensive behavior as before) and does NOT memoize the miss
 * - The existing entitlement middleware tests are NOT modified — this file adds
 *   alongside them
 *
 * @module test/middlewares/entitlement-plan.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn()
}));

// ─── Mock PlanService ─────────────────────────────────────────────────────────

vi.mock('../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: vi.fn(),
        getBySlug: mockGetBySlug
    }))
}));

// ─── Mock @repo/billing ───────────────────────────────────────────────────────
// getDefaultEntitlements is needed for the tourist-free fallback path.
// getPlanBySlug is intentionally absent — any residual call would surface a TypeError.

vi.mock('@repo/billing', () => ({
    EntitlementKey: {},
    LimitKey: {},
    getDefaultEntitlements: vi.fn(() => ({
        entitlements: ['SAVE_FAVORITES'],
        limits: [{ key: 'max_favorites', value: 5 }]
    })),
    getUnlimitedEntitlements: vi.fn(() => ({
        entitlements: ['SAVE_FAVORITES', 'WRITE_REVIEWS'],
        limits: [{ key: 'max_favorites', value: -1 }]
    }))
}));

// ─── Mock @repo/service-core ──────────────────────────────────────────────────

vi.mock('@repo/service-core', () => ({
    RoleEnum: {
        HOST: 'host',
        USER: 'user',
        SUPER_ADMIN: 'super_admin',
        ADMIN: 'admin',
        EDITOR: 'editor',
        CLIENT_MANAGER: 'client_manager',
        GUEST: 'guest'
    }
}));

// ─── Mock @sentry/node ────────────────────────────────────────────────────────

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

// ─── Mock logger ──────────────────────────────────────────────────────────────

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ─── Mock actor util ──────────────────────────────────────────────────────────

vi.mock('../../src/utils/actor', () => ({
    isGuestActor: vi.fn(() => false)
}));

// ─── Mock QZPay billing (not used in these tests but imported by the module) ──

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn(() => null)
}));

// ─── Imports (after vi.mock declarations) ────────────────────────────────────

import {
    clearHostDraftDefaultsCache,
    entitlementMiddleware
} from '../../src/middlewares/entitlement';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const STUB_OWNER_BASICO = {
    id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico para anfitriones',
    category: 'owner' as const,
    monthlyPriceArs: 500_000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: true,
    trialDays: 14,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['CAN_LIST_ACCOMMODATION', 'CAN_EDIT_ACCOMMODATION'],
    limits: { max_accommodations: 1 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const PLAN_FOUND = { success: true as const, data: STUB_OWNER_BASICO };
const PLAN_NOT_FOUND = {
    success: false as const,
    error: { code: 'NOT_FOUND', message: 'Plan not found: owner-basico' }
};

// ─── Context factory ──────────────────────────────────────────────────────────

type ContextValues = Record<string, unknown>;

function makeCtx(values: ContextValues = {}) {
    const store = new Map<string, unknown>([
        ['billingEnabled', false], // billing disabled triggers role-based fallback path
        ['billingCustomerId', null],
        ...Object.entries(values)
    ]);
    return {
        get: (key: string) => store.get(key),
        set: (key: string, val: unknown) => store.set(key, val)
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('entitlement middleware — host-draft plan cutover (SPEC-192 T-024)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Always clear the memo so each test starts fresh
        clearHostDraftDefaultsCache();
    });

    // =========================================================================
    // DB-backed resolution
    // =========================================================================

    describe('resolves via PlanService (DB-backed)', () => {
        it('should call PlanService.getBySlug("owner-basico") for HOST actors with no billing customer', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            const ctx = makeCtx({
                actor: { id: 'host-user', role: 'host', permissions: [], email: 'host@test.com' }
            });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert
            expect(mockGetBySlug).toHaveBeenCalledOnce();
            expect(mockGetBySlug).toHaveBeenCalledWith('owner-basico');
        });

        it('should set entitlements from the DB plan for HOST actors', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            const ctx = makeCtx({
                actor: { id: 'host-user', role: 'host', permissions: [], email: 'host@test.com' }
            });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert — entitlements from DB plan
            const entitlements = ctx.get('userEntitlements') as Set<string>;
            expect(entitlements.has('CAN_LIST_ACCOMMODATION')).toBe(true);
            expect(entitlements.has('CAN_EDIT_ACCOMMODATION')).toBe(true);
        });

        it('should set limits from the DB plan (Record<string,number> converted to Map)', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            const ctx = makeCtx({
                actor: { id: 'host-user', role: 'host', permissions: [], email: 'host@test.com' }
            });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert — limits from DB plan converted to Map
            const limits = ctx.get('userLimits') as Map<string, number>;
            expect(limits.get('max_accommodations')).toBe(1);
        });
    });

    // =========================================================================
    // Memoization
    // =========================================================================

    describe('memoization', () => {
        it('should call PlanService.getBySlug exactly once across two HOST requests within TTL', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            const makeHostCtx = () =>
                makeCtx({
                    actor: {
                        id: 'host-user',
                        role: 'host',
                        permissions: [],
                        email: 'host@test.com'
                    }
                });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act — two sequential requests
            await middleware(makeHostCtx() as never, next);
            await middleware(makeHostCtx() as never, next);

            // Assert — PlanService called only once (memo hit on second request)
            expect(mockGetBySlug).toHaveBeenCalledOnce();
        });

        it('should re-query PlanService after clearHostDraftDefaultsCache()', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue(PLAN_FOUND);

            const makeHostCtx = () =>
                makeCtx({
                    actor: {
                        id: 'host-user',
                        role: 'host',
                        permissions: [],
                        email: 'host@test.com'
                    }
                });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act — first request populates memo
            await middleware(makeHostCtx() as never, next);
            expect(mockGetBySlug).toHaveBeenCalledOnce();

            // Invalidate memo
            clearHostDraftDefaultsCache();

            // Second request after invalidation should re-query
            await middleware(makeHostCtx() as never, next);
            expect(mockGetBySlug).toHaveBeenCalledTimes(2);
        });
    });

    // =========================================================================
    // NOT_FOUND fallback
    // =========================================================================

    describe('fallback to tourist-free defaults on NOT_FOUND', () => {
        it('should fall back to tourist-free defaults when owner-basico is NOT_FOUND', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue(PLAN_NOT_FOUND);

            const ctx = makeCtx({
                actor: { id: 'host-user', role: 'host', permissions: [], email: 'host@test.com' }
            });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert — tourist-free fallback entitlements applied (from mocked getDefaultEntitlements)
            const entitlements = ctx.get('userEntitlements') as Set<string>;
            expect(entitlements.has('SAVE_FAVORITES')).toBe(true);
            // owner-basico entitlement should NOT be present
            expect(entitlements.has('CAN_LIST_ACCOMMODATION')).toBe(false);
        });

        it('should NOT memoize the NOT_FOUND result — next request retries PlanService', async () => {
            // Arrange — first call: NOT_FOUND; second call: found
            mockGetBySlug.mockResolvedValueOnce(PLAN_NOT_FOUND).mockResolvedValueOnce(PLAN_FOUND);

            const makeHostCtx = () =>
                makeCtx({
                    actor: {
                        id: 'host-user',
                        role: 'host',
                        permissions: [],
                        email: 'host@test.com'
                    }
                });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act
            await middleware(makeHostCtx() as never, next);
            await middleware(makeHostCtx() as never, next);

            // Assert — PlanService called twice (miss was not cached)
            expect(mockGetBySlug).toHaveBeenCalledTimes(2);
        });
    });

    // =========================================================================
    // Non-HOST actors are unaffected
    // =========================================================================

    describe('non-HOST actors', () => {
        it('should NOT call PlanService for USER actors (uses tourist-free defaults)', async () => {
            // Arrange
            const ctx = makeCtx({
                actor: { id: 'regular-user', role: 'user', permissions: [], email: 'user@test.com' }
            });
            const next = vi.fn().mockResolvedValue(undefined);
            const middleware = entitlementMiddleware();

            // Act
            await middleware(ctx as never, next);

            // Assert — no DB call for USER role
            expect(mockGetBySlug).not.toHaveBeenCalled();
        });
    });
});
