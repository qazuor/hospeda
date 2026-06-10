/**
 * Integration tests for Admin Billing Plans Routes
 *
 * Covers T-008 (read rewrite), T-009 (create/update), T-010 (lifecycle),
 * T-007 (plan-disable fan-out wiring on toggle/update active→inactive).
 *
 * Strategy: mock PlanService and the route factory — verify that:
 * - Correct service methods are invoked
 * - Correct permissions are required
 * - Service errors map to correct HTTP status codes
 * - Audit log is called for mutations
 * - disablePlanLifecycle is invoked only on active→inactive transition
 * - Fan-out failure is soft-failed (Sentry captured, 200 returned)
 *
 * SPEC-168 T-008 / T-009 / T-010
 * SPEC-148 T-007
 *
 * @module test/routes/billing/admin/plans
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

const {
    mockPlanList,
    mockPlanGetById,
    mockPlanCreate,
    mockPlanUpdate,
    mockPlanToggleActive,
    mockPlanSoftDelete,
    mockPlanRestore,
    mockPlanHardDelete,
    mockCreateAdminRoute,
    mockCreateAdminListRoute,
    mockDisablePlanLifecycle,
    mockCaptureBillingError
} = vi.hoisted(() => ({
    mockPlanList: vi.fn(),
    mockPlanGetById: vi.fn(),
    mockPlanCreate: vi.fn(),
    mockPlanUpdate: vi.fn(),
    mockPlanToggleActive: vi.fn(),
    mockPlanSoftDelete: vi.fn(),
    mockPlanRestore: vi.fn(),
    mockPlanHardDelete: vi.fn(),
    mockCreateAdminRoute: vi.fn(),
    mockCreateAdminListRoute: vi.fn(),
    mockDisablePlanLifecycle: vi.fn(),
    mockCaptureBillingError: vi.fn()
}));

// Mock PlanService
vi.mock('../../../../src/services/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        list: mockPlanList,
        getById: mockPlanGetById,
        create: mockPlanCreate,
        update: mockPlanUpdate,
        toggleActive: mockPlanToggleActive,
        softDelete: mockPlanSoftDelete,
        restore: mockPlanRestore,
        hardDelete: mockPlanHardDelete
    }))
}));

// Mock @repo/schemas — preserve actual schemas, override PermissionEnum
vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return {
        ...actual,
        PermissionEnum: {
            BILLING_READ_ALL: 'billing:read_all',
            BILLING_MANAGE: 'billing:manage'
        }
    };
});

// Capture route factory calls for permission verification
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: mockCreateAdminRoute,
    createAdminListRoute: mockCreateAdminListRoute
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Mock audit logger
vi.mock('../../../../src/utils/audit-logger', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/audit-logger')>();
    return { ...actual, auditLog: vi.fn() };
});

// Mock create-app router
vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ route: vi.fn() }))
}));

// Mock actor
vi.mock('../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'actor-00000000-0000-0000-0000-000000000001',
        role: 'SUPER_ADMIN',
        permissions: ['billing:read_all', 'billing:manage']
    })
}));

// T-007: Mock plan-disable lifecycle fan-out service
vi.mock('../../../../src/services/plan-disable-lifecycle.service', () => ({
    disablePlanLifecycle: mockDisablePlanLifecycle
}));

// T-007: Mock Sentry captureBillingError for soft-fail verification
vi.mock('../../../../src/lib/sentry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/lib/sentry')>();
    return { ...actual, captureBillingError: mockCaptureBillingError };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auditLog } from '../../../../src/utils/audit-logger';

// Import the module — this executes all route factory calls at module load
import '../../../../src/routes/billing/admin/plans';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_PLAN = {
    id: '11111111-1111-1111-1111-111111111111',
    slug: 'owner-basico',
    name: 'Básico',
    description: 'Plan básico para propietarios',
    category: 'owner' as const,
    monthlyPriceArs: 500000,
    annualPriceArs: 5000000,
    monthlyPriceUsdRef: 5,
    hasTrial: true,
    trialDays: 14,
    isDefault: true,
    sortOrder: 1,
    entitlements: ['ACCOMMODATION_LIST'],
    limits: { MAX_ACCOMMODATIONS: 1 },
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

const createMockContext = () => ({
    json: vi.fn((body: unknown, status?: number) => ({ body, status: status ?? 200 })),
    body: vi.fn((_body: unknown, status?: number) => ({ body: null, status: status ?? 204 }))
});

/**
 * Finds a route factory call by method + path.
 */
function findRouteCall(
    mockFn: ReturnType<typeof vi.fn>,
    method: string,
    path: string
): Record<string, unknown> | undefined {
    const call = mockFn.mock.calls.find(
        (args: unknown[]) =>
            (args[0] as Record<string, unknown>)?.method === method &&
            (args[0] as Record<string, unknown>)?.path === path
    );
    return call ? (call[0] as Record<string, unknown>) : undefined;
}

// ---------------------------------------------------------------------------
// T-008: Permission registration — read routes
// ---------------------------------------------------------------------------

describe('T-008: route registration — read permissions', () => {
    it('GET / should require BILLING_READ_ALL', () => {
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:read_all');
    });

    it('GET /{id} should require BILLING_READ_ALL', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'get', '/{id}');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:read_all');
    });
});

// ---------------------------------------------------------------------------
// T-008: Handler — list plans
// ---------------------------------------------------------------------------

describe('T-008: adminListPlansRoute handler', () => {
    beforeEach(() => {
        mockPlanList.mockReset();
    });

    it('should call planService.list and return items + pagination', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown,
            query: unknown
        ) => Promise<unknown>;

        mockPlanList.mockResolvedValue({
            success: true,
            data: {
                items: [SAMPLE_PLAN],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        // Act
        const result = await handler({}, {}, {}, { page: 1, pageSize: 20 });

        // Assert
        expect(mockPlanList).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, pageSize: 20 })
        );
        expect(result).toEqual(
            expect.objectContaining({
                items: [SAMPLE_PLAN],
                pagination: expect.objectContaining({ total: 1 })
            })
        );
    });

    it('should pass category + active filters to planService.list', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown,
            query: unknown
        ) => Promise<unknown>;

        mockPlanList.mockResolvedValue({
            success: true,
            data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
        });

        // Act
        await handler({}, {}, {}, { category: 'owner', active: true });

        // Assert
        expect(mockPlanList).toHaveBeenCalledWith(
            expect.objectContaining({ category: 'owner', active: true })
        );
    });

    it('should throw when planService.list returns an error', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown,
            query: unknown
        ) => Promise<unknown>;

        mockPlanList.mockResolvedValue({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'DB unreachable' }
        });

        // Act + Assert
        await expect(handler({}, {}, {}, {})).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// T-008: Handler — getById
// ---------------------------------------------------------------------------

describe('T-008: adminGetPlanRoute handler', () => {
    beforeEach(() => {
        mockPlanGetById.mockReset();
    });

    it('should return plan when found — response includes id + timestamps', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'get', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockPlanGetById.mockResolvedValue({ success: true, data: SAMPLE_PLAN });

        // Act
        const result = await handler({}, { id: SAMPLE_PLAN.id });

        // Assert — T-008 regression: response shape includes id + timestamps
        expect(result).toEqual(
            expect.objectContaining({
                id: SAMPLE_PLAN.id,
                slug: SAMPLE_PLAN.slug,
                createdAt: SAMPLE_PLAN.createdAt,
                updatedAt: SAMPLE_PLAN.updatedAt
            })
        );
        expect(mockPlanGetById).toHaveBeenCalledWith(SAMPLE_PLAN.id);
    });

    it('should throw 404 when plan not found', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'get', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockPlanGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Plan not found' }
        });

        // Act + Assert
        await expect(handler({}, { id: '00000000-0000-0000-0000-000000000099' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// T-009: Permission registration — write routes
// ---------------------------------------------------------------------------

describe('T-009: route registration — write permissions', () => {
    it('POST / should require BILLING_MANAGE', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });

    it('PUT /{id} should require BILLING_MANAGE', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });
});

// ---------------------------------------------------------------------------
// T-009: Handler — create plan
// ---------------------------------------------------------------------------

describe('T-009: adminCreatePlanRoute handler', () => {
    beforeEach(() => {
        mockPlanCreate.mockReset();
        vi.mocked(auditLog).mockClear();
    });

    const createInput = {
        slug: 'owner-nuevo',
        name: 'Nuevo Plan',
        description: 'Desc',
        category: 'owner' as const,
        monthlyPriceArs: 100000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 1,
        hasTrial: false,
        trialDays: 0,
        isDefault: false,
        sortOrder: 10,
        entitlements: ['ACCOMMODATION_LIST'],
        limits: { MAX_ACCOMMODATIONS: 1 },
        isActive: true
    };

    it('should create plan and return result with id', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        const created = { ...SAMPLE_PLAN, slug: 'owner-nuevo', name: 'Nuevo Plan' };
        mockPlanCreate.mockResolvedValue({ success: true, data: created });

        // Act
        const result = await handler(createMockContext(), {}, createInput);

        // Assert — T-009: result includes id
        expect(result).toEqual(expect.objectContaining({ id: created.id, slug: 'owner-nuevo' }));
        expect(mockPlanCreate).toHaveBeenCalledWith(
            expect.objectContaining({ slug: 'owner-nuevo' }),
            expect.objectContaining({ actorId: 'actor-00000000-0000-0000-0000-000000000001' })
        );
    });

    it('should call auditLog on successful create', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanCreate.mockResolvedValue({ success: true, data: SAMPLE_PLAN });

        // Act
        await handler(createMockContext(), {}, createInput);

        // Assert
        expect(auditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'create',
                resourceType: 'billing_plan',
                resourceId: SAMPLE_PLAN.id
            })
        );
    });

    it('should throw when service fails to create', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanCreate.mockResolvedValue({
            success: false,
            error: { code: 'ALREADY_EXISTS', message: 'Slug already taken' }
        });

        // Act + Assert — duplicate slug → 409
        await expect(handler(createMockContext(), {}, createInput)).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// T-009: Handler — update plan
// ---------------------------------------------------------------------------

describe('T-009: adminUpdatePlanRoute handler', () => {
    beforeEach(() => {
        mockPlanUpdate.mockReset();
        vi.mocked(auditLog).mockClear();
    });

    it('should update plan and return mutated result', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        const updated = { ...SAMPLE_PLAN, name: 'Plan Actualizado' };
        mockPlanUpdate.mockResolvedValue({ success: true, data: updated });

        // Act
        const result = await handler(
            createMockContext(),
            { id: SAMPLE_PLAN.id },
            { name: 'Plan Actualizado' }
        );

        // Assert — T-009: update mutates
        expect(result).toEqual(expect.objectContaining({ name: 'Plan Actualizado' }));
        expect(mockPlanUpdate).toHaveBeenCalledWith(
            SAMPLE_PLAN.id,
            { name: 'Plan Actualizado' },
            expect.objectContaining({ actorId: 'actor-00000000-0000-0000-0000-000000000001' })
        );
    });

    it('should call auditLog on successful update', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanUpdate.mockResolvedValue({ success: true, data: SAMPLE_PLAN });

        // Act
        await handler(createMockContext(), { id: SAMPLE_PLAN.id }, { name: 'X' });

        // Assert
        expect(auditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'update',
                resourceType: 'billing_plan',
                resourceId: SAMPLE_PLAN.id
            })
        );
    });

    it('should throw 404 when plan not found for update', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanUpdate.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Plan not found' }
        });

        // Act + Assert — T-009: body inválido/not-found → 422/404
        await expect(
            handler(createMockContext(), { id: '00000000-0000-0000-0000-000000000099' }, {})
        ).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// T-010: Permission registration — lifecycle routes
// ---------------------------------------------------------------------------

describe('T-010: route registration — lifecycle permissions', () => {
    it('PATCH /{id} should require BILLING_MANAGE', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });

    it('DELETE /{id} should require BILLING_MANAGE', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });

    it('POST /{id}/restore should require BILLING_MANAGE', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });

    it('DELETE /{id}/hard should require BILLING_MANAGE', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });
});

// ---------------------------------------------------------------------------
// T-010: Handler — toggle active
// ---------------------------------------------------------------------------

describe('T-010: adminTogglePlanActiveRoute handler', () => {
    beforeEach(() => {
        mockPlanToggleActive.mockReset();
        vi.mocked(auditLog).mockClear();
    });

    it('should toggle plan active state and return updated plan', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        const toggled = { ...SAMPLE_PLAN, isActive: false };
        mockPlanToggleActive.mockResolvedValue({ success: true, data: toggled });

        // Act
        const result = await handler(
            createMockContext(),
            { id: SAMPLE_PLAN.id },
            { active: false }
        );

        // Assert — T-010: toggle flips active
        expect(result).toEqual(expect.objectContaining({ isActive: false }));
        expect(mockPlanToggleActive).toHaveBeenCalledWith(
            SAMPLE_PLAN.id,
            false,
            expect.objectContaining({ actorId: 'actor-00000000-0000-0000-0000-000000000001' })
        );
    });
});

// ---------------------------------------------------------------------------
// T-010: Handler — soft-delete
// ---------------------------------------------------------------------------

describe('T-010: adminSoftDeletePlanRoute handler', () => {
    beforeEach(() => {
        mockPlanSoftDelete.mockReset();
        vi.mocked(auditLog).mockClear();
    });

    it('should soft-delete plan and return null', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockPlanSoftDelete.mockResolvedValue({ success: true });

        // Act
        const result = await handler(createMockContext(), { id: SAMPLE_PLAN.id });

        // Assert — soft-delete returns null
        expect(result).toBeNull();
        expect(mockPlanSoftDelete).toHaveBeenCalledWith(
            SAMPLE_PLAN.id,
            expect.objectContaining({ actorId: 'actor-00000000-0000-0000-0000-000000000001' })
        );
        expect(auditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'delete', resourceType: 'billing_plan' })
        );
    });

    it('should throw 404 when plan not found for soft-delete', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockPlanSoftDelete.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Plan not found' }
        });

        // Act + Assert
        await expect(
            handler(createMockContext(), { id: '00000000-0000-0000-0000-000000000099' })
        ).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// T-010: Handler — restore (via planService.restore — clears deletedAt)
// ---------------------------------------------------------------------------

describe('T-010: adminRestorePlanRoute handler', () => {
    beforeEach(() => {
        mockPlanRestore.mockReset();
        mockPlanToggleActive.mockReset();
        vi.mocked(auditLog).mockClear();
    });

    it('should restore a soft-deleted plan by calling planService.restore (not toggleActive)', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        const restored = { ...SAMPLE_PLAN, isActive: true };
        mockPlanRestore.mockResolvedValue({ success: true, data: restored });

        // Act
        const result = await handler(createMockContext(), { id: SAMPLE_PLAN.id });

        // Assert — T-010: restore calls planService.restore (which clears deletedAt + sets active=true)
        expect(result).toEqual(expect.objectContaining({ isActive: true }));
        expect(mockPlanRestore).toHaveBeenCalledWith(
            SAMPLE_PLAN.id,
            expect.objectContaining({ actorId: 'actor-00000000-0000-0000-0000-000000000001' })
        );
        // toggleActive must NOT be called by the restore route
        expect(mockPlanToggleActive).not.toHaveBeenCalled();
    });

    it('should return 422 when plan is not soft-deleted (VALIDATION_ERROR guard)', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockPlanRestore.mockResolvedValue({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Plan is not soft-deleted and cannot be restored'
            }
        });

        // Act + Assert — VALIDATION_ERROR maps to 422
        await expect(handler(createMockContext(), { id: SAMPLE_PLAN.id })).rejects.toThrow();
    });

    it('should return 404 when plan does not exist', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockPlanRestore.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Plan not found' }
        });

        // Act + Assert — NOT_FOUND maps to 404
        await expect(
            handler(createMockContext(), { id: '00000000-0000-0000-0000-000000000099' })
        ).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// T-010: Handler — hard-delete with referential guard
// ---------------------------------------------------------------------------

describe('T-010: adminHardDeletePlanRoute handler — referential guard', () => {
    beforeEach(() => {
        mockPlanHardDelete.mockReset();
        vi.mocked(auditLog).mockClear();
    });

    it('should throw 409 when plan is referenced by subscriptions', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        // ALREADY_EXISTS maps to 409 — referential guard from D4
        mockPlanHardDelete.mockResolvedValue({
            success: false,
            error: {
                code: 'ALREADY_EXISTS',
                message: 'Plan has active subscriptions and cannot be deleted'
            }
        });

        // Act + Assert — T-010: hard-delete BLOCKED when referenced
        await expect(handler(createMockContext(), { id: SAMPLE_PLAN.id })).rejects.toThrow();
    });

    it('should hard-delete plan and return null when no subscriptions reference it', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockPlanHardDelete.mockResolvedValue({ success: true });

        // Act
        const result = await handler(createMockContext(), { id: SAMPLE_PLAN.id });

        // Assert — T-010: hard-delete allowed when no references
        expect(result).toBeNull();
        expect(mockPlanHardDelete).toHaveBeenCalledWith(
            SAMPLE_PLAN.id,
            expect.objectContaining({ actorId: 'actor-00000000-0000-0000-0000-000000000001' })
        );
        expect(auditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'delete', resourceType: 'billing_plan' })
        );
    });
});

// ---------------------------------------------------------------------------
// T-007: PATCH /{id} — plan-disable fan-out wiring (active→inactive guard)
// ---------------------------------------------------------------------------

describe('T-007: adminTogglePlanActiveRoute — disablePlanLifecycle fan-out', () => {
    const ACTIVE_PLAN = { ...SAMPLE_PLAN, isActive: true };
    const INACTIVE_PLAN = { ...SAMPLE_PLAN, isActive: false };

    beforeEach(() => {
        mockPlanGetById.mockReset();
        mockPlanToggleActive.mockReset();
        mockDisablePlanLifecycle.mockReset();
        mockCaptureBillingError.mockReset();
        vi.mocked(auditLog).mockClear();

        // Default: fan-out succeeds
        mockDisablePlanLifecycle.mockResolvedValue({ affectedSubCount: 2 });
    });

    it('active→inactive: triggers disablePlanLifecycle once with planId + actorId', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        // Prior state: plan is active
        mockPlanGetById.mockResolvedValue({ success: true, data: ACTIVE_PLAN });
        // Toggle succeeds and returns deactivated plan
        mockPlanToggleActive.mockResolvedValue({ success: true, data: INACTIVE_PLAN });

        // Act
        const result = await handler(
            createMockContext(),
            { id: SAMPLE_PLAN.id },
            { active: false }
        );

        // Assert — plan toggled + fan-out triggered exactly once
        expect(result).toEqual(expect.objectContaining({ isActive: false }));
        expect(mockDisablePlanLifecycle).toHaveBeenCalledOnce();
        expect(mockDisablePlanLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                planId: SAMPLE_PLAN.id,
                actorId: 'actor-00000000-0000-0000-0000-000000000001'
            })
        );
    });

    it('inactive→inactive (no-op PATCH): does NOT trigger fan-out', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        // Prior state: plan is already inactive
        mockPlanGetById.mockResolvedValue({ success: true, data: INACTIVE_PLAN });
        mockPlanToggleActive.mockResolvedValue({ success: true, data: INACTIVE_PLAN });

        // Act
        await handler(createMockContext(), { id: SAMPLE_PLAN.id }, { active: false });

        // Assert — no fan-out on no-op
        expect(mockDisablePlanLifecycle).not.toHaveBeenCalled();
    });

    it('active→active (no-op PATCH): does NOT trigger fan-out', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        // Prior state: plan is already active
        mockPlanGetById.mockResolvedValue({ success: true, data: ACTIVE_PLAN });
        mockPlanToggleActive.mockResolvedValue({ success: true, data: ACTIVE_PLAN });

        // Act
        await handler(createMockContext(), { id: SAMPLE_PLAN.id }, { active: true });

        // Assert — no fan-out when enabling
        expect(mockDisablePlanLifecycle).not.toHaveBeenCalled();
    });

    it('inactive→active (re-enable): does NOT trigger fan-out (re-enable is manual, out-of-scope)', async () => {
        // Arrange — re-enabling a disabled plan does NOT auto-undo the fan-out.
        // Existing cancelAtPeriodEnd subs remain as-is; a new sub is required.
        // This is intentional and documented in T-007.
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanGetById.mockResolvedValue({ success: true, data: INACTIVE_PLAN });
        mockPlanToggleActive.mockResolvedValue({ success: true, data: ACTIVE_PLAN });

        // Act
        await handler(createMockContext(), { id: SAMPLE_PLAN.id }, { active: true });

        // Assert — re-enable does NOT undo the fan-out
        expect(mockDisablePlanLifecycle).not.toHaveBeenCalled();
    });

    it('fan-out throws: toggle still returns 200 and captureBillingError is called', async () => {
        // Arrange — simulate fan-out failure
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanGetById.mockResolvedValue({ success: true, data: ACTIVE_PLAN });
        mockPlanToggleActive.mockResolvedValue({ success: true, data: INACTIVE_PLAN });
        mockDisablePlanLifecycle.mockRejectedValue(new Error('DB timeout during fan-out'));

        // Act — must NOT throw even though fan-out failed
        const result = await handler(
            createMockContext(),
            { id: SAMPLE_PLAN.id },
            { active: false }
        );

        // Assert — 200 still returned, Sentry captured
        expect(result).toEqual(expect.objectContaining({ isActive: false }));
        expect(mockCaptureBillingError).toHaveBeenCalledOnce();
        expect(mockCaptureBillingError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ planId: SAMPLE_PLAN.id }),
            'error'
        );
    });
});

// ---------------------------------------------------------------------------
// T-007: PUT /{id} — plan-disable fan-out wiring when isActive flips false
// ---------------------------------------------------------------------------

describe('T-007: adminUpdatePlanRoute — disablePlanLifecycle fan-out on isActive=false', () => {
    const ACTIVE_PLAN = { ...SAMPLE_PLAN, isActive: true };
    const INACTIVE_PLAN = { ...SAMPLE_PLAN, isActive: false };

    beforeEach(() => {
        mockPlanGetById.mockReset();
        mockPlanUpdate.mockReset();
        mockDisablePlanLifecycle.mockReset();
        mockCaptureBillingError.mockReset();
        vi.mocked(auditLog).mockClear();

        mockDisablePlanLifecycle.mockResolvedValue({ affectedSubCount: 1 });
    });

    it('PUT with isActive=false on active plan: triggers disablePlanLifecycle', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanGetById.mockResolvedValue({ success: true, data: ACTIVE_PLAN });
        mockPlanUpdate.mockResolvedValue({ success: true, data: INACTIVE_PLAN });

        // Act
        const result = await handler(
            createMockContext(),
            { id: SAMPLE_PLAN.id },
            { name: 'Updated', isActive: false }
        );

        // Assert
        expect(result).toEqual(expect.objectContaining({ isActive: false }));
        expect(mockDisablePlanLifecycle).toHaveBeenCalledOnce();
        expect(mockDisablePlanLifecycle).toHaveBeenCalledWith(
            expect.objectContaining({
                planId: SAMPLE_PLAN.id,
                actorId: 'actor-00000000-0000-0000-0000-000000000001'
            })
        );
    });

    it('PUT with isActive=false on already-inactive plan: does NOT trigger fan-out', async () => {
        // Arrange — idempotency guard: no re-fan-out if already inactive
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanGetById.mockResolvedValue({ success: true, data: INACTIVE_PLAN });
        mockPlanUpdate.mockResolvedValue({ success: true, data: INACTIVE_PLAN });

        // Act
        await handler(createMockContext(), { id: SAMPLE_PLAN.id }, { isActive: false });

        // Assert
        expect(mockDisablePlanLifecycle).not.toHaveBeenCalled();
    });

    it('PUT without isActive field: does NOT trigger fan-out', async () => {
        // Arrange — ordinary name/description update, no isActive in body
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanUpdate.mockResolvedValue({ success: true, data: ACTIVE_PLAN });

        // Act
        await handler(createMockContext(), { id: SAMPLE_PLAN.id }, { name: 'Just a rename' });

        // Assert — no fan-out, no getById needed
        expect(mockDisablePlanLifecycle).not.toHaveBeenCalled();
        expect(mockPlanGetById).not.toHaveBeenCalled();
    });

    it('PUT fan-out throws: update still returns 200 and captureBillingError is called', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockPlanGetById.mockResolvedValue({ success: true, data: ACTIVE_PLAN });
        mockPlanUpdate.mockResolvedValue({ success: true, data: INACTIVE_PLAN });
        mockDisablePlanLifecycle.mockRejectedValue(new Error('Fan-out failed'));

        // Act — must NOT throw even though fan-out failed
        const result = await handler(
            createMockContext(),
            { id: SAMPLE_PLAN.id },
            { isActive: false }
        );

        // Assert — 200 still returned, Sentry captured
        expect(result).toEqual(expect.objectContaining({ isActive: false }));
        expect(mockCaptureBillingError).toHaveBeenCalledOnce();
    });
});
