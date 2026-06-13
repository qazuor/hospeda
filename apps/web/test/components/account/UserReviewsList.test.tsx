/**
 * @file UserReviewsList.test.tsx
 * @description Unit tests for the UserReviewsList React island (T-039).
 *
 * Covers:
 * - Loading state shown on mount
 * - Empty state when no reviews
 * - Renders accommodation and destination review cards
 * - Shows rating badge when rating is present
 * - Shows date formatted
 * - Shows entity link when entityUrl is present
 * - Error state on fetch failure
 * - Pagination not shown for <= PAGE_SIZE items
 */

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserReviewsList } from '../../../src/components/account/UserReviewsList.client';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../src/components/account/UserReviewsList.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

vi.mock('../../../src/lib/i18n', () => {
    const t = (key: string, fallback?: string): string => fallback ?? key;
    // tPlural was added in commit b138f3cbb ("fix(web,i18n): show review title
    // and pluralise the totals line"). Returns a simple string with the count.
    const tPlural = (key: string, count: number, _params?: Record<string, unknown>): string =>
        `${count} ${key}`;
    const translations = { t, tPlural } as const;
    return { createTranslations: () => translations };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ACCOMMODATION_REVIEW = {
    id: 'rev-acc-1',
    rating: {
        cleanliness: 5,
        hospitality: 4,
        services: 4,
        accuracy: 5,
        communication: 4,
        location: 5
    },
    title: 'Excelente estadía',
    content: 'Muy buen lugar, limpio y cómodo.',
    createdAt: '2025-01-15T10:00:00Z',
    accommodationId: 'acc-1',
    accommodationName: 'Casa del Litoral',
    accommodationSlug: 'casa-del-litoral'
};

const DESTINATION_REVIEW = {
    id: 'rev-dst-1',
    // Destination ratings are a multi-aspect object (0-5 per aspect), same shape
    // as accommodation — not a bare number. The client averages it.
    rating: {
        landscape: 4,
        safety: 4,
        cleanliness: 3,
        gastronomy: 5
    },
    title: null,
    content: 'Destino hermoso.',
    createdAt: '2025-02-20T10:00:00Z',
    destinationId: 'dst-1',
    destinationName: 'Concepción del Uruguay',
    destinationSlug: 'concepcion-del-uruguay'
};

function makeReviewsResponse(
    accommodationReviews: (typeof ACCOMMODATION_REVIEW)[] = [],
    destinationReviews: (typeof DESTINATION_REVIEW)[] = []
) {
    return new Response(
        JSON.stringify({
            success: true,
            data: {
                accommodationReviews,
                destinationReviews,
                totals: {
                    accommodationReviews: accommodationReviews.length,
                    destinationReviews: destinationReviews.length,
                    total: accommodationReviews.length + destinationReviews.length
                }
            }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
}

function renderList() {
    return render(
        <UserReviewsList
            locale="es"
            apiUrl="http://localhost:3001"
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserReviewsList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows loading state on mount', () => {
        globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => undefined));
        renderList();
        expect(screen.getByText('Cargando…')).toBeInTheDocument();
    });

    it('renders empty state when no reviews', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(makeReviewsResponse([], []));
        renderList();
        await waitFor(() => {
            expect(screen.getByText(/Todavía no escribiste reseñas/i)).toBeInTheDocument();
        });
    });

    it('renders accommodation review card', async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(makeReviewsResponse([ACCOMMODATION_REVIEW], []));
        renderList();
        await waitFor(() => {
            expect(screen.getByText('Casa del Litoral')).toBeInTheDocument();
            expect(screen.getByText('Muy buen lugar, limpio y cómodo.')).toBeInTheDocument();
        });
    });

    it('renders destination review card', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(makeReviewsResponse([], [DESTINATION_REVIEW]));
        renderList();
        await waitFor(() => {
            expect(screen.getByText('Concepción del Uruguay')).toBeInTheDocument();
            expect(screen.getByText('Destino hermoso.')).toBeInTheDocument();
        });
    });

    it('shows rating badge for accommodation review', async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(makeReviewsResponse([ACCOMMODATION_REVIEW], []));
        renderList();
        await waitFor(() => {
            // average of [5,4,4,5,4,5] = 4.5
            const badge = screen.getByLabelText(/calificación/i);
            expect(badge).toBeInTheDocument();
            expect(badge.textContent).toContain('4.5');
        });
    });

    it('renders entity link when slug is available', async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(makeReviewsResponse([ACCOMMODATION_REVIEW], []));
        renderList();
        await waitFor(() => {
            const link = screen.getByRole('link', { name: 'Casa del Litoral' });
            // Entity links are locale-prefixed via buildUrl (locale="es" here).
            expect(link).toHaveAttribute('href', '/es/alojamientos/casa-del-litoral/');
        });
    });

    it('shows error state on fetch failure', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
        renderList();
        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });

    it('does not render pagination for results <= PAGE_SIZE', async () => {
        globalThis.fetch = vi
            .fn()
            .mockResolvedValue(makeReviewsResponse([ACCOMMODATION_REVIEW], []));
        renderList();
        await waitFor(() => expect(screen.getByText('Casa del Litoral')).toBeInTheDocument());
        expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    });
});
