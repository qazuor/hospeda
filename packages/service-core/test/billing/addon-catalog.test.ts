/**
 * Unit tests for addon.catalog.ts (SPEC-192 T-004)
 *
 * Verifies that:
 * - `listAvailableAddons()` delegates to `AddonCatalogService#list` and returns
 *   the same result the service returns.
 * - `getAddonCatalogEntry(slug)` delegates to `AddonCatalogService#getBySlug` and
 *   returns the same result the service returns.
 * - The public API signatures are unchanged — same inputs, same output shape.
 *
 * AddonCatalogService is mocked to decouple this from DB and mapper logic.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const { mockList, mockGetBySlug } = vi.hoisted(() => ({
    mockList: vi.fn(),
    mockGetBySlug: vi.fn()
}));

vi.mock('../../src/services/billing/addon/addon-catalog.service.js', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        list: mockList,
        getBySlug: mockGetBySlug
    }))
}));

// Import after mocks
import {
    getAddonCatalogEntry,
    listAvailableAddons
} from '../../src/services/billing/addon/addon.catalog.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal AddonDefinition shape for test assertions */
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
    grantsEntitlement: 'featured_listing',
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 1
};

// ─── listAvailableAddons ──────────────────────────────────────────────────────

describe('listAvailableAddons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delegate to AddonCatalogService#list with no filter', async () => {
        // Arrange
        mockList.mockResolvedValue({ success: true, data: [STUB_ADDON] });

        // Act
        const result = await listAvailableAddons();

        // Assert
        expect(mockList).toHaveBeenCalledOnce();
        expect(mockList).toHaveBeenCalledWith({});
        expect(result).toEqual({ success: true, data: [STUB_ADDON] });
    });

    it('should pass billingType filter through to the service', async () => {
        // Arrange
        mockList.mockResolvedValue({ success: true, data: [STUB_ADDON] });

        // Act
        await listAvailableAddons({ billingType: 'one_time' });

        // Assert
        expect(mockList).toHaveBeenCalledWith({ billingType: 'one_time' });
    });

    it('should pass targetCategory filter through to the service', async () => {
        // Arrange
        mockList.mockResolvedValue({ success: true, data: [] });

        // Act
        await listAvailableAddons({ targetCategory: 'owner' });

        // Assert
        expect(mockList).toHaveBeenCalledWith({ targetCategory: 'owner' });
    });

    it('should pass active filter through to the service', async () => {
        // Arrange
        mockList.mockResolvedValue({ success: true, data: [] });

        // Act
        await listAvailableAddons({ active: true });

        // Assert
        expect(mockList).toHaveBeenCalledWith({ active: true });
    });

    it('should return the service result unchanged on success', async () => {
        // Arrange
        const serviceResult = { success: true as const, data: [STUB_ADDON] };
        mockList.mockResolvedValue(serviceResult);

        // Act
        const result = await listAvailableAddons();

        // Assert
        expect(result).toBe(serviceResult);
    });

    it('should return the service failure result unchanged', async () => {
        // Arrange
        const failResult = {
            success: false as const,
            error: { code: 'INTERNAL_ERROR', message: 'DB down' }
        };
        mockList.mockResolvedValue(failResult);

        // Act
        const result = await listAvailableAddons();

        // Assert
        expect(result).toBe(failResult);
        expect(result.success).toBe(false);
    });

    it('should return empty array when service returns empty list', async () => {
        // Arrange
        mockList.mockResolvedValue({ success: true, data: [] });

        // Act
        const result = await listAvailableAddons();

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data).toHaveLength(0);
    });
});

// ─── getAddonCatalogEntry ─────────────────────────────────────────────────────

describe('getAddonCatalogEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delegate to AddonCatalogService#getBySlug with the given slug', async () => {
        // Arrange
        mockGetBySlug.mockResolvedValue({ success: true, data: STUB_ADDON });

        // Act
        const result = await getAddonCatalogEntry('visibility-boost-7d');

        // Assert
        expect(mockGetBySlug).toHaveBeenCalledOnce();
        expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
        expect(result).toEqual({ success: true, data: STUB_ADDON });
    });

    it('should return the matching addon on success', async () => {
        // Arrange
        mockGetBySlug.mockResolvedValue({ success: true, data: STUB_ADDON });

        // Act
        const result = await getAddonCatalogEntry('visibility-boost-7d');

        // Assert
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.slug).toBe('visibility-boost-7d');
        expect(result.data.priceArs).toBe(500000);
    });

    it('should return NOT_FOUND for an unknown slug', async () => {
        // Arrange
        mockGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: "Add-on 'unknown-slug' not found" }
        });

        // Act
        const result = await getAddonCatalogEntry('unknown-slug');

        // Assert
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('unknown-slug');
    });

    it('should return the service failure result unchanged', async () => {
        // Arrange
        const failResult = {
            success: false as const,
            error: { code: 'INTERNAL_ERROR', message: 'DB error' }
        };
        mockGetBySlug.mockResolvedValue(failResult);

        // Act
        const result = await getAddonCatalogEntry('any-slug');

        // Assert
        expect(result).toBe(failResult);
    });
});
