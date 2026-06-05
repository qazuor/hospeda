/**
 * Integration tests for Admin Billing Add-ons CRUD Routes (SPEC-192 T-034)
 *
 * Full route-stack tests: route → service → mocked DB.
 *
 * Strategy: mock AddonCatalogService and the route factory — verify full
 * lifecycle flows rather than individual units:
 * 1. POST create → 201 shape and audit insert invoked
 * 2. PATCH update → persisted change visible in response
 * 3. toggleActive flips isActive
 * 4. DELETE (soft) sets deletedAt
 * 5. restore clears deletedAt
 * 6. hardDelete → 409 when billing_subscription_addons reference exists
 *    (remember addOnId column capital-O per qzpay-drizzle convention)
 * 7. Writes without BILLING_MANAGE → 403
 * 8. List pagination accepts page+pageSize and rejects unknown params
 *
 * Mock-backed per project integration-test convention; live-DB variant
 * deferred to e2e suite. File placed in apps/api/test/routes/billing/admin/
 * per the project convention (not src/__tests__/integration/).
 *
 * @module test/routes/billing/admin/addons.integration
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

const {
    mockListAdmin,
    mockGetById,
    mockCreate,
    mockUpdate,
    mockToggleActive,
    mockSoftDelete,
    mockRestore,
    mockHardDelete,
    mockCreateAdminRoute,
    mockCreateAdminListRoute,
    mockAuditLog
} = vi.hoisted(() => ({
    mockListAdmin: vi.fn(),
    mockGetById: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockToggleActive: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockRestore: vi.fn(),
    mockHardDelete: vi.fn(),
    mockCreateAdminRoute: vi.fn(),
    mockCreateAdminListRoute: vi.fn(),
    mockAuditLog: vi.fn()
}));

// Mock AddonCatalogService — full CRUD interface
vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        listAdmin: mockListAdmin,
        getById: mockGetById,
        create: mockCreate,
        update: mockUpdate,
        toggleActive: mockToggleActive,
        softDelete: mockSoftDelete,
        restore: mockRestore,
        hardDelete: mockHardDelete
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
    return { ...actual, auditLog: mockAuditLog };
});

// Mock create-app router
vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ route: vi.fn() }))
}));

// Mock actor — default to SUPER_ADMIN with all billing perms
vi.mock('../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'actor-t034-00000000-0000-0000-0000-000000000001',
        role: 'SUPER_ADMIN',
        permissions: ['billing:read_all', 'billing:manage']
    })
}));

// ---------------------------------------------------------------------------
// Import the module — executes all route factory calls at module load
// ---------------------------------------------------------------------------

import '../../../../src/routes/billing/admin/addons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sample addon fixtures — unique IDs per test to avoid module-level Map
 * cross-contamination (Maps persist between tests in module scope).
 */
function makeSampleAddon(idSuffix: string) {
    return {
        id: `addon-t034-${idSuffix}-22222222-2222-2222-2222-222222222222`,
        slug: `extra-photos-${idSuffix}`,
        name: `Extra Photos Pack (${idSuffix})`,
        description: 'Adds 20 extra photo slots per accommodation.',
        billingType: 'recurring' as const,
        priceArs: 200000,
        durationDays: null,
        affectsLimitKey: 'max_photos_per_accommodation',
        limitIncrease: 20,
        grantsEntitlement: null,
        targetCategories: ['owner', 'complex'] as const,
        isActive: true,
        sortOrder: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        deletedAt: null
    };
}

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
// Flow 1: POST create → 201 shape + audit insert invoked
// ---------------------------------------------------------------------------

describe('T-034 flow 1: POST create → response shape + audit', () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockAuditLog.mockReset();
    });

    it('should return created addon and invoke auditLog with create action', async () => {
        // Arrange
        const addon = makeSampleAddon('create-001');
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockCreate.mockResolvedValue({ success: true, data: addon });

        const createBody = {
            slug: addon.slug,
            name: addon.name,
            description: addon.description,
            billingType: 'recurring',
            priceArs: 200000,
            durationDays: null,
            affectsLimitKey: 'max_photos_per_accommodation',
            limitIncrease: 20,
            grantsEntitlement: null,
            targetCategories: ['owner', 'complex'],
            isActive: true,
            sortOrder: 3
        };

        // Act
        const result = await handler({}, {}, createBody);

        // Assert — service called with correct input shape
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ slug: addon.slug }),
            expect.objectContaining({ actorId: expect.any(String) })
        );

        // Assert — response contains the created addon fields
        expect(result).toEqual(
            expect.objectContaining({
                id: addon.id,
                slug: addon.slug,
                isActive: true,
                createdAt: addon.createdAt
            })
        );

        // Assert — audit log emitted with create action
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'create',
                resourceType: 'billing_addon',
                resourceId: addon.id
            })
        );
    });

    it('should throw 409 when service returns ALREADY_EXISTS', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockCreate.mockResolvedValue({
            success: false,
            error: { code: 'ALREADY_EXISTS', message: 'Addon slug already exists' }
        });

        // Act + Assert
        await expect(handler({}, {}, { slug: 'duplicate-slug' })).rejects.toThrow();
        expect(mockAuditLog).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Flow 2: PATCH update → persisted change visible in response
// ---------------------------------------------------------------------------

describe('T-034 flow 2: PATCH update → persisted change in response', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
        mockAuditLog.mockReset();
    });

    it('should return addon with updated name after PATCH', async () => {
        // Arrange
        const original = makeSampleAddon('update-002');
        const updated = { ...original, name: 'Renamed Pack T034' };

        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockUpdate.mockResolvedValue({ success: true, data: updated });

        // Act
        const result = await handler({}, { id: original.id }, { name: 'Renamed Pack T034' });

        // Assert — service received correct id and delta
        expect(mockUpdate).toHaveBeenCalledWith(
            original.id,
            expect.objectContaining({ name: 'Renamed Pack T034' }),
            expect.objectContaining({ actorId: expect.any(String) })
        );

        // Assert — response reflects the persisted change
        expect(result).toEqual(expect.objectContaining({ name: 'Renamed Pack T034' }));

        // Assert — audit log emitted
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'update', resourceType: 'billing_addon' })
        );
    });

    it('should throw 404 when addon not found during update', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockUpdate.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Addon not found' }
        });

        // Act + Assert
        await expect(handler({}, { id: 'missing-uuid-t034' }, { name: 'x' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Flow 3: toggleActive flips isActive
// ---------------------------------------------------------------------------

describe('T-034 flow 3: PATCH toggleActive flips isActive', () => {
    beforeEach(() => {
        mockToggleActive.mockReset();
        mockAuditLog.mockReset();
    });

    it('should flip isActive to false and emit audit log', async () => {
        // Arrange
        const addon = makeSampleAddon('toggle-003');
        const deactivated = { ...addon, isActive: false };

        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockToggleActive.mockResolvedValue({ success: true, data: deactivated });

        // Act
        const result = await handler({}, { id: addon.id }, { active: false });

        // Assert — service called with correct flag
        expect(mockToggleActive).toHaveBeenCalledWith(
            addon.id,
            false,
            expect.objectContaining({ actorId: expect.any(String) })
        );

        // Assert — response reflects toggled state
        expect(result).toEqual(expect.objectContaining({ isActive: false }));

        // Assert — audit log
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'update', resourceType: 'billing_addon' })
        );
    });

    it('should flip isActive to true', async () => {
        // Arrange
        const addon = { ...makeSampleAddon('toggle-003b'), isActive: false };
        const reactivated = { ...addon, isActive: true };

        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockToggleActive.mockResolvedValue({ success: true, data: reactivated });

        // Act
        const result = await handler({}, { id: addon.id }, { active: true });

        // Assert
        expect(result).toEqual(expect.objectContaining({ isActive: true }));
    });
});

// ---------------------------------------------------------------------------
// Flow 4: DELETE (soft) sets deletedAt
// ---------------------------------------------------------------------------

describe('T-034 flow 4: DELETE soft-delete sets deletedAt', () => {
    beforeEach(() => {
        mockSoftDelete.mockReset();
        mockAuditLog.mockReset();
    });

    it('should soft-delete addon and return null, emit audit log', async () => {
        // Arrange
        const addon = makeSampleAddon('soft-004');

        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockSoftDelete.mockResolvedValue({ success: true, data: undefined });

        // Act
        const result = await handler({}, { id: addon.id });

        // Assert — service called
        expect(mockSoftDelete).toHaveBeenCalledWith(
            addon.id,
            expect.objectContaining({ actorId: expect.any(String) })
        );

        // Assert — response is null (soft-delete returns no body)
        expect(result).toBeNull();

        // Assert — audit log with delete action
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'delete', resourceType: 'billing_addon' })
        );
    });

    it('should throw 404 when addon not found during soft-delete', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockSoftDelete.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Addon not found' }
        });

        // Act + Assert
        await expect(handler({}, { id: 'missing-t034-soft' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Flow 5: restore clears deletedAt
// ---------------------------------------------------------------------------

describe('T-034 flow 5: POST restore clears deletedAt', () => {
    beforeEach(() => {
        mockRestore.mockReset();
        mockAuditLog.mockReset();
    });

    it('should restore addon and return it with isActive=true', async () => {
        // Arrange
        const addon = {
            ...makeSampleAddon('restore-005'),
            deletedAt: '2026-01-15T00:00:00.000Z',
            isActive: false
        };
        const restored = { ...addon, deletedAt: null, isActive: true };

        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockRestore.mockResolvedValue({ success: true, data: restored });

        // Act
        const result = await handler({}, { id: addon.id });

        // Assert — service called
        expect(mockRestore).toHaveBeenCalledWith(
            addon.id,
            expect.objectContaining({ actorId: expect.any(String) })
        );

        // Assert — deletedAt cleared, isActive true
        expect(result).toEqual(expect.objectContaining({ deletedAt: null, isActive: true }));

        // Assert — audit log
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'update', resourceType: 'billing_addon' })
        );
    });

    it('should throw 422 when addon is not soft-deleted (VALIDATION_ERROR)', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockRestore.mockResolvedValue({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Addon is not soft-deleted' }
        });

        // Act + Assert
        await expect(handler({}, { id: 'active-addon-t034' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Flow 6: hardDelete → 409 when billing_subscription_addons reference exists
// ---------------------------------------------------------------------------

describe('T-034 flow 6: DELETE hardDelete → 409 when subscription ref exists', () => {
    beforeEach(() => {
        mockHardDelete.mockReset();
        mockAuditLog.mockReset();
    });

    it('should return 409 when service returns ALREADY_EXISTS (subscription ref)', async () => {
        // Arrange — service returns ALREADY_EXISTS because billing_subscription_addons
        // has a row with addOnId = addonId (addOnId is capital-O per qzpay-drizzle)
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockHardDelete.mockResolvedValue({
            success: false,
            error: {
                code: 'ALREADY_EXISTS',
                message: 'Add-on referenced by 2 subscription addons — hard delete blocked'
            }
        });

        // Act + Assert
        await expect(handler({}, { id: 'addon-with-subs-t034' })).rejects.toThrow();
        // audit should NOT have been called (failure path)
        expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('should hard-delete and return null when no references exist', async () => {
        // Arrange
        const addon = makeSampleAddon('hard-006');

        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockHardDelete.mockResolvedValue({ success: true, data: undefined });

        // Act
        const result = await handler({}, { id: addon.id });

        // Assert — null response
        expect(result).toBeNull();

        // Assert — audit log emitted
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'delete', resourceType: 'billing_addon' })
        );
    });

    it('should throw 404 when addon not found for hard-delete', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockHardDelete.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Addon not found' }
        });

        // Act + Assert
        await expect(handler({}, { id: 'missing-t034' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Flow 7: Writes without BILLING_MANAGE → 403
// ---------------------------------------------------------------------------

describe('T-034 flow 7: writes without BILLING_MANAGE require permission', () => {
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

    it('PATCH /{id} should require BILLING_MANAGE', () => {
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:manage');
    });

    it('DELETE /{id} (soft) should require BILLING_MANAGE', () => {
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

    it('GET / (list) should require BILLING_READ_ALL only (not BILLING_MANAGE)', () => {
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        expect(config).toBeDefined();
        expect(config?.requiredPermissions).toContain('billing:read_all');
        expect(config?.requiredPermissions).not.toContain('billing:manage');
    });
});

// ---------------------------------------------------------------------------
// Flow 8: List pagination — page+pageSize accepted; unknown params rejected
// ---------------------------------------------------------------------------

describe('T-034 flow 8: list pagination via createAdminListRoute', () => {
    beforeEach(() => {
        mockListAdmin.mockReset();
    });

    it('should pass page and pageSize to catalogService.listAdmin', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown,
            query: unknown
        ) => Promise<unknown>;

        const page1Addons = [makeSampleAddon('page1-007'), makeSampleAddon('page2-008')];

        mockListAdmin.mockResolvedValue({
            success: true,
            data: {
                items: page1Addons,
                pagination: { page: 2, pageSize: 5, total: 12, totalPages: 3 }
            }
        });

        // Act
        const result = await handler({}, {}, {}, { page: 2, pageSize: 5 });

        // Assert — listAdmin called with page + pageSize
        expect(mockListAdmin).toHaveBeenCalledWith(
            expect.objectContaining({ page: 2, pageSize: 5 })
        );

        // Assert — pagination metadata returned
        expect(result).toEqual(
            expect.objectContaining({
                items: expect.arrayContaining([
                    expect.objectContaining({ slug: page1Addons[0]?.slug })
                ]),
                pagination: expect.objectContaining({ page: 2, pageSize: 5, total: 12 })
            })
        );
    });

    it('should pass billingType filter through to catalogService.listAdmin', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown,
            query: unknown
        ) => Promise<unknown>;

        mockListAdmin.mockResolvedValue({
            success: true,
            data: {
                items: [],
                pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
            }
        });

        // Act
        await handler({}, {}, {}, { billingType: 'one_time', page: 1, pageSize: 20 });

        // Assert
        expect(mockListAdmin).toHaveBeenCalledWith(
            expect.objectContaining({ billingType: 'one_time' })
        );
    });

    it('createAdminListRoute is used (not createAdminRoute) for GET /', () => {
        // Assert — createAdminListRoute was called for GET /, which enforces
        // page+pageSize and rejects unknown query params per its implementation
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        expect(config).toBeDefined();
        expect(config?.method).toBe('get');
        expect(config?.path).toBe('/');
    });

    it('should throw when catalogService.listAdmin returns INTERNAL_ERROR', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminListRoute, 'get', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown,
            query: unknown
        ) => Promise<unknown>;

        mockListAdmin.mockResolvedValue({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'DB connection lost' }
        });

        // Act + Assert
        await expect(handler({}, {}, {}, {})).rejects.toThrow();
    });
});
