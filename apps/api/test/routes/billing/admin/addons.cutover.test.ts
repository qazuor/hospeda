/**
 * Parity tests for admin addons route cutover (SPEC-192 T-010)
 *
 * Verifies that the GET /admin/billing/addons and GET /admin/billing/addons/:slug
 * endpoints now return DB-backed data from AddonCatalogService instead of the
 * static config. Tests assert that:
 * - List endpoint delegates to `catalogService.list()` and maps response fields
 * - Slug endpoint delegates to `catalogService.getBySlug()` and maps response fields
 * - NOT_FOUND from service maps to HTTP 404
 * - INTERNAL_ERROR from service maps to HTTP 500
 * - BILLING_READ_ALL permission is required on both endpoints
 *
 * Route handlers are exercised by extracting them from the `createAdminRoute`
 * call (same pattern used in plans.test.ts and customer-addons.test.ts).
 *
 * @module test/routes/billing/admin/addons.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockList, mockGetBySlug, mockCreateAdminRoute } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockGetBySlug: vi.fn(),
    mockCreateAdminRoute: vi.fn()
}));

// Mock AddonCatalogService — DB-backed after cutover
vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        list: mockList,
        getBySlug: mockGetBySlug
    }))
}));

// Capture route factory calls for permission verification
vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: mockCreateAdminRoute
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

// Mock create-app router
vi.mock('../../../../src/utils/create-app', () => ({
    createRouter: vi.fn(() => ({ route: vi.fn() }))
}));

// Mock logger
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Import after mocks — triggers module evaluation which calls createAdminRoute
import '../../../../src/routes/billing/admin/addons';

// ─── Capture handler references at import time ────────────────────────────────
// createAdminRoute is called at module-level (const adminListAddonsRoute = createAdminRoute(...))
// so the calls are recorded during import. Capture them before beforeEach clears mock state.

type RouteConfig = {
    handler: (...args: unknown[]) => Promise<unknown>;
    requiredPermissions?: string[];
};

const [listRouteConfig, slugRouteConfig] = mockCreateAdminRoute.mock.calls.map(
    (call) => call[0] as RouteConfig
);

const listHandler = listRouteConfig?.handler;
const slugHandler = slugRouteConfig?.handler;
const listPermissions = listRouteConfig?.requiredPermissions ?? [];
const slugPermissions = slugRouteConfig?.requiredPermissions ?? [];

// ─── Catalog stubs ────────────────────────────────────────────────────────────

const STUB_ADDON = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    description: 'Featured in search results for 7 days.',
    billingType: 'one_time' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'FEATURED_LISTING',
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 1
};

const STUB_ADDON_2 = {
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 additional photos per accommodation.',
    billingType: 'recurring' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: 'max_photos_per_accommodation',
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 3
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// (Handlers and permissions captured at import time above.)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('admin addons route cutover (SPEC-192 T-010)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET / (list)', () => {
        describe('permissions', () => {
            it('should require BILLING_READ_ALL', () => {
                expect(listPermissions).toContain('billing:read_all');
            });
        });

        describe('when AddonCatalogService.list() succeeds', () => {
            it('should return mapped addon definitions from DB catalog', async () => {
                // Arrange
                mockList.mockResolvedValue({ success: true, data: [STUB_ADDON, STUB_ADDON_2] });

                // Act
                const handler = listHandler;
                const result = (await handler(null, {}, null, {})) as Array<{
                    slug: string;
                    priceArs: number;
                }>;

                // Assert
                expect(mockList).toHaveBeenCalledOnce();
                expect(Array.isArray(result)).toBe(true);
                expect(result).toHaveLength(2);
                expect(result[0]?.slug).toBe('visibility-boost-7d');
                expect(result[0]?.priceArs).toBe(500000);
                expect(result[1]?.slug).toBe('extra-photos-20');
            });

            it('should pass billingType filter to catalogService', async () => {
                // Arrange
                mockList.mockResolvedValue({ success: true, data: [STUB_ADDON] });

                // Act
                const handler = listHandler;
                await handler(null, {}, null, { billingType: 'one_time' });

                // Assert
                expect(mockList).toHaveBeenCalledWith(
                    expect.objectContaining({ billingType: 'one_time' })
                );
            });

            it('should pass targetCategory filter to catalogService', async () => {
                // Arrange
                mockList.mockResolvedValue({ success: true, data: [STUB_ADDON] });

                // Act
                const handler = listHandler;
                await handler(null, {}, null, { targetCategory: 'owner' });

                // Assert
                expect(mockList).toHaveBeenCalledWith(
                    expect.objectContaining({ targetCategory: 'owner' })
                );
            });

            it('should pass active=true filter to catalogService when query.active is truthy', async () => {
                // Arrange
                mockList.mockResolvedValue({ success: true, data: [STUB_ADDON] });

                // Act
                const handler = listHandler;
                await handler(null, {}, null, { active: true });

                // Assert
                expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
            });

            it('should return empty array when catalog is empty', async () => {
                // Arrange
                mockList.mockResolvedValue({ success: true, data: [] });

                // Act
                const handler = listHandler;
                const result = (await handler(null, {}, null, {})) as unknown[];

                // Assert
                expect(result).toHaveLength(0);
            });
        });

        describe('when AddonCatalogService.list() fails', () => {
            it('should throw HTTP 500 on INTERNAL_ERROR', async () => {
                // Arrange
                mockList.mockResolvedValue({
                    success: false,
                    error: { code: 'INTERNAL_ERROR', message: 'DB error' }
                });

                // Act + Assert
                const handler = listHandler;
                await expect(handler(null, {}, null, {})).rejects.toThrow();
            });
        });
    });

    describe('GET /:slug', () => {
        describe('permissions', () => {
            it('should require BILLING_READ_ALL', () => {
                expect(slugPermissions).toContain('billing:read_all');
            });
        });

        describe('when AddonCatalogService.getBySlug() succeeds', () => {
            it('should return mapped addon definition from DB catalog', async () => {
                // Arrange
                mockGetBySlug.mockResolvedValue({ success: true, data: STUB_ADDON });

                // Act
                const handler = slugHandler;
                const result = (await handler(null, { slug: 'visibility-boost-7d' })) as {
                    slug: string;
                    priceArs: number;
                    billingType: string;
                };

                // Assert
                expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
                expect(result.slug).toBe('visibility-boost-7d');
                expect(result.priceArs).toBe(500000);
                expect(result.billingType).toBe('one_time');
            });

            it('should include all required response fields', async () => {
                // Arrange
                mockGetBySlug.mockResolvedValue({ success: true, data: STUB_ADDON_2 });

                // Act
                const handler = slugHandler;
                const result = (await handler(null, { slug: 'extra-photos-20' })) as Record<
                    string,
                    unknown
                >;

                // Assert — all AddonResponseSchema fields present
                expect(result).toHaveProperty('slug', 'extra-photos-20');
                expect(result).toHaveProperty('name', 'Extra Photos Pack (+20 photos)');
                expect(result).toHaveProperty('billingType', 'recurring');
                expect(result).toHaveProperty('affectsLimitKey', 'max_photos_per_accommodation');
                expect(result).toHaveProperty('limitIncrease', 20);
                expect(result).toHaveProperty('grantsEntitlement', null);
                expect(result).toHaveProperty('isActive', true);
                expect(result).toHaveProperty('sortOrder', 3);
            });
        });

        describe('when AddonCatalogService.getBySlug() returns NOT_FOUND', () => {
            it('should throw HTTP 404', async () => {
                // Arrange
                mockGetBySlug.mockResolvedValue({
                    success: false,
                    error: { code: 'NOT_FOUND', message: "Add-on 'unknown-slug' not found" }
                });

                // Act + Assert
                const handler = slugHandler;
                await expect(handler(null, { slug: 'unknown-slug' })).rejects.toMatchObject({
                    status: 404
                });
            });
        });

        describe('when AddonCatalogService.getBySlug() returns INTERNAL_ERROR', () => {
            it('should throw HTTP 500', async () => {
                // Arrange
                mockGetBySlug.mockResolvedValue({
                    success: false,
                    error: { code: 'INTERNAL_ERROR', message: 'DB timeout' }
                });

                // Act + Assert
                const handler = slugHandler;
                await expect(handler(null, { slug: 'any-slug' })).rejects.toMatchObject({
                    status: 500
                });
            });
        });
    });
});
