/**
 * @file events-by-author.test.ts
 * @description Unit tests for `eventsApi.getByAuthor` (HOS-375 T-016).
 *
 * Mirrors the mock-`apiClient` style of `accommodations-nearby-pois.test.ts`:
 * mock the module at the boundary and assert on the exact path + params shape
 * sent to `apiClient.getList`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { eventsApi } from '@/lib/api/endpoints';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        getList: vi.fn(),
        post: vi.fn(),
        postProtected: vi.fn(),
        getProtected: vi.fn(),
        getListProtected: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

/** The editorial account's id — a UUID, not a slug. */
const AUTHOR_ID = '95c2cd4b-0000-4000-8000-000000000000';
const PATH = `/api/v1/public/events/author/${AUTHOR_ID}`;

describe('eventsApi.getByAuthor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
        });
    });

    it('builds the author path from the UUID', async () => {
        await eventsApi.getByAuthor({ authorId: AUTHOR_ID });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: PATH,
            params: { page: undefined, pageSize: undefined }
        });
    });

    it('forwards page and pageSize', async () => {
        await eventsApi.getByAuthor({ authorId: AUTHOR_ID, page: 3, pageSize: 12 });

        expect(apiClient.getList).toHaveBeenCalledWith({
            path: PATH,
            params: { page: 3, pageSize: 12 }
        });
    });

    it('sends pagination and nothing else', async () => {
        // The server schema declares category/isFeatured/isVirtual/q/sortBy/
        // sortOrder, but the handler destructures only page and pageSize and
        // discards the rest (HOS-375 NG-2). This asserts the client never
        // advertises filtering the endpoint does not perform.
        await eventsApi.getByAuthor({ authorId: AUTHOR_ID, page: 1, pageSize: 10 });

        const call = vi.mocked(apiClient.getList).mock.calls[0]?.[0] as {
            params: Record<string, unknown>;
        };

        expect(Object.keys(call.params).sort()).toEqual(['page', 'pageSize']);
    });

    it('returns the paginated envelope unchanged', async () => {
        vi.mocked(apiClient.getList).mockResolvedValue({
            ok: true,
            data: {
                items: [{ id: 'event-1', slug: 'fiesta-de-la-playa' }],
                pagination: { page: 2, pageSize: 12, total: 52, totalPages: 5 }
            }
        });

        const result = await eventsApi.getByAuthor({ authorId: AUTHOR_ID, page: 2 });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data.items).toHaveLength(1);
            expect(result.data.pagination.total).toBe(52);
        }
    });
});
