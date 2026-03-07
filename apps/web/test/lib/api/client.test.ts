/**
 * Tests for api/client.ts - Typed fetch wrapper with error handling and timeout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock env module to control base URL
vi.mock('@/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://test-api.local')
}));

// We need to re-import after the mock is in place.
// Use a helper to create a fresh fetch mock for each test.

describe('apiClient', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
        vi.stubGlobal('import.meta', {
            env: { DEV: false, PROD: true, PUBLIC_API_URL: 'http://test-api.local' }
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    describe('get()', () => {
        it('should make a GET request to the correct URL', async () => {
            // Arrange
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: { id: '1', name: 'Test' } })
            });
            const { apiClient } = await import('@/lib/api/client');

            // Act
            const _result = await apiClient.get({ path: '/api/v1/public/test' });

            // Assert
            expect(mockFetch).toHaveBeenCalledOnce();
            const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('/api/v1/public/test');
            expect(options.method).toBe('GET');
        });

        it('should return ok=true with data on success', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: { id: '1', name: 'Test' } })
            });
            const { apiClient } = await import('@/lib/api/client');

            const result = await apiClient.get<{ id: string; name: string }>({
                path: '/api/v1/public/test'
            });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual({ id: '1', name: 'Test' });
            }
        });

        it('should append query parameters to the URL', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: [] })
            });
            const { apiClient } = await import('@/lib/api/client');

            await apiClient.get({
                path: '/api/v1/public/items',
                params: { page: 1, q: 'beach', empty: '' }
            });

            const [url] = mockFetch.mock.calls[0] as [string];
            expect(url).toContain('page=1');
            expect(url).toContain('q=beach');
            // empty string should be excluded
            expect(url).not.toContain('empty=');
        });

        it('should return ok=false on HTTP 404', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                json: async () => ({
                    error: { message: 'Not found', code: 'NOT_FOUND' }
                })
            });
            const { apiClient } = await import('@/lib/api/client');

            const result = await apiClient.get({ path: '/api/v1/public/missing' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.status).toBe(404);
                expect(result.error.message).toBe('Not found');
                expect(result.error.code).toBe('NOT_FOUND');
            }
        });

        it('should return ok=false with generic message on HTTP 500 without body', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: async () => null
            });
            const { apiClient } = await import('@/lib/api/client');

            const result = await apiClient.get({ path: '/api/v1/public/error' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.status).toBe(500);
                expect(result.error.message).toContain('500');
            }
        });

        it('should return ok=false with status 0 on network error', async () => {
            mockFetch.mockRejectedValue(new Error('Failed to fetch'));
            const { apiClient } = await import('@/lib/api/client');

            const result = await apiClient.get({ path: '/api/v1/public/test' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.status).toBe(0);
                expect(result.error.message).toBe('Failed to fetch');
            }
        });

        it('should return timeout error on AbortError', async () => {
            const abortError = new DOMException('The operation was aborted.', 'AbortError');
            mockFetch.mockRejectedValue(abortError);
            const { apiClient } = await import('@/lib/api/client');

            const result = await apiClient.get({ path: '/api/v1/public/slow' });

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.error.status).toBe(408);
                expect(result.error.message).toContain('timeout');
            }
        });

        it('should handle raw array response (no wrapper)', async () => {
            const rawItems = [{ id: 1 }, { id: 2 }];
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => rawItems
            });
            const { apiClient } = await import('@/lib/api/client');

            const result = await apiClient.get<unknown[]>({ path: '/api/v1/public/raw' });

            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.data).toEqual(rawItems);
            }
        });
    });

    describe('post()', () => {
        it('should make a POST request with JSON body', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: { success: true } })
            });
            const { apiClient } = await import('@/lib/api/client');

            await apiClient.post({
                path: '/api/v1/public/contact',
                body: { name: 'Test', email: 'test@example.com' }
            });

            const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(options.method).toBe('POST');
            expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });
            expect(options.body).toBe(JSON.stringify({ name: 'Test', email: 'test@example.com' }));
        });
    });

    describe('getProtected()', () => {
        it('should include credentials: include for protected requests', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: {} })
            });
            const { apiClient } = await import('@/lib/api/client');

            await apiClient.getProtected({ path: '/api/v1/protected/users/me' });

            const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(options.credentials).toBe('include');
        });
    });

    describe('delete()', () => {
        it('should make a DELETE request with credentials', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ data: { success: true } })
            });
            const { apiClient } = await import('@/lib/api/client');

            await apiClient.delete({ path: '/api/v1/protected/items/123' });

            const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toContain('/items/123');
            expect(options.method).toBe('DELETE');
            expect(options.credentials).toBe('include');
        });
    });
});

describe('fetchAllPages', () => {
    const mockFetch = vi.fn();

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('should return empty array when fetcher fails', async () => {
        const { fetchAllPages } = await import('@/lib/api/client');

        const result = await fetchAllPages({
            fetcher: async () => ({ ok: false, error: { status: 500, message: 'error' } }),
            params: {}
        });

        expect(result).toEqual([]);
    });

    it('should return all items from single page', async () => {
        const { fetchAllPages } = await import('@/lib/api/client');

        const items = [{ id: '1' }, { id: '2' }];

        const result = await fetchAllPages({
            fetcher: async () => ({
                ok: true,
                data: {
                    items,
                    pagination: { totalPages: 1, total: 2, page: 1, pageSize: 100 }
                }
            })
        });

        expect(result).toEqual(items);
    });

    it('should fetch multiple pages and combine results', async () => {
        const { fetchAllPages } = await import('@/lib/api/client');

        const page1 = [{ id: '1' }];
        const page2 = [{ id: '2' }];

        const fetcher = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: page1,
                    pagination: { totalPages: 2, total: 2, page: 1, pageSize: 100 }
                }
            })
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    items: page2,
                    pagination: { totalPages: 2, total: 2, page: 2, pageSize: 100 }
                }
            });

        const result = await fetchAllPages({ fetcher });

        expect(result).toEqual([...page1, ...page2]);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
});
