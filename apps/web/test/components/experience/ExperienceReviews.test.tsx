/**
 * @file ExperienceReviews.test.tsx
 * @description RTL tests for the ExperienceReviews React island (SPEC-240 T-028).
 *
 * Covers:
 * - Renders initial reviews
 * - Empty state when no reviews provided
 * - "Load more" button absent when no more pages
 * - SPEC-228 T-022: "Load more" button shows Spinner instead of '...' while loading
 * - SPEC-228 T-022: button carries aria-busy=true while loading
 * - SPEC-228 T-022: '...' text never appears on the button
 */

import { ExperienceReviews } from '@/components/experience/ExperienceReviews.client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExperienceReviewPublicItem } from '../../../src/lib/api/endpoints';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/shared/feedback/Spinner.module.css', () => ({
    default: new Proxy({} as Record<string, string>, {
        get: (_target, prop) => String(prop)
    })
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const REVIEW_1: ExperienceReviewPublicItem = {
    id: 'rev-1',
    averageRating: 4.5,
    title: 'Great experience',
    content: 'Loved it!',
    createdAt: '2026-01-01T00:00:00Z',
    user: { name: 'Alice', image: null }
};

const REVIEW_2: ExperienceReviewPublicItem = {
    id: 'rev-2',
    averageRating: 3,
    title: 'It was okay',
    content: 'Decent.',
    createdAt: '2026-01-02T00:00:00Z',
    user: { name: 'Bob', image: null }
};

const DEFAULT_PROPS = {
    experienceId: 'exp-abc',
    initialReviews: [REVIEW_1] as readonly ExperienceReviewPublicItem[],
    totalReviews: 6,
    averageRating: 4.5,
    locale: 'es' as const,
    isAuthenticated: false
};

function renderReviews(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    return render(
        <ExperienceReviews
            {...DEFAULT_PROPS}
            {...overrides}
        />
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExperienceReviews', () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Initial render', () => {
        it('renders the section heading', () => {
            renderReviews();
            expect(screen.getByRole('heading', { name: /reseñas/i })).toBeInTheDocument();
        });

        it('renders the initial review', () => {
            renderReviews();
            expect(screen.getByText('Great experience')).toBeInTheDocument();
            expect(screen.getByText('Alice')).toBeInTheDocument();
        });

        it('shows empty state when no reviews', () => {
            renderReviews({ initialReviews: [], totalReviews: 0 });
            expect(screen.getByText(/Todavía no hay reseñas/i)).toBeInTheDocument();
        });

        it('hides "load more" when total matches initial count', () => {
            renderReviews({ totalReviews: 1 });
            expect(screen.queryByRole('button', { name: /más reseñas/i })).not.toBeInTheDocument();
        });
    });

    describe('Load more — SPEC-228 T-022 async contract', () => {
        it('shows "load more" button when total > initial count', () => {
            renderReviews();
            expect(screen.getByRole('button', { name: /más reseñas/i })).toBeInTheDocument();
        });

        it('"load more" button never contains "..." text in idle state', () => {
            renderReviews();
            const btn = screen.getByRole('button', { name: /más reseñas/i });
            expect(btn.textContent).not.toContain('...');
        });

        it('"load more" button is NOT aria-busy when idle', () => {
            renderReviews();
            const btn = screen.getByRole('button', { name: /más reseñas/i });
            expect(btn).not.toHaveAttribute('aria-busy', 'true');
        });

        it('shows Spinner (role="status") while loading more reviews', async () => {
            // Fetch never resolves — keeps loading state active
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

            renderReviews();
            fireEvent.click(screen.getByRole('button', { name: /más reseñas/i }));

            await waitFor(() => {
                expect(screen.getByRole('status')).toBeInTheDocument();
            });
        });

        it('"load more" button is aria-busy=true while loading', async () => {
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

            renderReviews();
            fireEvent.click(screen.getByRole('button', { name: /más reseñas/i }));

            await waitFor(() => {
                // When loading, the button name changes to the Spinner label.
                // Query by aria-busy attribute instead of the idle name.
                const btn = document.querySelector('button[aria-busy="true"]');
                expect(btn).not.toBeNull();
            });
        });

        it('"load more" button is disabled while loading', async () => {
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

            renderReviews();
            fireEvent.click(screen.getByRole('button', { name: /más reseñas/i }));

            await waitFor(() => {
                const btn = document.querySelector('button[aria-busy="true"]');
                expect(btn).toHaveAttribute('disabled');
            });
        });

        it('does NOT show "..." text anywhere while loading', async () => {
            vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

            renderReviews();
            fireEvent.click(screen.getByRole('button', { name: /más reseñas/i }));

            await waitFor(() => {
                expect(screen.getByRole('status')).toBeInTheDocument();
            });

            expect(document.body.textContent).not.toContain('...');
        });

        it('appends new reviews and hides Spinner after successful load', async () => {
            const PAGE_2_RESPONSE = {
                data: {
                    items: [REVIEW_2],
                    pagination: { totalPages: 2 }
                }
            };
            vi.mocked(global.fetch).mockResolvedValue({
                ok: true,
                json: async () => PAGE_2_RESPONSE
            } as Response);

            renderReviews();
            fireEvent.click(screen.getByRole('button', { name: /más reseñas/i }));

            await waitFor(() => {
                expect(screen.getByText('Bob')).toBeInTheDocument();
            });

            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
    });
});
