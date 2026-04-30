/**
 * @file UserFavoritesList.test.tsx
 * @description Unit tests for the UserFavoritesList React island (T-038).
 *
 * Covers:
 * - Loading state shown on mount
 * - Empty state shown when API returns zero bookmarks
 * - Grid of cards rendered when bookmarks are returned
 * - "Quitar" button triggers optimistic remove (card disappears)
 * - Error state shown when fetch fails
 * - Pagination nav not rendered when total <= PAGE_SIZE
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFavoritesList } from '../../../src/components/account/UserFavoritesList.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/UserFavoritesList.module.css', () => ({
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
    imageUrl: null,
    entityUrl: '/alojamientos/casa-del-litoral/'
};

const BOOKMARK_2 = {
    id: 'bm-2',
    entityId: 'acc-2',
    entityType: 'ACCOMMODATION',
    name: 'Hotel Paraná',
    imageUrl: 'https://cdn.example.com/hotel.jpg',
    entityUrl: null
};

/** Create a fresh Response each time to avoid body-consumed issues */
function makeListResponse(bookmarks: (typeof BOOKMARK_1)[], total: number) {
    return new Response(JSON.stringify({ success: true, data: { bookmarks, total } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserFavoritesList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows loading state on mount', () => {
        globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => undefined));
        renderList();
        expect(screen.getByText('Cargando…')).toBeInTheDocument();
    });

    it('renders empty state when no bookmarks returned', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(makeListResponse([], 0)));
        renderList();
        await waitFor(() => {
            expect(screen.getByText(/Aún no tenés alojamientos favoritos/i)).toBeInTheDocument();
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

    it('shows error state when fetch fails', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(new Response(null, { status: 500 })));
        renderList();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('removes card optimistically on Quitar click', async () => {
        // Use URL/method-based routing to handle StrictMode double-effects
        globalThis.fetch = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
            const method = opts?.method ?? 'GET';
            if (method === 'DELETE') {
                return Promise.resolve(makeSuccessResponse());
            }
            // GET list
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
        const { addToast } = await import('../../../src/store/toast-store');
        // Use method-based routing: GET returns list, DELETE returns error
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

        // Card is restored after revert
        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
        });
    });

    it('does not render pagination for results <= PAGE_SIZE', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation(() => Promise.resolve(makeListResponse([BOOKMARK_1], 1)));
        renderList();
        await waitFor(() => expect(screen.getByText('Casa del Litoral')).toBeInTheDocument());
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
});
