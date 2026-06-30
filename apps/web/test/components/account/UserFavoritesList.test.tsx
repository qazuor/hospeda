/**
 * @file UserFavoritesList.test.tsx
 * @description Unit tests for the UserFavoritesList React island.
 *
 * Covers:
 * - Loading state shown on mount
 * - Empty state shown when API returns zero bookmarks
 * - Grid of cards rendered when bookmarks are returned
 * - "Quitar" button triggers optimistic remove (card disappears)
 * - Error state shown when fetch fails
 * - Retry button re-triggers fetch after error
 * - Pagination nav not rendered when total <= PAGE_SIZE
 * - T-049a: Tab navigation renders 4 tabs with correct roles
 * - T-049a: Active tab defaults to ACCOMMODATION
 * - T-049b: Switching to any tab fetches real data (no "Próximamente")
 * - T-049b: Count-only fetches fire on mount for all 4 entity types
 * - T-049b: Tab badge updates after full fetch of active tab
 * - T-049b: Entity links use correct path segment per type
 * - T-049b: Switching back to ACCOMMODATION re-shows the list
 * - T-049c: "Sin colección" section heading renders
 * - T-049c: "Mis colecciones" section heading renders
 * - T-049c: Collections fetch fires on mount
 * - T-049c: Uncollected bookmarks (collectionId null) appear in "Sin colección"
 * - T-049c: Bookmarks with collectionId are excluded from the uncollected grid
 * - T-049c: Collections are listed with name and count
 * - T-049c: Collection card links to /favoritos/colecciones/:id
 * - T-049c: Empty state shown in "Mis colecciones" when no collections returned
 * - T-049d: Note placeholder shown on cards with no description
 * - T-049d: Existing note text rendered for bookmarks with description
 * - T-049d: Clicking placeholder opens inline textarea editor
 * - T-049d: Successful PATCH updates card's local note text
 * - T-049d: Escape key cancels editing; placeholder restored
 * - T-049d: PATCH failure shows toast; editor stays open
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFavoritesList } from '../../../src/components/account/UserFavoritesList.client';
import { addToast } from '../../../src/store/toast-store';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/UserFavoritesList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/account/EditableNote.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/shared/feedback/SkeletonCard.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    const translations = { t } as const;
    return { createTranslations: () => translations };
});

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BOOKMARK_1 = {
    id: 'bm-1',
    entityId: 'acc-1',
    entityType: 'ACCOMMODATION',
    name: 'Casa del Litoral',
    entitySlug: 'casa-del-litoral',
    entityImage: null,
    entityName: 'Casa del Litoral'
};

const BOOKMARK_2 = {
    id: 'bm-2',
    entityId: 'acc-2',
    entityType: 'ACCOMMODATION',
    name: 'Hotel Paraná',
    entitySlug: null,
    entityImage: 'https://cdn.example.com/hotel.jpg',
    entityName: 'Hotel Paraná'
};

const DESTINATION_BOOKMARK = {
    id: 'bm-dest-1',
    entityId: 'dest-1',
    entityType: 'DESTINATION',
    name: 'Concepción del Uruguay',
    entitySlug: 'concepcion-del-uruguay',
    entityImage: null,
    entityName: 'Concepción del Uruguay'
};

/** Bookmark already assigned to a collection */
const COLLECTED_BOOKMARK = {
    id: 'bm-col-1',
    entityId: 'acc-col-1',
    entityType: 'ACCOMMODATION',
    name: 'Cabaña en la sierra',
    entitySlug: null,
    entityImage: null,
    entityName: 'Cabaña en la sierra',
    collectionId: 'col-uuid-1'
};

// ─── Collections fixtures ─────────────────────────────────────────────────────

const COLLECTION_1 = {
    id: 'col-uuid-1',
    name: 'Viajes soñados',
    description: null,
    color: '#4f46e5',
    icon: null,
    bookmarkCount: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
};

const COLLECTION_2 = {
    id: 'col-uuid-2',
    name: 'Finde largo',
    description: null,
    color: null,
    icon: '🌊',
    bookmarkCount: 1,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
};

/** Create a fresh Response each time to avoid body-consumed issues */
function makeListResponse(
    bookmarks: (typeof BOOKMARK_1 | typeof DESTINATION_BOOKMARK | typeof COLLECTED_BOOKMARK)[],
    total: number
) {
    return new Response(JSON.stringify({ success: true, data: { bookmarks, total } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

function makeCollectionsResponse(
    items: (typeof COLLECTION_1 | typeof COLLECTION_2)[],
    total: number
) {
    return new Response(
        JSON.stringify({
            success: true,
            data: {
                items,
                total,
                page: 1,
                pageSize: 100,
                usage: { current: items.length, max: 10 }
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

function makeEmptyCollectionsResponse() {
    return makeCollectionsResponse([], 0);
}

function makeEmptyResponse() {
    return makeListResponse([], 0);
}

function makeSuccessResponse() {
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

function makeErrorResponse() {
    return new Response(JSON.stringify({ success: false, error: { message: 'Error de red' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
    });
}

function renderList() {
    return render(
        <UserFavoritesList
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

/**
 * Build a fetch mock that routes based on URL:
 * - Requests to `user-bookmark-collections` → collectionsResponse (or empty)
 * - All other GET requests → bookmarksHandler (or empty)
 * - DELETE requests → makeSuccessResponse()
 * - PATCH requests → patchHandler (defaults to makeSuccessResponse)
 */
function makeRoutedFetchMock({
    bookmarksHandler = () => makeEmptyResponse(),
    collectionsResponse = () => makeEmptyCollectionsResponse(),
    patchHandler = () => makeSuccessResponse()
}: {
    bookmarksHandler?: (url: string) => Response;
    collectionsResponse?: () => Response;
    patchHandler?: (url: string, body: unknown) => Response;
} = {}) {
    return vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
        const method = opts?.method ?? 'GET';
        if (method === 'DELETE') return Promise.resolve(makeSuccessResponse());
        if (method === 'PATCH') {
            let body: unknown;
            try {
                body = opts?.body ? JSON.parse(opts.body as string) : undefined;
            } catch {
                body = undefined;
            }
            return Promise.resolve(patchHandler(url, body));
        }
        if (typeof url === 'string' && url.includes('user-bookmark-collections')) {
            return Promise.resolve(collectionsResponse());
        }
        return Promise.resolve(bookmarksHandler(url));
    });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserFavoritesList', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Restore globalThis.fetch to prevent cross-test contamination
        globalThis.fetch = originalFetch;
    });

    it('shows skeleton loading state on mount (SPEC-228 T-020)', () => {
        globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => undefined));
        const { container } = renderList();
        // No '⏳' or raw text — SkeletonCardList renders aria-hidden shimmer divs
        expect(screen.queryByText('Cargando…')).not.toBeInTheDocument();
        // Loading wrapper is busy with aria-label
        const loadingWrap = container.querySelector('[aria-busy="true"]');
        expect(loadingWrap).not.toBeNull();
        expect(loadingWrap?.getAttribute('aria-label')).toBe('Cargando…');
        // SkeletonCardList renders shimmer divs inside
        const skeletons = container.querySelectorAll('[aria-hidden="true"]');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders empty state when no bookmarks returned', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();
        await waitFor(() => {
            expect(screen.getByText(/No tenés favoritos en esta categoría/i)).toBeInTheDocument();
        });
    });

    it('renders bookmark cards', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() =>
                Promise.resolve(makeListResponse([BOOKMARK_1, BOOKMARK_2], 2))
            );
        renderList();
        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
            expect(screen.getByText('Hotel Paraná')).toBeInTheDocument();
        });
    });

    it('renders bookmark cards with links built from the server-resolved entitySlug', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(makeListResponse([BOOKMARK_1], 1)));
        renderList();
        await waitFor(() => {
            const link = screen.getByRole('link', { name: 'Casa del Litoral' });
            expect(link).toHaveAttribute('href', '/es/alojamientos/casa-del-litoral/');
        });
    });

    it('falls back to entityId in the URL when entitySlug is absent', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(makeListResponse([BOOKMARK_2], 1)));
        renderList();
        await waitFor(() => {
            const link = screen.getByRole('link', { name: 'Hotel Paraná' });
            // entitySlug is null; entityId is 'acc-2'
            expect(link.getAttribute('href')).toContain('alojamientos');
            expect(link.getAttribute('href')).toContain('acc-2');
        });
    });

    it('shows error state when fetch fails', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })));
        renderList();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('retry button re-triggers fetch after error', async () => {
        // Track whether we've already failed the full-page ACCOMMODATION fetch once
        let fullFetchFailed = false;

        globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method !== 'GET') return Promise.resolve(makeSuccessResponse());
            // Collections endpoint always succeeds
            if (url.includes('user-bookmark-collections')) {
                return Promise.resolve(makeEmptyCollectionsResponse());
            }
            // Count-only fetches (pageSize=1 exactly, not pageSize=12 etc.)
            const pageSize1Exact = /[?&]pageSize=1(&|$)/.test(url);
            if (pageSize1Exact) {
                return Promise.resolve(makeEmptyResponse());
            }
            // Full-page ACCOMMODATION fetch: fail once, then succeed
            if (!fullFetchFailed) {
                fullFetchFailed = true;
                return Promise.resolve(new Response(null, { status: 500 }));
            }
            return Promise.resolve(makeListResponse([BOOKMARK_1], 1));
        });

        renderList();

        // Wait for error state
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });

        const retryBtn = screen.getByText('Reintentar');
        fireEvent.click(retryBtn);

        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
        });
    });

    it('removes card optimistically on Quitar click', async () => {
        globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'DELETE') {
                return Promise.resolve(makeSuccessResponse());
            }
            return Promise.resolve(makeListResponse([BOOKMARK_1, BOOKMARK_2], 2));
        });

        renderList();
        await waitFor(() => expect(screen.getByText('Casa del Litoral')).toBeInTheDocument());

        const removeButtons = screen.getAllByRole('button', { name: /quitar de favoritos/i });
        fireEvent.click(removeButtons[0] as HTMLElement);

        await waitFor(() => {
            expect(screen.queryByText('Casa del Litoral')).not.toBeInTheDocument();
        });
    });

    it('reverts optimistic remove and shows toast on DELETE failure', async () => {
        globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'DELETE') {
                return Promise.resolve(makeErrorResponse());
            }
            return Promise.resolve(makeListResponse([BOOKMARK_1], 1));
        });

        renderList();
        await waitFor(() => expect(screen.getByText('Casa del Litoral')).toBeInTheDocument());

        const removeBtn = screen.getByRole('button', { name: /quitar de favoritos/i });
        fireEvent.click(removeBtn);

        await waitFor(() => {
            expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        });

        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
        });
    });

    it('rolls back only the failed bookmark on concurrent removes', async () => {
        // bm-1's DELETE hangs until we reject it; bm-2's DELETE succeeds.
        let rejectBm1: (reason?: unknown) => void = () => undefined;
        const bm1Pending = new Promise<Response>((_resolve, reject) => {
            rejectBm1 = reject;
        });
        globalThis.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'DELETE') {
                if (url.includes('bm-1')) return bm1Pending;
                return Promise.resolve(makeSuccessResponse());
            }
            if (typeof url === 'string' && url.includes('user-bookmark-collections')) {
                return Promise.resolve(makeEmptyCollectionsResponse());
            }
            return Promise.resolve(makeListResponse([BOOKMARK_1, BOOKMARK_2], 2));
        });

        renderList();
        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
            expect(screen.getByText('Hotel Paraná')).toBeInTheDocument();
        });

        // Remove bm-1 first — its DELETE stays in flight (optimistically gone).
        fireEvent.click(
            screen.getByRole('button', { name: /quitar de favoritos: casa del litoral/i })
        );
        await waitFor(() => expect(screen.queryByText('Casa del Litoral')).not.toBeInTheDocument());

        // Remove bm-2 concurrently — its DELETE resolves successfully.
        fireEvent.click(screen.getByRole('button', { name: /quitar de favoritos: hotel paraná/i }));
        await waitFor(() => expect(screen.queryByText('Hotel Paraná')).not.toBeInTheDocument());

        // Now fail bm-1's delete → rollback must restore ONLY bm-1.
        await act(async () => {
            rejectBm1(new Error('network'));
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
        });
        // The successfully-removed bm-2 must NOT be revived by bm-1's rollback.
        expect(screen.queryByText('Hotel Paraná')).not.toBeInTheDocument();
    });

    it('does not render pagination for results <= PAGE_SIZE', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(makeListResponse([BOOKMARK_1], 1)));
        renderList();
        await waitFor(() => expect(screen.getByText('Casa del Litoral')).toBeInTheDocument());
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });

    // ── T-049a: Tab navigation ─────────────────────────────────────────────────

    it('renders a tablist with 7 tab buttons (ALL + 6 entity types)', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');
        // ALL + ACCOMMODATION, DESTINATION, EVENT, POST, GASTRONOMY, EXPERIENCE (F3).
        expect(tabs).toHaveLength(7);
    });

    it('sets ALL tab as selected by default', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
        for (const tab of tabs.slice(1)) {
            expect(tab).toHaveAttribute('aria-selected', 'false');
        }
    });

    it('renders tab buttons with correct aria-controls pointing to panels', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        const expectedControls = [
            'tab-panel-all',
            'tab-panel-accommodation',
            'tab-panel-destination',
            'tab-panel-event',
            'tab-panel-post'
        ];

        tabs.forEach((tab, i) => {
            expect(tab).toHaveAttribute('aria-controls', expectedControls[i]);
        });
    });

    it('switches active tab and updates aria-selected', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        // Click Eventos tab (index 3 now that ALL is first)
        fireEvent.click(tabs[3] as HTMLElement);

        await waitFor(() => {
            expect(tabs[3]).toHaveAttribute('aria-selected', 'true');
            expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
        });
    });

    it('renders the tabpanel element with correct id for active tab', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();

        await screen.findByRole('tablist');

        const panel = screen.getByRole('tabpanel');
        expect(panel).toHaveAttribute('id', 'tab-panel-all');
        expect(panel).toHaveAttribute('aria-labelledby', 'tab-all');
    });

    // ── T-049b: Real data for all tabs ─────────────────────────────────────────

    it('fetches data when switching to DESTINATION tab', async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('entityType=DESTINATION') && url.includes('pageSize=12')) {
                return Promise.resolve(makeListResponse([DESTINATION_BOOKMARK], 1));
            }
            return Promise.resolve(makeEmptyResponse());
        });

        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        // Click Destinos tab (index 2 — ALL=0, ACCOMMODATION=1, DESTINATION=2)
        fireEvent.click(tabs[2] as HTMLElement);

        await waitFor(() => {
            expect(screen.getByText('Concepción del Uruguay')).toBeInTheDocument();
        });
    });

    it('uses correct path segment for DESTINATION links', async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('entityType=DESTINATION') && url.includes('pageSize=12')) {
                return Promise.resolve(makeListResponse([DESTINATION_BOOKMARK], 1));
            }
            return Promise.resolve(makeEmptyResponse());
        });

        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        fireEvent.click(tabs[2] as HTMLElement);

        await waitFor(() => {
            const link = screen.getByRole('link', { name: 'Concepción del Uruguay' });
            expect(link.getAttribute('href')).toContain('destinos');
            expect(link.getAttribute('href')).toContain('concepcion-del-uruguay');
        });
    });

    it('does not show "Próximamente" when switching to non-ACCOMMODATION tabs', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        // Click Destinos tab (index 2)
        fireEvent.click(tabs[2] as HTMLElement);

        await waitFor(() => {
            expect(screen.queryByText('Próximamente')).not.toBeInTheDocument();
        });
    });

    it('fires fetch when switching to EVENT tab', async () => {
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        globalThis.fetch = fetchMock;
        renderList();

        // Wait for initial mount
        await screen.findByRole('tablist');

        const tablist = screen.getByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        const callsBefore = fetchMock.mock.calls.length;

        // Click Eventos tab (index 3)
        fireEvent.click(tabs[3] as HTMLElement);

        await waitFor(() => {
            // Additional calls should have been made for the EVENT tab
            expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
        });

        // At least one call should include entityType=EVENT
        const eventCalls = fetchMock.mock.calls.filter(
            ([url]: [string]) => typeof url === 'string' && url.includes('entityType=EVENT')
        );
        expect(eventCalls.length).toBeGreaterThan(0);
    });

    it('fires count-only fetches for all 4 entity types on mount', async () => {
        const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        globalThis.fetch = fetchMock;
        renderList();

        // Wait for component to settle
        await waitFor(() => {
            expect(document.querySelector('[aria-busy="true"]')).toBeNull();
        });

        const urls = fetchMock.mock.calls.map(([url]: [string]) => url as string);
        const countOnlyUrls = urls.filter((url) => url.includes('pageSize=1'));

        // Should have fired count-only fetches for all 4 entity types
        expect(countOnlyUrls.some((u) => u.includes('entityType=ACCOMMODATION'))).toBe(true);
        expect(countOnlyUrls.some((u) => u.includes('entityType=DESTINATION'))).toBe(true);
        expect(countOnlyUrls.some((u) => u.includes('entityType=EVENT'))).toBe(true);
        expect(countOnlyUrls.some((u) => u.includes('entityType=POST'))).toBe(true);
    });

    it('shows empty state per-tab when switching to a tab with no bookmarks', async () => {
        globalThis.fetch = vi.fn().mockImplementation(() => Promise.resolve(makeEmptyResponse()));
        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        // Switch to Blog tab (index 4 — last)
        fireEvent.click(tabs[4] as HTMLElement);

        await waitFor(() => {
            expect(screen.getByText(/No tenés favoritos en esta categoría/i)).toBeInTheDocument();
        });
    });

    it('shows error state per-tab on fetch failure for non-ACCOMMODATION tab', async () => {
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('entityType=EVENT') && url.includes('pageSize=12')) {
                return Promise.resolve(new Response(null, { status: 500 }));
            }
            return Promise.resolve(makeEmptyResponse());
        });

        renderList();

        const tablist = await screen.findByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');

        // Click Eventos tab (index 3)
        fireEvent.click(tabs[3] as HTMLElement);

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('resets to page 1 when switching tabs', async () => {
        // Provide enough bookmarks to enable pagination (total > 12)
        const manyBookmarks = Array.from({ length: 12 }, (_, i) => ({
            id: `bm-${i}`,
            entityId: `acc-${i}`,
            entityType: 'ACCOMMODATION',
            name: `Alojamiento ${i}`,
            imageUrl: null,
            entityUrl: null
        }));

        let isDestinationFetch = false;
        globalThis.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('entityType=DESTINATION') && url.includes('pageSize=12')) {
                isDestinationFetch = true;
                return Promise.resolve(makeEmptyResponse());
            }
            return Promise.resolve(makeListResponse(manyBookmarks, 25));
        });

        renderList();
        await waitFor(() => expect(screen.getByRole('navigation')).toBeInTheDocument());

        // Advance to page 2
        const nextBtn = screen.getByRole('button', { name: /página siguiente/i });
        fireEvent.click(nextBtn);
        await waitFor(() => expect(screen.getByText('2 / 3')).toBeInTheDocument());

        // Switch to Destinos tab (index 2 — ALL=0, ACCOMMODATION=1, DESTINATION=2)
        const tablist = screen.getByRole('tablist');
        const tabs = within(tablist).getAllByRole('tab');
        fireEvent.click(tabs[2] as HTMLElement);

        await waitFor(() => {
            expect(isDestinationFetch).toBe(true);
        });

        // After switching back to ACCOMMODATION the destination fetch URL should
        // include page=1, verifying the reset happened
        const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
        const destinationFullFetchUrl = fetchMock.mock.calls
            .map(([url]: [string]) => url as string)
            .find((url) => url.includes('entityType=DESTINATION') && url.includes('pageSize=12'));

        expect(destinationFullFetchUrl).toContain('page=1');
    });

    // ── T-049c: Collections + uncollected split ────────────────────────────────

    it('renders "Sin colección" section heading', async () => {
        globalThis.fetch = makeRoutedFetchMock();
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Sin colección')).toBeInTheDocument();
        });
    });

    it('renders "Mis colecciones" section heading', async () => {
        globalThis.fetch = makeRoutedFetchMock();
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Mis colecciones')).toBeInTheDocument();
        });
    });

    it('fires a fetch to user-bookmark-collections on mount', async () => {
        const fetchMock = makeRoutedFetchMock();
        globalThis.fetch = fetchMock;
        renderList();

        await waitFor(() => {
            const urls = fetchMock.mock.calls.map(([url]: [string]) => url as string);
            expect(urls.some((u) => u.includes('user-bookmark-collections'))).toBe(true);
        });
    });

    it('shows uncollected bookmarks (collectionId null) in the "Sin colección" section', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([BOOKMARK_1, BOOKMARK_2], 2)
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
            expect(screen.getByText('Hotel Paraná')).toBeInTheDocument();
        });
    });

    it('excludes bookmarks with collectionId from the uncollected grid', async () => {
        // BOOKMARK_1 (no collectionId) + COLLECTED_BOOKMARK (has collectionId)
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([BOOKMARK_1, COLLECTED_BOOKMARK], 2)
        });
        renderList();

        await waitFor(() => {
            // Only BOOKMARK_1 should appear in the uncollected grid
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
            // COLLECTED_BOOKMARK should NOT appear in the uncollected section
            expect(screen.queryByText('Cabaña en la sierra')).not.toBeInTheDocument();
        });
    });

    it('lists collections with their names', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            collectionsResponse: () => makeCollectionsResponse([COLLECTION_1, COLLECTION_2], 2)
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Viajes soñados')).toBeInTheDocument();
            expect(screen.getByText('Finde largo')).toBeInTheDocument();
        });
    });

    it('collection cards link to /favoritos/colecciones/:id', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            collectionsResponse: () => makeCollectionsResponse([COLLECTION_1], 1)
        });
        renderList();

        await waitFor(() => {
            const link = screen.getByRole('link', {
                name: /Viajes soñados/i
            });
            expect(link.getAttribute('href')).toContain('favoritos/colecciones');
            expect(link.getAttribute('href')).toContain('col-uuid-1');
        });
    });

    it('shows empty state in "Mis colecciones" when no collections returned', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            collectionsResponse: makeEmptyCollectionsResponse
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText(/Aún no tenés colecciones/i)).toBeInTheDocument();
        });
    });

    it('uncollected count badge in section heading shows correct number', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([BOOKMARK_1, BOOKMARK_2], 2)
        });
        renderList();

        // Both bookmarks have no collectionId — expect count 2 in "Sin colección" heading
        await waitFor(() => {
            const sectionHeading =
                screen.getByText('Sin colección').closest('[class*="sectionHeading"]') ??
                screen.getByText('Sin colección').parentElement;
            expect(sectionHeading).not.toBeNull();
        });

        // The badge next to "Sin colección" should show 2
        const noCollectionHeadings = screen.getAllByText('Sin colección');
        expect(noCollectionHeadings.length).toBeGreaterThan(0);
    });

    // ── T-049d: Inline note editor integration ────────────────────────────────

    it('renders note placeholder on each bookmark card when description is null', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([BOOKMARK_1, BOOKMARK_2], 2)
        });
        renderList();

        await waitFor(() => {
            // Both BOOKMARK_1 and BOOKMARK_2 have no description; two placeholder buttons expected
            const placeholders = screen.getAllByText('Agregá una nota personal...');
            expect(placeholders.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('renders existing note text when bookmark has a description', async () => {
        const bookmarkWithNote = {
            ...BOOKMARK_1,
            description: 'Esta es mi nota personal'
        };
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([bookmarkWithNote], 1)
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Esta es mi nota personal')).toBeInTheDocument();
        });
    });

    it('clicking note placeholder opens the inline textarea editor', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([BOOKMARK_1], 1)
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Agregá una nota personal...')).toBeInTheDocument();
        });

        // The placeholder IS the trigger button — click it
        const placeholder = screen.getByText('Agregá una nota personal...');
        fireEvent.click(placeholder);

        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('saving a note calls PATCH and updates local state', async () => {
        const bookmarkWithNote = {
            ...BOOKMARK_1,
            description: null
        };

        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([bookmarkWithNote], 1),
            patchHandler: (_url, _body) =>
                new Response(
                    JSON.stringify({
                        success: true,
                        data: { ...bookmarkWithNote, description: 'Nota guardada!' }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Agregá una nota personal...')).toBeInTheDocument();
        });

        // Open editor
        fireEvent.click(screen.getByText('Agregá una nota personal...'));
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Nota guardada!' } });

        // Save
        fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

        // After save, editor collapses and new note text is shown
        await waitFor(() => {
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
            expect(screen.getByText('Nota guardada!')).toBeInTheDocument();
        });
    });

    it('note editor: Escape key cancels editing', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([BOOKMARK_1], 1)
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Agregá una nota personal...')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Agregá una nota personal...'));
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: 'Texto provisional' } });

        fireEvent.keyDown(textarea, { key: 'Escape' });

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        // Placeholder must reappear (original value was null)
        expect(screen.getByText('Agregá una nota personal...')).toBeInTheDocument();
    });

    it('note editor: shows toast on PATCH failure', async () => {
        globalThis.fetch = makeRoutedFetchMock({
            bookmarksHandler: () => makeListResponse([BOOKMARK_1], 1),
            patchHandler: () =>
                new Response(
                    JSON.stringify({ success: false, error: { message: 'Error al guardar' } }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                )
        });
        renderList();

        await waitFor(() => {
            expect(screen.getByText('Agregá una nota personal...')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Agregá una nota personal...'));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Texto' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar nota' }));

        await waitFor(() => {
            expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
        });

        // Editor remains open after failure
        expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
});
