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

import { MAX_BULK_CHECK_ENTITY_IDS } from '@repo/schemas';
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

// ---------------------------------------------------------------------------
// Chunking against the endpoint's own cap (HOS-186)
//
// The endpoint caps entityIds at MAX_BULK_CHECK_ENTITY_IDS and rejects longer
// lists with a 400 — it does not truncate. MAP_FETCH_CAP and the map hook's
// pageSize both sit at exactly that cap with zero headroom, so raising either
// (a plausible product tweak) used to silently 400 every bulk call; callers
// degrade from that failure into per-card /check, i.e. straight back to the
// N+1 this endpoint exists to prevent. Chunking here keeps that impossible.
// ---------------------------------------------------------------------------

describe('userBookmarksApi.checkBulk — chunking (HOS-186)', () => {
    /** Distinct, predictable ids so we can assert on exact chunk boundaries. */
    const makeIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `entity-${i}`);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    /** Mocks postProtected to echo back a check entry for each requested id. */
    function mockEchoingApi(): void {
        vi.mocked(apiClient.postProtected).mockImplementation(
            async ({ body }: { body?: unknown }) => {
                const ids = (body as { entityIds: string[] }).entityIds;
                const checks: Record<string, { isBookmarked: boolean; bookmarkId: string | null }> =
                    {};
                for (const id of ids) {
                    checks[id] = { isBookmarked: true, bookmarkId: `bm-${id}` };
                }
                return { ok: true, data: { checks } };
            }
        );
    }

    it('sends a single request when the list is at the cap (no behaviour change)', async () => {
        mockEchoingApi();

        await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: makeIds(MAX_BULK_CHECK_ENTITY_IDS)
        });

        expect(apiClient.postProtected).toHaveBeenCalledTimes(1);
    });

    it('splits a list of cap+1 into two requests, neither exceeding the cap', async () => {
        mockEchoingApi();

        await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: makeIds(MAX_BULK_CHECK_ENTITY_IDS + 1)
        });

        const calls = vi.mocked(apiClient.postProtected).mock.calls;
        expect(calls).toHaveLength(2);
        for (const [arg] of calls) {
            const ids = (arg?.body as { entityIds: string[] }).entityIds;
            expect(ids.length).toBeGreaterThan(0);
            expect(ids.length).toBeLessThanOrEqual(MAX_BULK_CHECK_ENTITY_IDS);
        }
    });

    it('returns one merged map covering every id across chunks', async () => {
        mockEchoingApi();
        const entityIds = makeIds(MAX_BULK_CHECK_ENTITY_IDS * 2 + 5);

        const result = await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // Every id resolves — no gap would silently read as "not bookmarked".
        expect(Object.keys(result.data.checks)).toHaveLength(entityIds.length);
        for (const id of entityIds) {
            expect(result.data.checks[id]).toEqual({
                isBookmarked: true,
                bookmarkId: `bm-${id}`
            });
        }
    });

    it('forwards entityType and cookieHeader on every chunk', async () => {
        mockEchoingApi();

        await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: makeIds(MAX_BULK_CHECK_ENTITY_IDS + 1),
            cookieHeader: COOKIE_HEADER
        });

        const calls = vi.mocked(apiClient.postProtected).mock.calls;
        expect(calls).toHaveLength(2);
        for (const [arg] of calls) {
            expect(arg?.cookieHeader).toBe(COOKIE_HEADER);
            expect((arg?.body as { entityType: string }).entityType).toBe('ACCOMMODATION');
            expect(arg?.body).not.toHaveProperty('cookieHeader');
        }
    });

    it('fails as a unit when any chunk fails (never a partial map)', async () => {
        // A partial map is worse than an error: the missing entries would render
        // as "not bookmarked" rather than falling back to self-hydration.
        const apiError = { message: 'boom', code: 'INTERNAL' };
        let call = 0;
        vi.mocked(apiClient.postProtected).mockImplementation(async () => {
            call += 1;
            if (call === 2) return { ok: false, error: apiError } as never;
            return { ok: true, data: { checks: {} } } as never;
        });

        const result = await userBookmarksApi.checkBulk({
            entityType: 'ACCOMMODATION',
            entityIds: makeIds(MAX_BULK_CHECK_ENTITY_IDS + 1)
        });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toEqual(apiError);
    });
});
