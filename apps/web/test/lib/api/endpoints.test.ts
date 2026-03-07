/**
 * Tests for api/endpoints.ts - Public API endpoint wrappers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the apiClient so we don't make real HTTP calls
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

const BASE = '/api/v1/public';

describe('accommodationsApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getList with /accommodations path on list()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { accommodationsApi } = await import('@/lib/api/endpoints');
        await accommodationsApi.list({ page: 1, pageSize: 12 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/accommodations`,
            params: { page: 1, pageSize: 12 }
        });
    });

    it('should call get with slug path on getBySlug()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { accommodationsApi } = await import('@/lib/api/endpoints');
        await accommodationsApi.getBySlug({ slug: 'hostel-colon' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/accommodations/slug/hostel-colon`
        });
    });

    it('should call get with id path on getById()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { accommodationsApi } = await import('@/lib/api/endpoints');
        await accommodationsApi.getById({ id: 'abc-123' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/accommodations/abc-123`
        });
    });

    it('should call getList with destination path on getByDestination()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { accommodationsApi } = await import('@/lib/api/endpoints');
        await accommodationsApi.getByDestination({ destinationId: 'dest-1', page: 2, pageSize: 5 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/accommodations/destination/dest-1`,
            params: { page: 2, pageSize: 5 }
        });
    });

    it('should call get with summary path on getSummary()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { accommodationsApi } = await import('@/lib/api/endpoints');
        await accommodationsApi.getSummary({ id: 'acc-1' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/accommodations/acc-1/summary`
        });
    });
});

describe('destinationsApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getList with /destinations on list()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.list({ isFeatured: true });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/destinations`,
            params: { isFeatured: true }
        });
    });

    it('should call get with by-path on getByPath()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getByPath({ path: '/argentina/litoral' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/destinations/by-path`,
            params: { path: '/argentina/litoral' }
        });
    });

    it('should call get with /children on getChildren()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: { children: [] } });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getChildren({ id: 'dest-1' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/destinations/dest-1/children`
        });
    });

    it('should call get with /breadcrumb on getBreadcrumb()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: { breadcrumb: [] } });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getBreadcrumb({ id: 'dest-1' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/destinations/dest-1/breadcrumb`
        });
    });
});

describe('eventsApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getList with /events on list()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { eventsApi } = await import('@/lib/api/endpoints');
        await eventsApi.list({ category: 'cultural', pageSize: 5 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/events`,
            params: { category: 'cultural', pageSize: 5 }
        });
    });

    it('should call getList with /events/upcoming on getUpcoming()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { eventsApi } = await import('@/lib/api/endpoints');
        await eventsApi.getUpcoming({ daysAhead: 30 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/events/upcoming`,
            params: { daysAhead: 30 }
        });
    });
});

describe('postsApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getList with /posts on list()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { postsApi } = await import('@/lib/api/endpoints');
        await postsApi.list({ page: 2 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/posts`,
            params: { page: 2 }
        });
    });

    it('should call getList with /posts/featured on getFeatured()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { postsApi } = await import('@/lib/api/endpoints');
        await postsApi.getFeatured({ fromDate: '2026-01-01' });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/posts/featured`,
            params: { fromDate: '2026-01-01' }
        });
    });

    it('should call getList with /posts/category/:category on getByCategory()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { postsApi } = await import('@/lib/api/endpoints');
        await postsApi.getByCategory({ category: 'turismo' });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/posts/category/turismo`
        });
    });
});

describe('contactApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call post with /contact on submit()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.post).mockResolvedValue({
            ok: true,
            data: { success: true, message: 'OK' }
        });

        const { contactApi } = await import('@/lib/api/endpoints');
        await contactApi.submit({
            firstName: 'Juan',
            lastName: 'Perez',
            email: 'juan@example.com',
            message: 'Hello'
        });

        expect(apiClient.post).toHaveBeenCalledWith({
            path: `${BASE}/contact`,
            body: {
                firstName: 'Juan',
                lastName: 'Perez',
                email: 'juan@example.com',
                message: 'Hello',
                accommodationId: undefined,
                type: undefined
            }
        });
    });

    it('should pass optional accommodationId and type on submit()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.post).mockResolvedValue({
            ok: true,
            data: { success: true, message: 'OK' }
        });

        const { contactApi } = await import('@/lib/api/endpoints');
        await contactApi.submit({
            firstName: 'Ana',
            lastName: 'Lopez',
            email: 'ana@example.com',
            message: 'Consulta sobre el alojamiento',
            accommodationId: 'acc-999',
            type: 'inquiry'
        });

        expect(apiClient.post).toHaveBeenCalledWith({
            path: `${BASE}/contact`,
            body: {
                firstName: 'Ana',
                lastName: 'Lopez',
                email: 'ana@example.com',
                message: 'Consulta sobre el alojamiento',
                accommodationId: 'acc-999',
                type: 'inquiry'
            }
        });
    });
});

describe('accommodationsApi - missing methods', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call getList with top-rated path on getTopRatedByDestination()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { accommodationsApi } = await import('@/lib/api/endpoints');
        await accommodationsApi.getTopRatedByDestination({ destinationId: 'dest-1' });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/accommodations/destination/dest-1/top-rated`
        });
    });
});

describe('destinationsApi - missing methods', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call get with slug path on getBySlug()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getBySlug({ slug: 'colon' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/destinations/slug/colon`
        });
    });

    it('should call get with id path on getById()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getById({ id: 'dest-123' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/destinations/dest-123`
        });
    });

    it('should call get with /descendants on getDescendants()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: [] });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getDescendants({
            id: 'dest-1',
            maxDepth: 2,
            destinationType: 'city'
        });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/destinations/dest-1/descendants`,
            params: { maxDepth: 2, destinationType: 'city' }
        });
    });

    it('should call get with /ancestors on getAncestors()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: [] });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getAncestors({ id: 'dest-1' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/destinations/dest-1/ancestors`
        });
    });

    it('should call getList with /accommodations on getAccommodations()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { total: 0, page: 1, pageSize: 10, totalPages: 0 } }
        });

        const { destinationsApi } = await import('@/lib/api/endpoints');
        await destinationsApi.getAccommodations({ id: 'dest-1', page: 1, pageSize: 12 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: `${BASE}/destinations/dest-1/accommodations`,
            params: { page: 1, pageSize: 12 }
        });
    });
});

describe('eventsApi - missing methods', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call get with slug path on getBySlug()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { eventsApi } = await import('@/lib/api/endpoints');
        await eventsApi.getBySlug({ slug: 'carnaval-gualeguaychu' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/events/slug/carnaval-gualeguaychu`
        });
    });

    it('should call get with id path on getById()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { eventsApi } = await import('@/lib/api/endpoints');
        await eventsApi.getById({ id: 'evt-456' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/events/evt-456`
        });
    });

    it('should call get with /summary on getSummary()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { eventsApi } = await import('@/lib/api/endpoints');
        await eventsApi.getSummary({ id: 'evt-1' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/events/evt-1/summary`
        });
    });
});

describe('postsApi - missing methods', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call get with slug path on getBySlug()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { postsApi } = await import('@/lib/api/endpoints');
        await postsApi.getBySlug({ slug: 'nota-termas' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/posts/slug/nota-termas`
        });
    });

    it('should call get with id path on getById()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { postsApi } = await import('@/lib/api/endpoints');
        await postsApi.getById({ id: 'post-789' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/posts/post-789`
        });
    });

    it('should call get with /summary on getSummary()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({ ok: true, data: {} });

        const { postsApi } = await import('@/lib/api/endpoints');
        await postsApi.getSummary({ id: 'post-1' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/posts/post-1/summary`
        });
    });
});

describe('tagsApi', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should call get with /tags/by-slug/:slug on getBySlug()', async () => {
        const { apiClient } = await import('@/lib/api/client');
        vi.mocked(apiClient.get).mockResolvedValue({
            ok: true,
            data: { id: '1', name: 'Termas', slug: 'termas' }
        });

        const { tagsApi } = await import('@/lib/api/endpoints');
        await tagsApi.getBySlug({ slug: 'termas' });

        expect(apiClient.get).toHaveBeenCalledWith({
            path: `${BASE}/tags/by-slug/termas`
        });
    });
});
