/**
 * @file user-bookmarks-api.test.ts
 * @description Regression test for BETA-105: SSR favorite-status checks always
 * rendered "not favorited" because `userBookmarksApi.checkStatus()` did not
 * forward the SSR `cookieHeader`, unlike its sibling protected wrappers
 * (e.g. `accommodationMediaApi.listMedia`, `protectedConversationsApi.list`).
 *
 * Also covers the identical `checkBulk()` bug (production incident: repeated
 * `POST /user-bookmarks/check-bulk` 401s with `actorRole: guest` for genuinely
 * logged-in users) — `checkBulk` did not accept/forward `cookieHeader` while
 * its sibling `checkStatus` did, so every SSR bulk-hydration call silently
 * lost the session cookie.
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

describe('userBookmarksApi.checkBulk', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(apiClient.postProtected).mockResolvedValue({
            ok: true,
            data: { checks: { [ENTITY_ID]: { isBookmarked: true, bookmarkId: 'bookmark-uuid-1' } } }
        });
    });

    it('forwards the cookieHeader to apiClient.postProtected for SSR calls (production incident)', async () => {
        await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: [ENTITY_ID],
            cookieHeader: COOKIE_HEADER
        });

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/user-bookmarks/check-bulk',
            body: { entityType: 'ACCOMMODATION', entityIds: [ENTITY_ID] },
            cookieHeader: COOKIE_HEADER
        });
    });

    it('passes cookieHeader as undefined for browser calls that omit it', async () => {
        await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: [ENTITY_ID]
        });

        expect(apiClient.postProtected).toHaveBeenCalledWith({
            path: '/api/v1/protected/user-bookmarks/check-bulk',
            body: { entityType: 'ACCOMMODATION', entityIds: [ENTITY_ID] },
            cookieHeader: undefined
        });
    });

    it('does not leak cookieHeader into the request body sent to the API', async () => {
        await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: [ENTITY_ID],
            cookieHeader: COOKIE_HEADER
        });

        const call = vi.mocked(apiClient.postProtected).mock.calls[0]?.[0];
        expect(call?.body).not.toHaveProperty('cookieHeader');
    });
});
