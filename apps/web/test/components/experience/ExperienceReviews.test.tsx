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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExperienceReviewsProps } from '@/components/experience/ExperienceReviews.client';
import { ExperienceReviews } from '@/components/experience/ExperienceReviews.client';
import { apiClient } from '@/lib/api/client';
import type { ExperienceReviewPublicItem } from '../../../src/lib/api/endpoints';
import { buildAuthSnapshot } from '../../helpers/auth-session';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/lib/api/client', () => ({ apiClient: { postProtected: vi.fn() } }));

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (key: string, fallback?: string) =>
            fallback ??
            (
                {
                    'review.list.firstReview': 'Sé el primero en reseñar',
                    'review.venueSidebar.cta': 'Dejar reseña'
                } as Record<string, string>
            )[key] ??
            key,
        tPlural: (key: string, count: number) =>
            key === 'experience.reviews.more' ? `+ ${count} más reseñas` : `${key} ${count}`
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

// HOS-369 WB0-4: the component resolves the session client-side via
// `useAccountPermissions`, which reads `auth-cache`. See test/helpers/auth-session.ts.
const mockReadCachedAuthMe = vi.fn();

vi.mock('@/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => new Promise(() => undefined),
    writeCachedAuthMe: () => undefined,
    resetInFlightAuthMe: () => undefined
}));

const DEFAULT_PROPS = {
    signInHref: '/es/auth/signin/',
    experienceId: 'exp-abc',
    initialReviews: [REVIEW_1] as readonly ExperienceReviewPublicItem[],
    totalReviews: 6,
    averageRating: 4.5,
    locale: 'es' as const
};

/**
 * Render the section for a guest by default. `isAuthenticated` is no longer a
 * prop — it arranges the session the component resolves.
 */
function renderReviews({
    isAuthenticated = false,
    ...overrides
}: Partial<typeof DEFAULT_PROPS> & { readonly isAuthenticated?: boolean } = {}) {
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated }));
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
        vi.mocked(apiClient.postProtected).mockReset().mockResolvedValue({ ok: true, data: {} });
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
            expect(screen.getByRole('link', { name: 'Sé el primero en reseñar' })).toHaveAttribute(
                'href',
                DEFAULT_PROPS.signInHref
            );
        });

        it('hides "load more" when total matches initial count', () => {
            renderReviews({ totalReviews: 1 });
            expect(screen.queryByRole('button', { name: /más reseñas/i })).not.toBeInTheDocument();
        });
    });

    describe('review card rating (HOS-2082)', () => {
        it('shows the reviewer overallRating, not the dimension mean', () => {
            // Arrange: overall 2 chosen by the reviewer, dimension mean 5
            renderReviews({
                initialReviews: [{ ...REVIEW_1, overallRating: 2, averageRating: 5 }],
                averageRating: 4.5
            });
            // Assert
            expect(screen.getByText('2.0')).toBeInTheDocument();
            expect(screen.queryByText('5.0')).not.toBeInTheDocument();
        });

        it('falls back to averageRating when overallRating is absent', () => {
            renderReviews({
                initialReviews: [{ ...REVIEW_1, overallRating: null, averageRating: 3 }],
                averageRating: 4.5
            });
            expect(screen.getByText('3.0')).toBeInTheDocument();
        });
    });

    describe('client-side session resolution (HOS-369 WB0-4)', () => {
        it('hides the review CTA for a guest', () => {
            renderReviews({ isAuthenticated: false });
            expect(screen.queryByText('Dejar reseña')).not.toBeInTheDocument();
        });

        it('no longer accepts isAuthenticated — removed from ExperienceReviewsProps (HOS-369 WB0-5)', () => {
            // Assert — this only typechecks if the field is gone. If a future
            // change resurrects it, `@ts-expect-error` starts reporting an
            // unused-directive error and typecheck fails.
            // @ts-expect-error — isAuthenticated was removed; session is resolved client-side via useAccountPermissions.
            const props: ExperienceReviewsProps = {
                ...DEFAULT_PROPS,
                isAuthenticated: false
            };
            expect(props.experienceId).toBe(DEFAULT_PROPS.experienceId);
        });

        it('shows the review CTA for a signed-in visitor — state comes only from the session, never a prop', () => {
            // Cached anonymous HTML served to a reader who has a session.
            // There is no prop left that could disagree with that session.
            mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot({ isAuthenticated: true }));
            render(<ExperienceReviews {...DEFAULT_PROPS} />);

            expect(screen.getByText('Dejar reseña')).toBeInTheDocument();
        });
    });

    describe('Review submission', () => {
        function openReviewForm() {
            renderReviews({ isAuthenticated: true });
            fireEvent.click(screen.getByRole('button', { name: 'Dejar reseña' }));
            return {
                rating: screen.getByRole<HTMLSelectElement>('combobox', {
                    name: 'review.form.overallLabel'
                }),
                submit: screen.getByRole('button', { name: 'review.form.submitButton' })
            };
        }

        it('posts the selected rating and trimmed comment and shows the moderation status', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue({ ok: true, data: {} });
            const { rating, submit } = openReviewForm();

            fireEvent.change(rating, { target: { value: '5' } });
            fireEvent.change(screen.getByRole('textbox', { name: 'review.form.contentLabel' }), {
                target: { value: '  A wonderful experience  ' }
            });
            fireEvent.click(submit);

            expect(apiClient.postProtected).toHaveBeenCalledExactlyOnceWith({
                path: '/api/v1/protected/experiences/exp-abc/reviews',
                body: { overallRating: 5, content: 'A wonderful experience' }
            });
            expect(await screen.findByRole('status')).toHaveTextContent(
                'review.venueSidebar.pendingTitle'
            );
            expect(submit).not.toBeInTheDocument();
        });

        it('shows an error and keeps the form open when the API rejects the review', async () => {
            vi.mocked(apiClient.postProtected).mockResolvedValue({
                ok: false,
                error: { code: 'VALIDATION_ERROR', message: 'Rejected' }
            });
            const { rating, submit } = openReviewForm();

            fireEvent.change(rating, { target: { value: '1' } });
            fireEvent.click(submit);

            expect(await screen.findByRole('alert')).toHaveTextContent(
                'review.form.errors.submitFailed'
            );
            expect(submit).toBeEnabled();
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        it('starts with no rating selected and explains why the review was not sent', () => {
            const { rating, submit } = openReviewForm();

            fireEvent.click(submit);

            expect(apiClient.postProtected).not.toHaveBeenCalled();
            expect(rating).toHaveValue('');
            expect(rating.selectedOptions[0]).toBeDisabled();
            expect(rating).toHaveAttribute('aria-invalid', 'true');
            expect(screen.getByRole('alert')).toHaveTextContent(
                'review.form.errors.overallRequired'
            );
            expect(rating).toHaveAccessibleDescription('review.form.errors.overallRequired');
        });

        it('guards the submission handler when native rating validation is bypassed', () => {
            const { rating } = openReviewForm();
            const form = rating.closest('form');
            if (!form) throw new Error('Review form not found');

            fireEvent.submit(form);

            expect(apiClient.postProtected).not.toHaveBeenCalled();
            expect(screen.getByRole('alert')).toHaveTextContent(
                'review.form.errors.overallRequired'
            );
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
