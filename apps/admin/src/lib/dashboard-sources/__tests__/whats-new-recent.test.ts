/**
 * whats-new.recent — dashboard source contract tests (SPEC-175 T-016).
 *
 * Tests the `whats-new.recent` data-source registration:
 * - Source is registered and resolvable for any role context.
 * - queryFn fetches the correct endpoint.
 * - Unseen items are mapped to a `statusBadge: { label: 'Nuevo', variant: 'success' }`.
 * - Seen items carry no `statusBadge` (undefined).
 * - `maxItems` slicing is NOT done in the queryFn — the widget renderer slices.
 *   (This test confirms the queryFn returns the full list from the API.)
 * - Empty item array returns an empty array (never null/undefined).
 *
 * @see apps/admin/src/lib/dashboard-sources/whats-new.ts
 * @see SPEC-175 T-016
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetchApi BEFORE importing resolver modules (vi.mock is hoisted).
vi.mock('@/lib/api/client', () => ({
    fetchApi: vi.fn()
}));

import { fetchApi } from '@/lib/api/client';
import { type ResolverContext, resolveDataSource } from '@/lib/dashboard-sources';
// Side-effect: registers all sources including whats-new.recent.
import '@/lib/dashboard-sources/index';

const mockFetchApi = vi.mocked(fetchApi);

/**
 * Wraps a raw endpoint body in the fetchApi output envelope `{ data, status }`.
 * All fetchApi calls return `{ data: <body>, status: <code> }`.
 */
function envelope(body: unknown) {
    return { data: body, status: 200 };
}

/**
 * Resolves the `whats-new.recent` source and runs its queryFn.
 * Asserts the source is registered before calling.
 */
async function runSource(ctx: ResolverContext): Promise<unknown> {
    const { found, options } = resolveDataSource('whats-new.recent', ctx);
    expect(found, "source 'whats-new.recent' should be registered").toBe(true);
    return options.queryFn();
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNSEEN_ITEM = {
    id: 'entry-2026-dashboard',
    publishedAt: '2026-06-01T00:00:00Z',
    title: 'Nueva función: dashboard de novedades',
    seen: false
};

const SEEN_ITEM = {
    id: 'entry-2026-old',
    publishedAt: '2026-05-01T00:00:00Z',
    title: 'Historial de crons disponible',
    seen: true
};

function makeApiResponse(items: unknown[]) {
    return envelope({
        success: true,
        data: {
            items,
            unseenCount: items.filter((i) => !(i as { seen: boolean }).seen).length
        }
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('whats-new.recent dashboard source', () => {
    // ── Registration ──────────────────────────────────────────────────────

    it('is registered for HOST role context', () => {
        const ctx: ResolverContext = {
            role: 'HOST',
            userId: 'u-host',
            permissions: [],
            scope: 'all'
        };
        const { found } = resolveDataSource('whats-new.recent', ctx);
        expect(found).toBe(true);
    });

    it('is registered for EDITOR role context', () => {
        const ctx: ResolverContext = {
            role: 'EDITOR',
            userId: 'u-editor',
            permissions: [],
            scope: 'all'
        };
        const { found } = resolveDataSource('whats-new.recent', ctx);
        expect(found).toBe(true);
    });

    it('is registered for ADMIN role context', () => {
        const ctx: ResolverContext = {
            role: 'ADMIN',
            userId: 'u-admin',
            permissions: [],
            scope: 'all'
        };
        const { found } = resolveDataSource('whats-new.recent', ctx);
        expect(found).toBe(true);
    });

    it('is registered for SUPER_ADMIN role context', () => {
        const ctx: ResolverContext = {
            role: 'SUPER_ADMIN',
            userId: 'u-super',
            permissions: [],
            scope: 'all'
        };
        const { found } = resolveDataSource('whats-new.recent', ctx);
        expect(found).toBe(true);
    });

    // ── Endpoint call ─────────────────────────────────────────────────────

    it('calls GET /api/v1/protected/whats-new', async () => {
        const ctx: ResolverContext = {
            role: 'ADMIN',
            userId: 'u-admin',
            permissions: [],
            scope: 'all'
        };
        mockFetchApi.mockResolvedValueOnce(makeApiResponse([]));

        await runSource(ctx);

        expect(mockFetchApi).toHaveBeenCalledWith(
            expect.objectContaining({ path: '/api/v1/protected/whats-new' })
        );
    });

    // ── Seen/unseen badge mapping ─────────────────────────────────────────

    it('maps unseen items to statusBadge { label: "Nuevo", variant: "success" }', async () => {
        const ctx: ResolverContext = {
            role: 'HOST',
            userId: 'u-host',
            permissions: [],
            scope: 'all'
        };
        mockFetchApi.mockResolvedValueOnce(makeApiResponse([UNSEEN_ITEM]));

        const result = await runSource(ctx);

        expect(Array.isArray(result)).toBe(true);
        const items = result as Array<{
            id: string;
            label: string;
            meta: string;
            statusBadge?: { label: string; variant: string };
        }>;
        expect(items).toHaveLength(1);
        expect(items[0].statusBadge).toEqual({ label: 'Nuevo', variant: 'success' });
    });

    it('maps seen items to no statusBadge (undefined)', async () => {
        const ctx: ResolverContext = {
            role: 'HOST',
            userId: 'u-host',
            permissions: [],
            scope: 'all'
        };
        mockFetchApi.mockResolvedValueOnce(makeApiResponse([SEEN_ITEM]));

        const result = await runSource(ctx);

        const items = result as Array<{ statusBadge?: unknown }>;
        expect(items[0].statusBadge).toBeUndefined();
    });

    it('correctly maps both seen and unseen items in a mixed response', async () => {
        const ctx: ResolverContext = {
            role: 'ADMIN',
            userId: 'u-admin',
            permissions: [],
            scope: 'all'
        };
        mockFetchApi.mockResolvedValueOnce(makeApiResponse([UNSEEN_ITEM, SEEN_ITEM, UNSEEN_ITEM]));

        const result = await runSource(ctx);

        const items = result as Array<{ statusBadge?: { label: string } }>;
        expect(items).toHaveLength(3);
        expect(items[0].statusBadge?.label).toBe('Nuevo');
        expect(items[1].statusBadge).toBeUndefined();
        expect(items[2].statusBadge?.label).toBe('Nuevo');
    });

    // ── Empty catalog ─────────────────────────────────────────────────────

    it('returns an empty array when the catalog is empty', async () => {
        const ctx: ResolverContext = {
            role: 'HOST',
            userId: 'u-host',
            permissions: [],
            scope: 'all'
        };
        mockFetchApi.mockResolvedValueOnce(makeApiResponse([]));

        const result = await runSource(ctx);

        expect(result).toEqual([]);
    });

    // ── Item mapping ──────────────────────────────────────────────────────

    it('maps id, title → label, and formatted publishedAt → meta', async () => {
        const ctx: ResolverContext = {
            role: 'ADMIN',
            userId: 'u-admin',
            permissions: [],
            scope: 'all'
        };
        mockFetchApi.mockResolvedValueOnce(makeApiResponse([UNSEEN_ITEM]));

        const result = await runSource(ctx);

        const items = result as Array<{ id: string; label: string; meta: string }>;
        expect(items[0].id).toBe(UNSEEN_ITEM.id);
        expect(items[0].label).toBe(UNSEEN_ITEM.title);
        // meta should be a non-empty string (formatted date)
        expect(typeof items[0].meta).toBe('string');
        expect(items[0].meta.length).toBeGreaterThan(0);
    });

    // ── maxItems is NOT applied in queryFn ────────────────────────────────

    it('returns the full item list without slicing (slicing is done by the widget renderer)', async () => {
        const ctx: ResolverContext = {
            role: 'HOST',
            userId: 'u-host',
            permissions: [],
            scope: 'all'
        };
        const manyItems = Array.from({ length: 10 }, (_, i) => ({
            id: `entry-${i}`,
            publishedAt: '2026-06-01T00:00:00Z',
            title: `Novedad ${i + 1}`,
            seen: false
        }));
        mockFetchApi.mockResolvedValueOnce(makeApiResponse(manyItems));

        const result = await runSource(ctx);

        // The queryFn itself must NOT slice — the widget's config.maxItems does.
        expect((result as unknown[]).length).toBe(10);
    });
});
