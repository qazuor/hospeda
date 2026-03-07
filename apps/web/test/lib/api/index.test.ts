/**
 * Tests for api/index.ts - barrel re-export file.
 * Verifies all expected exports are accessible through the index.
 */
import { describe, expect, it, vi } from 'vitest';

// Mock the apiClient and fetchAllPages to avoid real HTTP calls
vi.mock('@/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        getList: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        getProtected: vi.fn(),
        postProtected: vi.fn()
    },
    fetchAllPages: vi.fn()
}));

describe('api/index.ts barrel exports', () => {
    it('should export apiClient', async () => {
        const api = await import('@/lib/api/index');
        expect(api.apiClient).toBeDefined();
        expect(typeof api.apiClient.get).toBe('function');
        expect(typeof api.apiClient.getList).toBe('function');
        expect(typeof api.apiClient.post).toBe('function');
        expect(typeof api.apiClient.patch).toBe('function');
        expect(typeof api.apiClient.delete).toBe('function');
        expect(typeof api.apiClient.getProtected).toBe('function');
        expect(typeof api.apiClient.postProtected).toBe('function');
    });

    it('should export fetchAllPages', async () => {
        const api = await import('@/lib/api/index');
        expect(api.fetchAllPages).toBeDefined();
        expect(typeof api.fetchAllPages).toBe('function');
    });

    it('should export public endpoint namespaces from endpoints.ts', async () => {
        const api = await import('@/lib/api/index');
        expect(api.accommodationsApi).toBeDefined();
        expect(api.destinationsApi).toBeDefined();
        expect(api.eventsApi).toBeDefined();
        expect(api.postsApi).toBeDefined();
        expect(api.contactApi).toBeDefined();
    });

    it('should export accommodationsApi methods', async () => {
        const api = await import('@/lib/api/index');
        expect(typeof api.accommodationsApi.list).toBe('function');
        expect(typeof api.accommodationsApi.getBySlug).toBe('function');
        expect(typeof api.accommodationsApi.getById).toBe('function');
        expect(typeof api.accommodationsApi.getByDestination).toBe('function');
        expect(typeof api.accommodationsApi.getTopRatedByDestination).toBe('function');
        expect(typeof api.accommodationsApi.getSummary).toBe('function');
    });

    it('should export destinationsApi methods', async () => {
        const api = await import('@/lib/api/index');
        expect(typeof api.destinationsApi.list).toBe('function');
        expect(typeof api.destinationsApi.getBySlug).toBe('function');
        expect(typeof api.destinationsApi.getById).toBe('function');
        expect(typeof api.destinationsApi.getByPath).toBe('function');
        expect(typeof api.destinationsApi.getChildren).toBe('function');
        expect(typeof api.destinationsApi.getDescendants).toBe('function');
        expect(typeof api.destinationsApi.getAncestors).toBe('function');
        expect(typeof api.destinationsApi.getBreadcrumb).toBe('function');
        expect(typeof api.destinationsApi.getAccommodations).toBe('function');
    });

    it('should export eventsApi methods', async () => {
        const api = await import('@/lib/api/index');
        expect(typeof api.eventsApi.list).toBe('function');
        expect(typeof api.eventsApi.getBySlug).toBe('function');
        expect(typeof api.eventsApi.getById).toBe('function');
        expect(typeof api.eventsApi.getUpcoming).toBe('function');
        expect(typeof api.eventsApi.getSummary).toBe('function');
    });

    it('should export postsApi methods', async () => {
        const api = await import('@/lib/api/index');
        expect(typeof api.postsApi.list).toBe('function');
        expect(typeof api.postsApi.getBySlug).toBe('function');
        expect(typeof api.postsApi.getById).toBe('function');
        expect(typeof api.postsApi.getFeatured).toBe('function');
        expect(typeof api.postsApi.getByCategory).toBe('function');
        expect(typeof api.postsApi.getSummary).toBe('function');
    });

    it('should export protected endpoint namespaces from endpoints-protected.ts', async () => {
        const api = await import('@/lib/api/index');
        expect(api.authApi).toBeDefined();
        expect(api.userApi).toBeDefined();
        expect(api.userBookmarksApi).toBeDefined();
        expect(api.billingApi).toBeDefined();
        expect(api.tagsApi).toBeDefined();
        expect(api.plansApi).toBeDefined();
        expect(api.exchangeRatesApi).toBeDefined();
    });

    it('should export transform functions', async () => {
        const api = await import('@/lib/api/index');
        expect(typeof api.toAccommodationCardProps).toBe('function');
        expect(typeof api.toAccommodationDetailedProps).toBe('function');
        expect(typeof api.toDestinationCardProps).toBe('function');
        expect(typeof api.toEventCardProps).toBe('function');
        expect(typeof api.toPostCardProps).toBe('function');
    });
});
