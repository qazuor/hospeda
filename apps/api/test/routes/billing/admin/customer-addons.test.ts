/**
 * Tests for Admin Customer Add-on Purchases Routes
 *
 * Covers:
 * - GAPS-P4-T001: Pagination uses pageSize and includes totalPages
 * - GAPS-P4-T002: includeDeleted controls soft-delete filtering
 * - GAPS-P4-T004: POST /:id/expire endpoint
 * - GAPS-P4-T005: POST /:id/activate endpoint
 * - GAPS-P4-T006: Permission checks for expire/activate
 *
 * @module test/routes/billing/admin/customer-addons
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports (vi.hoisted for correct ordering)
// ---------------------------------------------------------------------------

const { mockExpireAddon, mockActivateAddon, mockListCustomerAddons, mockCreateAdminRoute } =
    vi.hoisted(() => ({
        mockExpireAddon: vi.fn(),
        mockActivateAddon: vi.fn(),
        mockListCustomerAddons: vi.fn(),
        mockCreateAdminRoute: vi.fn()
    }));

// Mock the AdminAddonService
vi.mock('../../../../src/services/addon.admin', () => ({
    AdminAddonService: vi.fn().mockImplementation(() => ({
        listCustomerAddons: mockListCustomerAddons,
        expireAddon: mockExpireAddon,
        activateAddon: mockActivateAddon
    }))
}));

// Mock @repo/schemas — import actual schemas for validation, override PermissionEnum
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

// Mock the route factory — capture all calls for permission verification
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: mockCreateAdminRoute
}));

// Mock the logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import {
    activateCustomerAddonHandler,
    expireCustomerAddonHandler,
    listCustomerAddonsHandler
} from '../../../../src/routes/billing/admin/customer-addons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockContext = () => ({
    json: vi.fn((body: unknown, status?: number) => ({
        body,
        status: status ?? 200
    }))
});

const sampleAddonRow = {
    id: '00000000-0000-0000-0000-000000000001',
    customerId: '00000000-0000-0000-0000-000000000010',
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    subscriptionId: null,
    addonSlug: 'visibility-boost-7d',
    addonId: null,
    status: 'active',
    purchasedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-08T00:00:00.000Z',
    canceledAt: null,
    deletedAt: null,
    paymentId: null,
    limitAdjustments: null,
    entitlementAdjustments: null,
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
};

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('route registration — permission checks (GAPS-P4-T006)', () => {
    // These tests verify the route config that was passed to createAdminRoute
    // at module import time. They do NOT use beforeEach(clearAllMocks) since
    // the calls happened during import.

    it('should register expire route with BILLING_MANAGE permission', () => {
        const expireCall = mockCreateAdminRoute.mock.calls.find(
            (call: unknown[]) =>
                (call[0] as Record<string, unknown>)?.path === '/{id}/expire' &&
                (call[0] as Record<string, unknown>)?.method === 'post'
        );

        expect(expireCall).toBeDefined();
        expect(expireCall?.[0].requiredPermissions).toContain('billing:manage');
    });

    it('should register activate route with BILLING_MANAGE permission', () => {
        const activateCall = mockCreateAdminRoute.mock.calls.find(
            (call: unknown[]) =>
                (call[0] as Record<string, unknown>)?.path === '/{id}/activate' &&
                (call[0] as Record<string, unknown>)?.method === 'post'
        );

        expect(activateCall).toBeDefined();
        expect(activateCall?.[0].requiredPermissions).toContain('billing:manage');
    });

    it('should register list route with BILLING_READ_ALL permission', () => {
        const listCall = mockCreateAdminRoute.mock.calls.find(
            (call: unknown[]) =>
                (call[0] as Record<string, unknown>)?.path === '/' &&
                (call[0] as Record<string, unknown>)?.method === 'get'
        );

        expect(listCall).toBeDefined();
        expect(listCall?.[0].requiredPermissions).toContain('billing:read_all');
    });
});

describe('listCustomerAddonsHandler', () => {
    beforeEach(() => {
        mockListCustomerAddons.mockReset();
        mockExpireAddon.mockReset();
        mockActivateAddon.mockReset();
    });

    it('should call service with parsed query params including pageSize and includeDeleted', async () => {
        // Arrange
        mockListCustomerAddons.mockResolvedValue({
            success: true,
            data: {
                data: [sampleAddonRow],
                total: 1,
                page: 1,
                pageSize: 20,
                totalPages: 1
            }
        });

        // Act
        const result = await listCustomerAddonsHandler(null, null, null, {
            page: '1',
            pageSize: '10',
            status: 'active',
            includeDeleted: 'true'
        });

        // Assert
        expect(mockListCustomerAddons).toHaveBeenCalledWith({
            page: 1,
            pageSize: 10,
            status: 'active',
            addonSlug: undefined,
            customerEmail: undefined,
            includeDeleted: true
        });
        expect(result).toHaveProperty('totalPages');
        expect(result).toHaveProperty('pageSize');
    });

    it('should default includeDeleted to false', async () => {
        // Arrange
        mockListCustomerAddons.mockResolvedValue({
            success: true,
            data: {
                data: [],
                total: 0,
                page: 1,
                pageSize: 20,
                totalPages: 0
            }
        });

        // Act
        await listCustomerAddonsHandler(null, null, null, {});

        // Assert
        expect(mockListCustomerAddons).toHaveBeenCalledWith(
            expect.objectContaining({ includeDeleted: false })
        );
    });

    it('should throw HTTPException on service failure', async () => {
        // Arrange
        mockListCustomerAddons.mockResolvedValue({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'DB error' }
        });

        // Act & Assert
        await expect(listCustomerAddonsHandler(null, null, null, {})).rejects.toThrow('DB error');
    });
});

describe('expireCustomerAddonHandler', () => {
    beforeEach(() => {
        mockExpireAddon.mockReset();
    });

    it('should expire an active purchase (happy path)', async () => {
        // Arrange
        const c = createMockContext();
        const expiredRow = { ...sampleAddonRow, status: 'expired' };
        mockExpireAddon.mockResolvedValue({ success: true, data: expiredRow });

        // Act
        const result = await expireCustomerAddonHandler(c as unknown as import('hono').Context, {
            id: sampleAddonRow.id
        });

        // Assert
        expect(mockExpireAddon).toHaveBeenCalledWith(sampleAddonRow.id);
        expect(result).toHaveProperty('status', 'expired');
    });

    it('should return 404 for non-existent purchase', async () => {
        // Arrange
        const c = createMockContext();
        mockExpireAddon.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Not found' }
        });

        // Act
        await expireCustomerAddonHandler(c as unknown as import('hono').Context, {
            id: 'nonexistent-uuid'
        });

        // Assert
        expect(c.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'NOT_FOUND' })
            }),
            404
        );
    });

    it('should return 400 if purchase is already expired', async () => {
        // Arrange
        const c = createMockContext();
        mockExpireAddon.mockResolvedValue({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Already expired' }
        });

        // Act
        await expireCustomerAddonHandler(c as unknown as import('hono').Context, {
            id: sampleAddonRow.id
        });

        // Assert
        expect(c.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'INVALID_STATUS' })
            }),
            400
        );
    });
});

describe('activateCustomerAddonHandler', () => {
    beforeEach(() => {
        mockActivateAddon.mockReset();
    });

    it('should activate an expired purchase (happy path)', async () => {
        // Arrange
        const c = createMockContext();
        const activatedRow = { ...sampleAddonRow, status: 'active' };
        mockActivateAddon.mockResolvedValue({ success: true, data: activatedRow });

        // Act
        const result = await activateCustomerAddonHandler(c as unknown as import('hono').Context, {
            id: sampleAddonRow.id
        });

        // Assert
        expect(mockActivateAddon).toHaveBeenCalledWith({ purchaseId: sampleAddonRow.id });
        expect(result).toHaveProperty('status', 'active');
    });

    it('should return 404 for non-existent purchase', async () => {
        // Arrange
        const c = createMockContext();
        mockActivateAddon.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Not found' }
        });

        // Act
        await activateCustomerAddonHandler(c as unknown as import('hono').Context, {
            id: 'nonexistent-uuid'
        });

        // Assert
        expect(c.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'NOT_FOUND' })
            }),
            404
        );
    });

    it('should return 400 if purchase is already active', async () => {
        // Arrange
        const c = createMockContext();
        mockActivateAddon.mockResolvedValue({
            success: false,
            error: { code: 'INVALID_STATUS', message: 'Already active' }
        });

        // Act
        await activateCustomerAddonHandler(c as unknown as import('hono').Context, {
            id: sampleAddonRow.id
        });

        // Assert
        expect(c.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                error: expect.objectContaining({ code: 'INVALID_STATUS' })
            }),
            400
        );
    });
});
