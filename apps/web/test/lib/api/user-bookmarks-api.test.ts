/**
 * @file user-bookmarks-api.test.ts
 * @description Regression test for BETA-105: SSR favorite-status checks always
 * rendered "not favorited" because `userBookmarksApi.checkStatus()` did not
 * forward the SSR `cookieHeader`, unlike its sibling protected wrappers
 * (e.g. `accommodationMediaApi.listMedia`, `protectedConversationsApi.list`).
 *
 * Mirrors the style of `accommodation-media-api.test.ts`: mock `apiClient` at
 * the module level and assert on the call shape.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api/client';
import { userBookmarksApi } from '@/lib/api/endpoints-protected';

vi.mock('@/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        getProtected: vi.fn(),
        post: vi.fn(),
        postProtected: vi.fn(),
        delete: vi.fn(),
        put: vi.fn()
    }
}));

const ENTITY_ID = 'accommodation-uuid-123';
const COOKIE_HEADER = 'better-auth.session_token=abc123';

describe('userBookmarksApi.checkStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.getProtected).mockResolvedValue({
            ok: true,
            data: { isFavorited: true, bookmarkId: 'bookmark-uuid-1' }
        });
    });

    it('forwards the cookieHeader to apiClient.getProtected for SSR calls (BETA-105)', async () => {
        await userBookmarksApi.checkStatus({
            entityId: ENTITY_ID,
            entityType: 'ACCOMMODATION',
            cookieHeader: COOKIE_HEADER
        });

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/user-bookmarks/check',
            params: { entityId: ENTITY_ID, entityType: 'ACCOMMODATION' },
            cookieHeader: COOKIE_HEADER
        });
    });

    it('passes cookieHeader as undefined for browser calls that omit it', async () => {
        await userBookmarksApi.checkStatus({
            entityId: ENTITY_ID,
            entityType: 'ACCOMMODATION'
        });

        expect(apiClient.getProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/user-bookmarks/check',
            params: { entityId: ENTITY_ID, entityType: 'ACCOMMODATION' },
            cookieHeader: undefined
        });
    });

    it('does not leak cookieHeader into the query params sent to the API', async () => {
        await userBookmarksApi.checkStatus({
            entityId: ENTITY_ID,
            entityType: 'ACCOMMODATION',
            cookieHeader: COOKIE_HEADER
        });

        const call = vi.mocked(apiClient.getProtected).mock.calls[0]?.[0];
        expect(call?.params).not.toHaveProperty('cookieHeader');
    });
});
