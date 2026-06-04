// @vitest-environment jsdom
/**
 * Tests for billing-addons catalog hooks (SPEC-192 T-021).
 *
 * Guards the response envelope parsing for the new paginated admin list endpoint.
 * - `useAddonCatalogQuery` must unwrap `{ success, data: { items, pagination } }` correctly
 * - `transformAddonRecord` must produce a valid `ParsedAddonRecord` from an `AdminAddonResponse`
 * - Schema validation errors must surface as ApiError (not silently produce corrupted data)
 *
 * Uses the same renderHook pattern as the useFaqs regression tests.
 */

import { fetchApi } from '@/lib/api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAddonCatalogQuery } from '../hooks';

vi.mock('@/lib/api/client', () => ({ fetchApi: vi.fn() }));
vi.mock('@/lib/errors', () => ({
    ApiError: class ApiError extends Error {
        public readonly status: number;
        public readonly code: string;
        constructor(message: string, options: { status: number; code: string; details?: unknown }) {
            super(message);
            this.status = options.status;
            this.code = options.code;
        }
    },
    reportError: vi.fn()
}));

const mockedFetchApi = vi.mocked(fetchApi);

/** QueryClientProvider wrapper with retries disabled for deterministic tests. */
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    });
    return function Wrapper({ children }: { readonly children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };
}

afterEach(() => {
    vi.clearAllMocks();
});

/** Minimal valid AdminAddonResponse shape (must use a valid v4-format UUID) */
const SAMPLE_ADMIN_ADDON = {
    id: '11111111-1111-4111-a111-111111111111',
    slug: 'extra-photos-20',
    name: 'Extra Photos Pack (+20 photos)',
    description: 'Adds 20 extra photo slots per accommodation.',
    billingType: 'recurring',
    priceArs: 200000,
    durationDays: null,
    affectsLimitKey: 'max_photos_per_accommodation',
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner', 'complex'],
    isActive: true,
    sortOrder: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null
};

// ---------------------------------------------------------------------------
// useAddonCatalogQuery
// ---------------------------------------------------------------------------

describe('useAddonCatalogQuery — response envelope parsing (SPEC-192 T-021)', () => {
    it('should unwrap items + pagination from the API envelope', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: {
                    items: [SAMPLE_ADMIN_ADDON],
                    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                }
            },
            status: 200
        });

        // Act
        const { result } = renderHook(() => useAddonCatalogQuery({}), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Assert
        expect(result.current.data?.items).toHaveLength(1);
        expect(result.current.data?.items[0]?.id).toBe(SAMPLE_ADMIN_ADDON.id);
        expect(result.current.data?.items[0]?.slug).toBe(SAMPLE_ADMIN_ADDON.slug);
        expect(result.current.data?.pagination?.total).toBe(1);
    });

    it('should map isDeleted = false when deletedAt is null', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: {
                    items: [{ ...SAMPLE_ADMIN_ADDON, deletedAt: null }],
                    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                }
            },
            status: 200
        });

        // Act
        const { result } = renderHook(() => useAddonCatalogQuery({}), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Assert
        expect(result.current.data?.items[0]?.isDeleted).toBe(false);
        expect(result.current.data?.items[0]?.deletedAt).toBeNull();
    });

    it('should map isDeleted = true when deletedAt is present', async () => {
        // Arrange
        const deletedAt = '2026-02-01T00:00:00.000Z';
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: {
                    items: [{ ...SAMPLE_ADMIN_ADDON, deletedAt }],
                    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                }
            },
            status: 200
        });

        // Act
        const { result } = renderHook(() => useAddonCatalogQuery({}), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Assert
        expect(result.current.data?.items[0]?.isDeleted).toBe(true);
        expect(result.current.data?.items[0]?.deletedAt).toBe(deletedAt);
    });

    it('should surface a query error when schema validation fails', async () => {
        // Arrange — return malformed data that fails AdminAddonResponseSchema
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: {
                    items: [{ id: 'not-a-uuid', slug: 'x' }], // missing required fields
                    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
                }
            },
            status: 200
        });

        // Act
        const { result } = renderHook(() => useAddonCatalogQuery({}), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isError).toBe(true));

        // Assert — the hook throws an ApiError on schema mismatch
        expect(result.current.error).toBeDefined();
    });

    it('should return empty items array when API returns no items', async () => {
        // Arrange
        mockedFetchApi.mockResolvedValue({
            data: {
                success: true,
                data: {
                    items: [],
                    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 }
                }
            },
            status: 200
        });

        // Act
        const { result } = renderHook(() => useAddonCatalogQuery({}), {
            wrapper: createWrapper()
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // Assert
        expect(result.current.data?.items).toHaveLength(0);
        expect(result.current.data?.pagination?.total).toBe(0);
    });
});
