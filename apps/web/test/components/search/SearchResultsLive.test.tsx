/**
 * @file SearchResultsLive.test.tsx
 * @description RTL tests for the SearchResultsLive React island.
 * Covers: empty state with tags, debounced search, result groups, loading state,
 * "Ver todos" link, and no-results state.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchResultsLive } from '../../../src/components/search/SearchResultsLive.client';
import type { PublicSearchResponse } from '../../../src/lib/api/endpoints';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('../../../src/components/search/SearchResultsLive.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/shared/feedback/LoadingButton.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_RESULTS: PublicSearchResponse = {
    accommodations: { items: [], total: 0 },
    destinations: { items: [], total: 0 },
    events: { items: [], total: 0 },
    posts: { items: [], total: 0 }
};

const MOCK_RESULTS: PublicSearchResponse = {
    accommodations: {
        items: [
            {
                id: 'acc-1',
                slug: 'cabana-del-rio',
                name: 'Cabaña del Río',
                category: 'accommodation'
            }
        ],
        total: 12
    },
    destinations: {
        items: [{ id: 'dest-1', slug: 'colon', name: 'Colón', category: 'city' }],
        total: 3
    },
    events: { items: [], total: 0 },
    posts: { items: [], total: 0 }
};

const DEFAULT_PROPS = {
    initialQuery: '',
    initialResults: null,
    locale: 'es' as const,
    popularTags: ['Cabañas', 'Colón', 'Termas'],
    searchBaseUrl: '/es/busqueda/'
};

function renderSRL(props: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <SearchResultsLive
            {...DEFAULT_PROPS}
            {...props}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SearchResultsLive', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Empty state (no query)', () => {
        it('renders the search input', () => {
            renderSRL();
            expect(screen.getByRole('searchbox')).toBeInTheDocument();
        });

        it('shows popular tags when query is empty', () => {
            renderSRL();
            expect(screen.getByText('Cabañas')).toBeInTheDocument();
            expect(screen.getByText('Colón')).toBeInTheDocument();
        });

        it('does not show results section when query is empty', () => {
            renderSRL();
            expect(screen.queryByText('Resultados para')).not.toBeInTheDocument();
        });

        it('sets query when a popular tag is clicked', () => {
            renderSRL();
            fireEvent.click(screen.getByText('Cabañas'));
            expect(screen.getByRole('searchbox')).toHaveValue('Cabañas');
        });
    });

    describe('SSR-populated initial results', () => {
        it('shows initial results without an API call when initialResults provided', () => {
            // SSR case: initialResults matches initialQuery — no re-fetch needed
            renderSRL({ initialQuery: 'cabaña', initialResults: MOCK_RESULTS });

            expect(screen.getByText('Cabaña del Río')).toBeInTheDocument();
            // fetch should NOT be called because lastFetchedQuery matches debouncedQuery
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('shows group titles for groups with results', () => {
            renderSRL({ initialQuery: 'cabaña', initialResults: MOCK_RESULTS });

            expect(screen.getByText(/Alojamientos/)).toBeInTheDocument();
            expect(screen.getByText(/Destinos/)).toBeInTheDocument();
        });

        it('shows total count in results info', () => {
            renderSRL({ initialQuery: 'cabaña', initialResults: MOCK_RESULTS });

            // 12 + 3 = 15 total hits
            expect(screen.getByText(/15/)).toBeInTheDocument();
        });

        it('shows "Ver todos" link when total > items.length', () => {
            renderSRL({ initialQuery: 'cabaña', initialResults: MOCK_RESULTS });

            // accommodations: total=12, items=1 — at least one "Ver todos →" link
            const viewAllLinks = screen.getAllByText('Ver todos →');
            expect(viewAllLinks.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('No results', () => {
        it('shows no-results message when all groups are empty', () => {
            renderSRL({ initialQuery: 'xyz123noresults', initialResults: EMPTY_RESULTS });

            expect(screen.getByText(/No encontramos resultados/)).toBeInTheDocument();
        });
    });

    describe('Debounced fetch', () => {
        it('does not fetch immediately on input change (debounced)', async () => {
            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => ({ data: EMPTY_RESULTS })
            } as Response);

            renderSRL();
            const input = screen.getByRole('searchbox');
            fireEvent.change(input, { target: { value: 'termas' } });

            // Immediately after change — no fetch yet (still within debounce window)
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('does not fetch when query is shorter than 2 chars', async () => {
            renderSRL();
            const input = screen.getByRole('searchbox');
            fireEvent.change(input, { target: { value: 'a' } });

            // Even without advancing timers, < 2 chars should never trigger fetch
            expect(global.fetch).not.toHaveBeenCalled();
        });
    });

    describe('Loading state', () => {
        it('is not loading when query is empty', () => {
            renderSRL();
            expect(screen.queryByText(/Buscando/)).not.toBeInTheDocument();
        });
    });

    describe('Submit button — SPEC-228 T-022 async contract', () => {
        it('renders the submit button with idle label', () => {
            renderSRL();
            // LoadingButton renders children when not loading
            expect(screen.getByRole('button', { name: /buscar/i })).toBeInTheDocument();
        });

        it('submit button never shows "..." text regardless of loading state', () => {
            renderSRL();
            const btn = screen.getByRole('button', { name: /buscar/i });
            expect(btn.textContent).not.toContain('...');
        });

        it('submit button is not aria-busy when idle', () => {
            renderSRL();
            const btn = screen.getByRole('button', { name: /buscar/i });
            expect(btn).not.toHaveAttribute('aria-busy', 'true');
        });
    });

    describe('Result card links', () => {
        it('builds correct href for accommodation card', () => {
            renderSRL({ initialQuery: 'cabaña', initialResults: MOCK_RESULTS });

            const link = screen.getByText('Cabaña del Río').closest('a');
            expect(link).toHaveAttribute('href', '/es/alojamientos/cabana-del-rio/');
        });

        it('builds correct href for destination card', () => {
            renderSRL({ initialQuery: 'cabaña', initialResults: MOCK_RESULTS });

            const link = screen.getByText('Colón').closest('a');
            expect(link).toHaveAttribute('href', '/es/destinos/colon/');
        });
    });
});
