/**
 * editor.posts.views + editor.events.views resolver tests (SPEC-197 T-014).
 *
 * Tests:
 *  - Correct API paths for posts/events list + views endpoints.
 *  - Response shape: items sorted by total DESC, entityId + name + unique + total.
 *  - Empty posts/events pool → returns empty items array without calling views endpoint.
 *  - Independent registration (each source has its own queryKey).
 *
 * @see apps/admin/src/lib/dashboard-sources/editor.ts
 * @see SPEC-197 T-014, §3.2
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetchApi BEFORE importing resolver modules (vi.mock is hoisted).
vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

import { fetchApi } from '@/lib/api/client';
import { type ResolverContext, resolveDataSource } from '@/lib/dashboard-sources';
// Side-effect: registers editor (and other) sources into the registry.
import '@/lib/dashboard-sources/index';

const mockFetchApi = vi.mocked(fetchApi);

/** EDITOR context. */
const ctx: ResolverContext = {
    role: 'EDITOR',
    userId: 'u-editor-1',
    permissions: ['POST_VIEW_ALL', 'EVENT_VIEW_ALL'],
    scope: 'all'
};

/** Wraps a raw endpoint body in the fetchApi output envelope `{ data, status }`. */
function envelope(body: unknown) {
    return { data: body, status: 200 };
}

/** Resolves a source and runs its queryFn, asserting it is registered. */
async function runSource(sourceId: string): Promise<unknown> {
    const { found, options } = resolveDataSource(sourceId, ctx);
    expect(found, `source '${sourceId}' should be registered`).toBe(true);
    return options.queryFn();
}

beforeEach(() => {
    mockFetchApi.mockReset();
});

// ============================================================================
// editor.posts.views
// ============================================================================

describe('editor.posts.views resolver (SPEC-197 T-014)', () => {
    it('fetches posts list then views endpoint with correct paths', async () => {
        const postId1 = 'post-uuid-001';
        const postId2 = 'post-uuid-002';

        // Step 1: admin posts list
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    items: [
                        { id: postId1, title: 'Post A', status: 'ACTIVE' },
                        { id: postId2, title: 'Post B', status: 'ACTIVE' }
                    ],
                    pagination: { total: 2 }
                }
            })
        );

        // Step 2: views endpoint
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [
                    { entityId: postId1, unique: 30, total: 100 },
                    { entityId: postId2, unique: 10, total: 40 }
                ]
            })
        );

        const result = await runSource('editor.posts.views');

        // Posts list call
        const postsPath = (mockFetchApi.mock.calls[0][0] as { path: string }).path;
        expect(postsPath).toContain('/admin/posts');
        expect(postsPath).toContain('status=ACTIVE');

        // Views call
        const viewsPath = (mockFetchApi.mock.calls[1][0] as { path: string }).path;
        expect(viewsPath).toContain('/protected/views/posts');
        expect(viewsPath).toContain('window=30d');
        expect(viewsPath).toContain(postId1);
        expect(viewsPath).toContain(postId2);

        // Result shape
        const { items } = result as {
            items: { entityId: string; name: string; unique: number; total: number }[];
            window: string;
        };
        expect(items).toHaveLength(2);
        // Should be sorted by total DESC: postId1 (100) first, then postId2 (40)
        expect(items[0].entityId).toBe(postId1);
        expect(items[0].name).toBe('Post A');
        expect(items[0].total).toBe(100);
        expect(items[1].entityId).toBe(postId2);
        expect(items[1].total).toBe(40);
    });

    it('returns empty items without calling views endpoint when posts pool is empty', async () => {
        mockFetchApi.mockResolvedValueOnce(
            envelope({ success: true, data: { items: [], pagination: { total: 0 } } })
        );

        const result = await runSource('editor.posts.views');

        // Only one call (posts list)
        expect(mockFetchApi).toHaveBeenCalledTimes(1);
        expect((result as { items: unknown[] }).items).toHaveLength(0);
    });

    it('builds an independent queryKey for editor.posts.views', () => {
        const { found, options } = resolveDataSource('editor.posts.views', ctx);

        expect(found).toBe(true);
        const key = options.queryKey as unknown[];
        expect(key[0]).toBe('dashboard');
        expect(key[1]).toBe('editor.posts.views');
        expect(key[2]).toBe('EDITOR');
    });
});

// ============================================================================
// editor.events.views
// ============================================================================

describe('editor.events.views resolver (SPEC-197 T-014)', () => {
    it('fetches events list then views endpoint with correct paths', async () => {
        const eventId1 = 'evt-uuid-001';
        const eventId2 = 'evt-uuid-002';

        // Step 1: admin events list
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: {
                    items: [
                        { id: eventId1, name: 'Event A', status: 'ACTIVE' },
                        { id: eventId2, name: 'Event B', status: 'ACTIVE' }
                    ],
                    pagination: { total: 2 }
                }
            })
        );

        // Step 2: views endpoint
        mockFetchApi.mockResolvedValueOnce(
            envelope({
                success: true,
                data: [
                    { entityId: eventId1, unique: 5, total: 20 },
                    { entityId: eventId2, unique: 50, total: 200 }
                ]
            })
        );

        const result = await runSource('editor.events.views');

        // Events list call
        const eventsPath = (mockFetchApi.mock.calls[0][0] as { path: string }).path;
        expect(eventsPath).toContain('/admin/events');

        // Views call
        const viewsPath = (mockFetchApi.mock.calls[1][0] as { path: string }).path;
        expect(viewsPath).toContain('/protected/views/events');
        expect(viewsPath).toContain('window=30d');

        // Result shape — sorted by total DESC: eventId2 (200) first
        const { items } = result as {
            items: { entityId: string; name: string; total: number }[];
            window: string;
        };
        expect(items).toHaveLength(2);
        expect(items[0].entityId).toBe(eventId2);
        expect(items[0].total).toBe(200);
        expect(items[1].entityId).toBe(eventId1);
    });

    it('returns empty items without calling views endpoint when events pool is empty', async () => {
        mockFetchApi.mockResolvedValueOnce(
            envelope({ success: true, data: { items: [], pagination: { total: 0 } } })
        );

        const result = await runSource('editor.events.views');

        expect(mockFetchApi).toHaveBeenCalledTimes(1);
        expect((result as { items: unknown[] }).items).toHaveLength(0);
    });

    it('builds an independent queryKey for editor.events.views (different from editor.posts.views)', () => {
        const { found: foundPosts, options: optsPosts } = resolveDataSource(
            'editor.posts.views',
            ctx
        );
        const { found: foundEvents, options: optsEvents } = resolveDataSource(
            'editor.events.views',
            ctx
        );

        expect(foundPosts).toBe(true);
        expect(foundEvents).toBe(true);

        // Keys must differ
        expect(optsPosts.queryKey[1]).toBe('editor.posts.views');
        expect(optsEvents.queryKey[1]).toBe('editor.events.views');
        expect(optsPosts.queryKey).not.toEqual(optsEvents.queryKey);
    });
});
