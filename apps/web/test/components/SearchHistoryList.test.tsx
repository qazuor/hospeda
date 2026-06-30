/**
 * @file SearchHistoryList.test.tsx
 * @description RTL tests for the SearchHistoryList React island (SPEC-289 P3).
 *
 * Covers:
 *  - Loading state renders "Cargando historial..."
 *  - API error state renders an alert
 *  - Empty state (no entries) renders the empty-state message
 *  - Entry list renders query text and relative time
 *  - Re-run link has correct href (rebuilds search URL from stored filters)
 *  - Delete-one shows inline confirmation then calls DELETE /:id
 *  - Clear-all shows inline confirmation then calls DELETE /
 *  - Opt-out toggle calls PATCH /preferences and updates aria-checked
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchHistoryList } from '../../src/components/account/SearchHistoryList.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (!fallback) return _key;
            if (!params) return fallback;
            // Simple {{key}} interpolation for test assertions
            return Object.entries(params).reduce(
                (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
                fallback
            );
        },
        tPlural: (_key: string, count: number) => `${count} filtro(s)`
    })
}));

vi.mock('../../src/lib/format-utils', () => ({
    formatRelativeTime: () => 'hace 2 días'
}));

vi.mock('../../src/components/account/SearchHistoryList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const API_URL = 'http://localhost:3001';
const LOCALE = 'es' as const;
const USER_ID = 'user-uuid-001';

const ENTRY_1 = {
    id: 'entry-001',
    userId: USER_ID,
    queryText: 'cabaña con pileta',
    filtersJson: { minGuests: 4, hasPool: true },
    resultCount: 12,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
};

const ENTRY_2 = {
    id: 'entry-002',
    userId: USER_ID,
    queryText: null,
    filtersJson: { destinationId: 'dest-uuid-001', minPrice: 1000, maxPrice: 5000 },
    resultCount: 3,
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
};

/** Default successful list response */
function makeListResponse(items = [ENTRY_1, ENTRY_2]) {
    return {
        ok: true,
        json: async () => ({ success: true, data: { items } })
    } as Response;
}

/** Empty list response */
function makeEmptyListResponse() {
    return {
        ok: true,
        json: async () => ({ success: true, data: { items: [] } })
    } as Response;
}

/** Error response */
function makeErrorResponse(status = 500, message = 'Server error') {
    return {
        ok: false,
        status,
        json: async () => ({ success: false, error: { message } })
    } as Response;
}

/** Default successful mutation response */
function makeMutationResponse() {
    return {
        ok: true,
        json: async () => ({ success: true })
    } as Response;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderComponent(
    overrides: Partial<{
        initialHistoryEnabled: boolean;
    }> = {}
) {
    return render(
        <SearchHistoryList
            locale={LOCALE}
            apiUrl={API_URL}
            userId={USER_ID}
            initialHistoryEnabled={overrides.initialHistoryEnabled ?? true}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchHistoryList', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    // ── 1. Loading state ───────────────────────────────────────────────────────

    describe('Loading state', () => {
        it('shows loading text while fetch is in flight', async () => {
            vi.mocked(global.fetch).mockImplementationOnce(
                () => new Promise<Response>(() => {}) // never resolves
            );
            renderComponent();
            expect(screen.getByText(/cargando historial/i)).toBeInTheDocument();
        });
    });

    // ── 2. Error state ─────────────────────────────────────────────────────────

    describe('Error state', () => {
        it('shows an alert when the fetch fails', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeErrorResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getByRole('alert')).toBeInTheDocument();
            });
        });

        it('shows a retry button on error', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeErrorResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
            });
        });
    });

    // ── 3. Empty state ─────────────────────────────────────────────────────────

    describe('Empty state', () => {
        it('shows empty-state message when there are no entries', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEmptyListResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/sin búsquedas guardadas/i)).toBeInTheDocument();
            });
        });

        it('does NOT render the list when empty', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEmptyListResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.queryByRole('list')).not.toBeInTheDocument();
            });
        });
    });

    // ── 4. Entry list ──────────────────────────────────────────────────────────

    describe('Entry list', () => {
        it('renders entry query text', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse());
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('cabaña con pileta')).toBeInTheDocument();
            });
        });

        it('renders "Búsqueda sin texto" for null queryText', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_2]));
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/búsqueda sin texto/i)).toBeInTheDocument();
            });
        });

        it('renders relative time for each entry', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('hace 2 días')).toBeInTheDocument();
            });
        });

        it('renders result count for entries that have it', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText(/12 resultados/i)).toBeInTheDocument();
            });
        });
    });

    // ── 5. Re-run link ─────────────────────────────────────────────────────────

    describe('Re-run link', () => {
        it('renders a re-run link for each entry', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                const links = screen.getAllByRole('link', { name: /repetir búsqueda/i });
                expect(links.length).toBeGreaterThan(0);
            });
        });

        it('re-run link contains the query text as q param', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                const links = screen.getAllByRole('link', { name: /repetir búsqueda/i });
                const href = links[0]?.getAttribute('href') ?? '';
                expect(href).toContain('q=caba%C3%B1a+con+pileta');
            });
        });

        it('re-run link for null queryText does not include q param', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_2]));
            renderComponent();
            await waitFor(() => {
                const links = screen.getAllByRole('link', { name: /repetir búsqueda/i });
                const href = links[0]?.getAttribute('href') ?? '';
                expect(href).not.toContain('q=');
            });
        });

        it('re-run link includes destinationIds from filtersJson', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_2]));
            renderComponent();
            await waitFor(() => {
                const links = screen.getAllByRole('link', { name: /repetir búsqueda/i });
                const href = links[0]?.getAttribute('href') ?? '';
                expect(href).toContain('destinationIds=dest-uuid-001');
            });
        });

        it('re-run link maps minGuests to adults and hasPool to hasPool=true', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                const links = screen.getAllByRole('link', { name: /repetir búsqueda/i });
                const href = links[0]?.getAttribute('href') ?? '';
                expect(href).toContain('adults=4');
                expect(href).toContain('hasPool=true');
            });
        });
    });

    // ── 6. Delete one ──────────────────────────────────────────────────────────

    describe('Delete one', () => {
        it('shows inline confirm buttons on delete click', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('cabaña con pileta')).toBeInTheDocument();
            });

            const deleteBtn = screen.getByRole('button', {
                name: /eliminar.*cabaña/i
            });
            fireEvent.click(deleteBtn);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /sí, eliminar/i })).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
            });
        });

        it('calls DELETE /:id on confirm', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeListResponse([ENTRY_1]))
                .mockResolvedValueOnce(makeMutationResponse());

            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('cabaña con pileta')).toBeInTheDocument();
            });

            const deleteBtn = screen.getByRole('button', {
                name: /eliminar.*cabaña/i
            });
            fireEvent.click(deleteBtn);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /sí, eliminar/i })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }));

            await waitFor(() => {
                const calls = vi.mocked(global.fetch).mock.calls;
                const deleteCall = calls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        url.includes(`/search-history/${ENTRY_1.id}`) &&
                        (opts as RequestInit)?.method === 'DELETE'
                );
                expect(deleteCall).toBeDefined();
            });
        });

        it('removes the deleted entry from the list', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeListResponse([ENTRY_1, ENTRY_2]))
                .mockResolvedValueOnce(makeMutationResponse());

            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('cabaña con pileta')).toBeInTheDocument();
            });

            const deleteBtn = screen.getByRole('button', {
                name: /eliminar.*cabaña/i
            });
            fireEvent.click(deleteBtn);
            fireEvent.click(screen.getByRole('button', { name: /sí, eliminar/i }));

            await waitFor(() => {
                expect(screen.queryByText('cabaña con pileta')).not.toBeInTheDocument();
                // ENTRY_2 "Búsqueda sin texto" should still be there
                expect(screen.getByText(/búsqueda sin texto/i)).toBeInTheDocument();
            });
        });

        it('cancels inline confirm without deleting', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('cabaña con pileta')).toBeInTheDocument();
            });

            const deleteBtn = screen.getByRole('button', {
                name: /eliminar.*cabaña/i
            });
            fireEvent.click(deleteBtn);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

            await waitFor(() => {
                expect(screen.getByText('cabaña con pileta')).toBeInTheDocument();
            });
            // Only 1 fetch call (the initial list fetch)
            expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
        });
    });

    // ── 7. Clear all ───────────────────────────────────────────────────────────

    describe('Clear all', () => {
        it('shows clear-all button when entries exist', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /borrar todo/i })).toBeInTheDocument();
            });
        });

        it('shows inline confirmation on clear-all click', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeListResponse([ENTRY_1]));
            renderComponent();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /borrar todo/i })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /borrar todo/i }));

            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /sí, borrar todo/i })
                ).toBeInTheDocument();
            });
        });

        it('calls DELETE / on confirm clear-all', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeListResponse([ENTRY_1]))
                .mockResolvedValueOnce(makeMutationResponse());

            renderComponent();
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /borrar todo/i })).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /borrar todo/i }));
            await waitFor(() => {
                expect(
                    screen.getByRole('button', { name: /sí, borrar todo/i })
                ).toBeInTheDocument();
            });
            fireEvent.click(screen.getByRole('button', { name: /sí, borrar todo/i }));

            await waitFor(() => {
                const calls = vi.mocked(global.fetch).mock.calls;
                const clearCall = calls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        url.includes('/search-history') &&
                        !url.includes('/preferences') &&
                        !url.includes('/search-history/') &&
                        (opts as RequestInit)?.method === 'DELETE'
                );
                expect(clearCall).toBeDefined();
            });
        });

        it('empties the list after clear-all', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeListResponse([ENTRY_1]))
                .mockResolvedValueOnce(makeMutationResponse());

            renderComponent();
            await waitFor(() => {
                expect(screen.getByText('cabaña con pileta')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('button', { name: /borrar todo/i }));
            fireEvent.click(screen.getByRole('button', { name: /sí, borrar todo/i }));

            await waitFor(() => {
                expect(screen.getByText(/sin búsquedas guardadas/i)).toBeInTheDocument();
            });
        });
    });

    // ── 8. Opt-out toggle ──────────────────────────────────────────────────────

    describe('Opt-out toggle', () => {
        it('renders the toggle with aria-checked=true when enabled', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEmptyListResponse());
            renderComponent({ initialHistoryEnabled: true });
            await waitFor(() => {
                const toggle = screen.getByRole('switch');
                expect(toggle).toHaveAttribute('aria-checked', 'true');
            });
        });

        it('renders the toggle with aria-checked=false when disabled', async () => {
            vi.mocked(global.fetch).mockResolvedValueOnce(makeEmptyListResponse());
            renderComponent({ initialHistoryEnabled: false });
            await waitFor(() => {
                const toggle = screen.getByRole('switch');
                expect(toggle).toHaveAttribute('aria-checked', 'false');
            });
        });

        it('calls PATCH /preferences when toggled', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeEmptyListResponse())
                .mockResolvedValueOnce(makeMutationResponse());

            renderComponent({ initialHistoryEnabled: true });
            await waitFor(() => {
                expect(screen.getByRole('switch')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('switch'));

            await waitFor(() => {
                const calls = vi.mocked(global.fetch).mock.calls;
                const patchCall = calls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        url.includes('/search-history/preferences') &&
                        (opts as RequestInit)?.method === 'PATCH'
                );
                expect(patchCall).toBeDefined();
            });
        });

        it('sends { enabled: false } when toggling from enabled to disabled', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeEmptyListResponse())
                .mockResolvedValueOnce(makeMutationResponse());

            renderComponent({ initialHistoryEnabled: true });
            await waitFor(() => {
                expect(screen.getByRole('switch')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole('switch'));

            await waitFor(() => {
                const calls = vi.mocked(global.fetch).mock.calls;
                const patchCall = calls.find(
                    ([url, opts]) =>
                        typeof url === 'string' &&
                        url.includes('/preferences') &&
                        (opts as RequestInit)?.method === 'PATCH'
                );
                expect(patchCall).toBeDefined();
                const body = JSON.parse((patchCall?.[1] as RequestInit)?.body as string) as {
                    enabled: boolean;
                };
                expect(body.enabled).toBe(false);
            });
        });

        it('reverts aria-checked on PATCH failure', async () => {
            vi.mocked(global.fetch)
                .mockResolvedValueOnce(makeEmptyListResponse())
                .mockResolvedValueOnce(makeErrorResponse());

            renderComponent({ initialHistoryEnabled: true });
            await waitFor(() => {
                expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
            });

            fireEvent.click(screen.getByRole('switch'));

            // After revert the toggle should be back to true
            await waitFor(() => {
                expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
            });
        });
    });
});
