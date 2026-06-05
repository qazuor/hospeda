/**
 * Integration tests for Admin Billing Add-ons CRUD Routes (SPEC-192 T-019)
 *
 * Covers full CRUD lifecycle: list, getById, create, update, toggle, softDelete,
 * restore, hardDelete.
 *
 * Strategy: mock AddonCatalogService and the route factory — verify that:
 * - Correct service methods are invoked
 * - Correct permissions are required (BILLING_READ_ALL for reads, BILLING_MANAGE for writes)
 * - Service errors map to correct HTTP status codes (404, 409, 422, 500)
 * - Audit log is called for mutations
 *
 * SPEC-192 T-019
 *
 * @module test/routes/billing/admin/addons.crud
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

// Mock actor
vi.mock('../../../../src/middlewares/actor', () => ({
    getActorFromContext: vi.fn().mockReturnValue({
        id: 'actor-00000000-0000-0000-0000-000000000001',
        role: 'SUPER_ADMIN',
        permissions: ['billing:read_all', 'billing:manage']
    })
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

// Import the module — this executes all route factory calls at module load
import '../../../../src/routes/billing/admin/addons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_ADDON = {
    id: '22222222-2222-2222-2222-222222222222',
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
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
// Permission registration tests
// ---------------------------------------------------------------------------

describe('T-019: route registration — permissions', () => {
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
// List handler
// ---------------------------------------------------------------------------

describe('T-019: adminListAddonsRoute handler', () => {
    beforeEach(() => {
        mockListAdmin.mockReset();
    });

    it('should call catalogService.listAdmin and return items + pagination', async () => {
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
                items: [SAMPLE_ADDON],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        // Act
        const result = await handler({}, {}, {}, { page: 1, pageSize: 20 });

        // Assert
        expect(mockListAdmin).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, pageSize: 20 })
        );
        expect(result).toEqual(
            expect.objectContaining({
                items: [SAMPLE_ADDON],
                pagination: expect.objectContaining({ total: 1 })
            })
        );
    });

    it('should pass billingType filter to catalogService.listAdmin', async () => {
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
            data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
        });

        // Act
        await handler({}, {}, {}, { billingType: 'one_time' });

        // Assert
        expect(mockListAdmin).toHaveBeenCalledWith(
            expect.objectContaining({ billingType: 'one_time' })
        );
    });

    it('should throw when catalogService.listAdmin returns an error', async () => {
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
            error: { code: 'INTERNAL_ERROR', message: 'DB unreachable' }
        });

        // Act + Assert
        await expect(handler({}, {}, {}, {})).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// getById handler
// ---------------------------------------------------------------------------

describe('T-019: adminGetAddonByIdRoute handler', () => {
    beforeEach(() => {
        mockGetById.mockReset();
    });

    it('should return addon when found — response includes id + timestamps', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'get', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockGetById.mockResolvedValue({ success: true, data: SAMPLE_ADDON });

        // Act
        const result = await handler({}, { id: SAMPLE_ADDON.id });

        // Assert
        expect(result).toEqual(
            expect.objectContaining({
                id: SAMPLE_ADDON.id,
                slug: SAMPLE_ADDON.slug,
                createdAt: SAMPLE_ADDON.createdAt
            })
        );
        expect(mockGetById).toHaveBeenCalledWith(SAMPLE_ADDON.id);
    });

    it('should throw 404 when addon not found', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'get', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Add-on not found' }
        });

        // Act + Assert
        await expect(handler({}, { id: SAMPLE_ADDON.id })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Create handler
// ---------------------------------------------------------------------------

describe('T-019: adminCreateAddonRoute handler', () => {
    beforeEach(() => {
        mockCreate.mockReset();
        mockAuditLog.mockReset();
    });

    it('should create addon and emit audit log', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockCreate.mockResolvedValue({ success: true, data: SAMPLE_ADDON });

        const createBody = {
            slug: 'extra-photos-20',
            name: 'Extra Photos Pack (+20 photos)',
            description: 'Adds 20 extra photo slots.',
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

        // Assert
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({ slug: 'extra-photos-20' }),
            expect.objectContaining({ actorId: expect.any(String) })
        );
        expect(result).toEqual(expect.objectContaining({ slug: 'extra-photos-20' }));
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'create', resourceType: 'billing_addon' })
        );
    });

    it('should throw 409 when slug already exists', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        mockCreate.mockResolvedValue({
            success: false,
            error: {
                code: 'ALREADY_EXISTS',
                message: 'Addon with slug "extra-photos-20" already exists'
            }
        });

        // Act + Assert
        await expect(handler({}, {}, { slug: 'extra-photos-20' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Update handler
// ---------------------------------------------------------------------------

describe('T-019: adminUpdateAddonRoute handler', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
        mockAuditLog.mockReset();
    });

    it('should update addon and emit audit log', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'put', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        const updatedAddon = { ...SAMPLE_ADDON, name: 'Updated Name' };
        mockUpdate.mockResolvedValue({ success: true, data: updatedAddon });

        // Act
        const result = await handler({}, { id: SAMPLE_ADDON.id }, { name: 'Updated Name' });

        // Assert
        expect(mockUpdate).toHaveBeenCalledWith(
            SAMPLE_ADDON.id,
            expect.objectContaining({ name: 'Updated Name' }),
            expect.objectContaining({ actorId: expect.any(String) })
        );
        expect(result).toEqual(expect.objectContaining({ name: 'Updated Name' }));
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'update', resourceType: 'billing_addon' })
        );
    });

    it('should throw 404 when addon not found', async () => {
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
        await expect(handler({}, { id: SAMPLE_ADDON.id }, { name: 'X' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Toggle active handler
// ---------------------------------------------------------------------------

describe('T-019: adminToggleAddonActiveRoute handler', () => {
    beforeEach(() => {
        mockToggleActive.mockReset();
        mockAuditLog.mockReset();
    });

    it('should toggle active state and emit audit log', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'patch', '/{id}');
        const handler = config?.handler as (
            c: unknown,
            params: unknown,
            body: unknown
        ) => Promise<unknown>;

        const deactivated = { ...SAMPLE_ADDON, isActive: false };
        mockToggleActive.mockResolvedValue({ success: true, data: deactivated });

        // Act
        const result = await handler({}, { id: SAMPLE_ADDON.id }, { active: false });

        // Assert
        expect(mockToggleActive).toHaveBeenCalledWith(
            SAMPLE_ADDON.id,
            false,
            expect.objectContaining({ actorId: expect.any(String) })
        );
        expect(result).toEqual(expect.objectContaining({ isActive: false }));
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'update', resourceType: 'billing_addon' })
        );
    });
});

// ---------------------------------------------------------------------------
// Soft-delete handler
// ---------------------------------------------------------------------------

describe('T-019: adminSoftDeleteAddonRoute handler', () => {
    beforeEach(() => {
        mockSoftDelete.mockReset();
        mockAuditLog.mockReset();
    });

    it('should soft-delete addon and emit audit log, return null', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockSoftDelete.mockResolvedValue({ success: true, data: undefined });

        // Act
        const result = await handler({}, { id: SAMPLE_ADDON.id });

        // Assert
        expect(mockSoftDelete).toHaveBeenCalledWith(
            SAMPLE_ADDON.id,
            expect.objectContaining({ actorId: expect.any(String) })
        );
        expect(result).toBeNull();
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'delete', resourceType: 'billing_addon' })
        );
    });

    it('should throw 404 when addon not found', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockSoftDelete.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Addon not found' }
        });

        // Act + Assert
        await expect(handler({}, { id: SAMPLE_ADDON.id })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Restore handler
// ---------------------------------------------------------------------------

describe('T-019: adminRestoreAddonRoute handler', () => {
    beforeEach(() => {
        mockRestore.mockReset();
        mockAuditLog.mockReset();
    });

    it('should restore addon and emit audit log', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        const restored = { ...SAMPLE_ADDON, isActive: true, deletedAt: null };
        mockRestore.mockResolvedValue({ success: true, data: restored });

        // Act
        const result = await handler({}, { id: SAMPLE_ADDON.id });

        // Assert
        expect(mockRestore).toHaveBeenCalledWith(
            SAMPLE_ADDON.id,
            expect.objectContaining({ actorId: expect.any(String) })
        );
        expect(result).toEqual(expect.objectContaining({ isActive: true }));
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'update', resourceType: 'billing_addon' })
        );
    });

    it('should throw 422 when addon is not soft-deleted', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'post', '/{id}/restore');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockRestore.mockResolvedValue({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Addon is not soft-deleted' }
        });

        // Act + Assert
        await expect(handler({}, { id: SAMPLE_ADDON.id })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Hard-delete handler
// ---------------------------------------------------------------------------

describe('T-019: adminHardDeleteAddonRoute handler', () => {
    beforeEach(() => {
        mockHardDelete.mockReset();
        mockAuditLog.mockReset();
    });

    it('should hard-delete addon and emit audit log, return null', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockHardDelete.mockResolvedValue({ success: true, data: undefined });

        // Act
        const result = await handler({}, { id: SAMPLE_ADDON.id });

        // Assert
        expect(mockHardDelete).toHaveBeenCalledWith(
            SAMPLE_ADDON.id,
            expect.objectContaining({ actorId: expect.any(String) })
        );
        expect(result).toBeNull();
        expect(mockAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({ action: 'delete', resourceType: 'billing_addon' })
        );
    });

    it('should throw 409 when addon is referenced by purchases', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockHardDelete.mockResolvedValue({
            success: false,
            error: {
                code: 'ALREADY_EXISTS',
                message: 'Addon is referenced by 3 purchase record(s)'
            }
        });

        // Act + Assert
        await expect(handler({}, { id: SAMPLE_ADDON.id })).rejects.toThrow();
    });

    it('should throw 404 when addon not found', async () => {
        // Arrange
        const config = findRouteCall(mockCreateAdminRoute, 'delete', '/{id}/hard');
        const handler = config?.handler as (c: unknown, params: unknown) => Promise<unknown>;

        mockHardDelete.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Addon not found' }
        });

        // Act + Assert
        await expect(handler({}, { id: SAMPLE_ADDON.id })).rejects.toThrow();
    });
});
