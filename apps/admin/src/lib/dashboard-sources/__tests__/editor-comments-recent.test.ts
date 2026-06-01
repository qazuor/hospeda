/**
 * editor.comments.recent — real-shape contract tests (SPEC-165 T-016).
 *
 * Tests the queryFn unwrap logic: the recent-comments endpoint returns
 * `{ success, data: { data: RecentCommentItem[] } }` (ResponseFactory
 * double-data envelope). The resolver must return the inner array.
 *
 * Also asserts:
 *  - Correct API path is called (GET /api/v1/admin/comments/recent?pageSize=10).
 *  - Returns an empty array (not null/undefined) when the envelope has no items.
 *
 * @see apps/admin/src/lib/dashboard-sources/editor.ts
 * @see SPEC-165 T-016
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetchApi BEFORE importing resolver modules (vi.mock is hoisted).
vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

import { fetchApi } from '@/lib/api/client';
import { type ResolverContext, resolveDataSource } from '@/lib/dashboard-sources';
// Side-effect: registers editor sources into the registry.
import '@/lib/dashboard-sources/index';

const mockFetchApi = vi.mocked(fetchApi);

/** EDITOR context. */
const ctx: ResolverContext = {
    role: 'EDITOR',
    userId: 'u-editor',
    permissions: ['POST_COMMENT_VIEW', 'EVENT_COMMENT_VIEW'],
    scope: 'all'
};

/** Wraps a raw endpoint body in the fetchApi output envelope `{ data, status }`. */
function envelope(body: unknown) {
    return { data: body, status: 200 };
}

/** Resolves the source and runs its queryFn, asserting it is registered. */
async function runSource(sourceId: string): Promise<unknown> {
    const { found, options } = resolveDataSource(sourceId, ctx);
    expect(found, `source '${sourceId}' should be registered`).toBe(true);
    return options.queryFn();
}

beforeEach(() => {
    mockFetchApi.mockReset();
});

describe('editor.comments.recent resolver', () => {
    // ── queryFn response-shape unwrap ──────────────────────────────────────

    it('extracts the inner data.data array from the ResponseFactory double-envelope', async () => {
        const items = [
            {
                id: 'c-001',
                entityType: 'POST',
                entityId: 'p-001',
                content: 'Great post!',
                authorName: 'Ana García',
                moderationState: 'APPROVED',
                createdAt: '2026-05-31T10:00:00Z'
            },
            {
                id: 'c-002',
                entityType: 'EVENT',
                entityId: 'e-001',
                content: 'Amazing event.',
                authorName: 'Carlos Pérez',
                moderationState: 'PENDING',
                createdAt: '2026-05-31T09:00:00Z'
            }
        ];

        mockFetchApi.mockResolvedValue(envelope({ success: true, data: { data: items } }));

        const result = (await runSource('editor.comments.recent')) as ReadonlyArray<{
            id: string;
            entityType: string;
            authorName: string;
            moderationState: string;
        }>;

        // Must return the inner array directly, not the wrapper.
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({
            id: 'c-001',
            entityType: 'POST',
            authorName: 'Ana García',
            moderationState: 'APPROVED'
        });
        expect(result[1]).toMatchObject({
            id: 'c-002',
            entityType: 'EVENT',
            moderationState: 'PENDING'
        });
    });

    // ── Empty / missing data graceful degradation ─────────────────────────

    it('returns an empty array when data.data is absent (not null/undefined)', async () => {
        mockFetchApi.mockResolvedValue(envelope({ success: true, data: {} }));

        const result = await runSource('editor.comments.recent');

        expect(result).toEqual([]);
    });

    it('returns an empty array when the data wrapper itself is absent', async () => {
        mockFetchApi.mockResolvedValue(envelope({ success: true }));

        const result = await runSource('editor.comments.recent');

        expect(result).toEqual([]);
    });

    it('returns an empty array when data.data is an empty array', async () => {
        mockFetchApi.mockResolvedValue(envelope({ success: true, data: { data: [] } }));

        const result = (await runSource('editor.comments.recent')) as unknown[];

        expect(result).toEqual([]);
    });

    // ── API path verification ──────────────────────────────────────────────

    it('calls the correct admin endpoint with pageSize=10', async () => {
        mockFetchApi.mockResolvedValue(envelope({ success: true, data: { data: [] } }));

        await runSource('editor.comments.recent');

        expect(mockFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/api/v1/admin/comments/recent?pageSize=10'
            })
        );
        // Must NOT call the public or protected tier.
        const path = (mockFetchApi.mock.calls[0][0] as { path: string }).path;
        expect(path).toContain('/admin/');
        expect(path).not.toContain('/public/');
        expect(path).not.toContain('/protected/');
    });

    // ── Query key shape ────────────────────────────────────────────────────

    it('builds a queryKey starting with [dashboard, editor.comments.recent, EDITOR, all]', () => {
        const { found, options } = resolveDataSource('editor.comments.recent', ctx);

        expect(found).toBe(true);
        const key = options.queryKey as unknown[];
        expect(key[0]).toBe('dashboard');
        expect(key[1]).toBe('editor.comments.recent');
        expect(key[2]).toBe('EDITOR');
        expect(key[3]).toBe('all');
    });
});
