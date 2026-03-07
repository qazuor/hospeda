/**
 * @file review-system.test.tsx
 * @description Integration tests for ReviewList.client.tsx and ReviewForm.client.tsx.
 *
 * ReviewList: empty state, review listing, sort dropdown, pagination (load more),
 *   write-review button visibility.
 * ReviewForm: initial render, star rating interaction, title/content validation,
 *   successful submission, cancel callback, validation error display.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            if (params) return `${fallback ?? key}:${JSON.stringify(params)}`;
            return fallback ?? key;
        },
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@repo/icons', () => ({
    StarIcon: ({ weight }: { weight: string }) => (
        <div
            data-testid="star-icon"
            data-weight={weight}
        />
    ),
    AddIcon: () => <div data-testid="add-icon" />,
    ChatIcon: () => <div data-testid="chat-icon" />,
    CheckCircleIcon: () => <div data-testid="check-circle-icon" />
}));

vi.mock('@repo/i18n', () => ({
    formatDate: ({ date }: { date: string }) => date,
    toBcp47Locale: (locale: string) => locale
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

import { ReviewForm } from '../../../src/components/review/ReviewForm.client';
import type { Review } from '../../../src/components/review/ReviewList.client';
import { ReviewList } from '../../../src/components/review/ReviewList.client';
import { addToast } from '../../../src/store/toast-store';

const addToastMock = addToast as ReturnType<typeof vi.fn>;

beforeEach(() => {
    addToastMock.mockClear();
});

const sampleReviews: Review[] = [
    {
        id: 'rev-1',
        authorName: 'Ana Lopez',
        rating: 5,
        title: 'Excellent stay',
        content: 'Absolutely loved it',
        date: '2026-01-10',
        verified: true
    },
    {
        id: 'rev-2',
        authorName: 'Juan Perez',
        authorAvatar: '/avatars/juan.jpg',
        rating: 3,
        title: 'Average',
        content: 'It was okay, nothing special',
        date: '2026-01-05',
        verified: false
    }
];

describe('ReviewList.client.tsx', () => {
    describe('Empty state', () => {
        it('should render an empty state when reviews array is empty', () => {
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                />
            );
            expect(screen.getByTestId('chat-icon')).toBeInTheDocument();
            expect(screen.getByText('list.noReviews')).toBeInTheDocument();
        });

        it('should NOT show write-review button in empty state when not authenticated', () => {
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                    isAuthenticated={false}
                />
            );
            expect(screen.queryByText('list.writeReview')).not.toBeInTheDocument();
        });

        it('should show write-review button in empty state when authenticated with callback', () => {
            const onWriteReview = vi.fn();
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                    isAuthenticated={true}
                    onWriteReview={onWriteReview}
                />
            );
            expect(screen.getByText('list.writeReview')).toBeInTheDocument();
        });

        it('should call onWriteReview when button in empty state is clicked', () => {
            const onWriteReview = vi.fn();
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                    isAuthenticated={true}
                    onWriteReview={onWriteReview}
                />
            );
            fireEvent.click(screen.getByText('list.writeReview'));
            expect(onWriteReview).toHaveBeenCalledTimes(1);
        });
    });

    describe('Review listing', () => {
        it('should render an article per review', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            const articles = screen.getAllByRole('article');
            expect(articles).toHaveLength(2);
        });

        it('should display each author name', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            expect(screen.getByText('Ana Lopez')).toBeInTheDocument();
            expect(screen.getByText('Juan Perez')).toBeInTheDocument();
        });

        it('should display review titles', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            expect(screen.getByText('Excellent stay')).toBeInTheDocument();
            expect(screen.getByText('Average')).toBeInTheDocument();
        });

        it('should display review content in quotation marks', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            // Content is wrapped in &ldquo; ... &rdquo;
            expect(screen.getByText(/Absolutely loved it/)).toBeInTheDocument();
        });

        it('should render the verified badge for verified reviews', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            expect(screen.getByText('list.verified')).toBeInTheDocument();
        });

        it('should render author avatar img when authorAvatar is provided', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            const avatar = screen.getByAltText('Juan Perez');
            expect(avatar).toHaveAttribute('src', '/avatars/juan.jpg');
        });

        it('should render author initial when no avatar provided', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            // Ana Lopez has no avatar, should show initial 'A'
            const initials = screen
                .getAllByText('A')
                .filter((el) => el.tagName !== 'img' && el.textContent === 'A');
            expect(initials.length).toBeGreaterThan(0);
        });
    });

    describe('Sort dropdown', () => {
        it('should render the sort select when reviews exist', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                />
            );
            expect(screen.getByRole('combobox')).toBeInTheDocument();
        });

        it('should have newest, highest, lowest options', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                    sortBy="newest"
                />
            );
            const options = screen.getAllByRole('option');
            const values = options.map((o) => (o as HTMLOptionElement).value);
            expect(values).toContain('newest');
            expect(values).toContain('highest');
            expect(values).toContain('lowest');
        });

        it('should call onSortChange when sort selection changes', () => {
            const onSortChange = vi.fn();
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                    onSortChange={onSortChange}
                />
            );
            fireEvent.change(screen.getByRole('combobox'), { target: { value: 'highest' } });
            expect(onSortChange).toHaveBeenCalledWith('highest');
        });
    });

    describe('Write review button', () => {
        it('should NOT show write-review button when not authenticated', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                    isAuthenticated={false}
                />
            );
            expect(screen.queryByText('list.writeReview')).not.toBeInTheDocument();
        });

        it('should show write-review button when authenticated with callback', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                />
            );
            expect(screen.getByText('list.writeReview')).toBeInTheDocument();
        });
    });

    describe('Load more pagination', () => {
        it('should render load-more button when hasMore is true', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={10}
                    hasMore={true}
                    onLoadMore={vi.fn()}
                />
            );
            expect(screen.getByText('list.loadMore')).toBeInTheDocument();
        });

        it('should NOT render load-more button when hasMore is false', () => {
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={2}
                    hasMore={false}
                />
            );
            expect(screen.queryByText('list.loadMore')).not.toBeInTheDocument();
        });

        it('should call onLoadMore when load-more button is clicked', () => {
            const onLoadMore = vi.fn();
            render(
                <ReviewList
                    reviews={sampleReviews}
                    totalCount={10}
                    hasMore={true}
                    onLoadMore={onLoadMore}
                />
            );
            fireEvent.click(screen.getByText('list.loadMore'));
            expect(onLoadMore).toHaveBeenCalledTimes(1);
        });
    });
});

// ────────────────────────────────────────────────────────────
// ReviewForm tests
// ────────────────────────────────────────────────────────────

describe('ReviewForm.client.tsx', () => {
    describe('Initial render', () => {
        it('should render a form element', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            // The form element has no accessible name so getByRole('form') is not usable.
            // Use a direct DOM query instead.
            expect(document.querySelector('form')).toBeInTheDocument();
        });

        it('should render 5 interactive star buttons', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            // Star buttons have role=radiogroup container; star buttons themselves
            const radiogroup = screen.getByRole('radiogroup');
            const starButtons = within(radiogroup).getAllByRole('button');
            expect(starButtons).toHaveLength(5);
        });

        it('should render title input', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            expect(screen.getByRole('textbox', { name: /form.titleLabel/i })).toBeInTheDocument();
        });

        it('should render content textarea', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            // Textarea with id review-content
            expect(document.getElementById('review-content')).toBeInTheDocument();
        });

        it('should render submit button', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            expect(screen.getByRole('button', { name: 'form.submitButton' })).toBeInTheDocument();
        });

        it('should render cancel button when onCancel prop is provided', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                    onCancel={vi.fn()}
                />
            );
            expect(screen.getByText('form.cancelButton')).toBeInTheDocument();
        });

        it('should NOT render cancel button when onCancel is not provided', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            expect(screen.queryByText('form.cancelButton')).not.toBeInTheDocument();
        });
    });

    describe('Star rating interaction', () => {
        it('should fill stars up to clicked star value', () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            const radiogroup = screen.getByRole('radiogroup');
            const starButtons = within(radiogroup).getAllByRole('button');
            const thirdStar = starButtons[2];
            if (!thirdStar) throw new Error('Third star not found');

            fireEvent.click(thirdStar);

            // Stars 1-3 should be filled; get all star icons inside radiogroup
            const icons = within(radiogroup).getAllByTestId('star-icon');
            const filledIcons = icons.filter((el) => el.getAttribute('data-weight') === 'fill');
            expect(filledIcons.length).toBeGreaterThanOrEqual(3);
        });

        it('should clear rating error when a star is clicked', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );

            // Submit without rating to trigger error
            fireEvent.submit(document.querySelector('form') as HTMLFormElement);

            await waitFor(() => {
                expect(screen.getByText('form.errors.ratingRequired')).toBeInTheDocument();
            });

            const radiogroup = screen.getByRole('radiogroup');
            const starButtons = within(radiogroup).getAllByRole('button');
            fireEvent.click(starButtons[0] as HTMLButtonElement);

            await waitFor(() => {
                expect(screen.queryByText('form.errors.ratingRequired')).not.toBeInTheDocument();
            });
        });
    });

    describe('Validation errors', () => {
        it('should show rating required error when submitting without rating', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            await waitFor(() => {
                expect(screen.getByText('form.errors.ratingRequired')).toBeInTheDocument();
            });
        });

        it('should show title required error when submitting with empty title', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            await waitFor(() => {
                expect(screen.getByText('form.errors.titleRequired')).toBeInTheDocument();
            });
        });

        it('should show content required error when submitting with empty content', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            await waitFor(() => {
                expect(screen.getByText('form.errors.contentRequired')).toBeInTheDocument();
            });
        });

        it('should show title too short error when title is less than 3 chars', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            fireEvent.change(document.getElementById('review-title') as HTMLInputElement, {
                target: { value: 'Hi' }
            });
            fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            await waitFor(() => {
                expect(screen.getByText('form.errors.titleMinLength')).toBeInTheDocument();
            });
        });

        it('should show content too short error when content is less than 10 chars', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            fireEvent.change(document.getElementById('review-content') as HTMLTextAreaElement, {
                target: { value: 'Short' }
            });
            fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            await waitFor(() => {
                expect(screen.getByText('form.errors.contentMinLength')).toBeInTheDocument();
            });
        });
    });

    describe('Successful submission', () => {
        it('should call onSubmit with form data when valid', async () => {
            const onSubmit = vi.fn();
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                    onSubmit={onSubmit}
                />
            );

            // Select 4 stars
            const radiogroup = screen.getByRole('radiogroup');
            const starButtons = within(radiogroup).getAllByRole('button');
            fireEvent.click(starButtons[3] as HTMLButtonElement);

            fireEvent.change(document.getElementById('review-title') as HTMLInputElement, {
                target: { value: 'Great place!' }
            });
            fireEvent.change(document.getElementById('review-content') as HTMLTextAreaElement, {
                target: { value: 'This is a detailed and wonderful review content.' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            expect(onSubmit).toHaveBeenCalledWith({
                rating: 4,
                title: 'Great place!',
                content: 'This is a detailed and wonderful review content.'
            });
        });

        it('should show success toast on valid submission', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );

            const radiogroup = screen.getByRole('radiogroup');
            const starButtons = within(radiogroup).getAllByRole('button');
            fireEvent.click(starButtons[4] as HTMLButtonElement);
            fireEvent.change(document.getElementById('review-title') as HTMLInputElement, {
                target: { value: 'Amazing!' }
            });
            fireEvent.change(document.getElementById('review-content') as HTMLTextAreaElement, {
                target: { value: 'Long enough content that meets minimum requirement.' }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            expect(addToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
        });
    });

    describe('Cancel callback', () => {
        it('should call onCancel when cancel button is clicked', () => {
            const onCancel = vi.fn();
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                    onCancel={onCancel}
                />
            );
            fireEvent.click(screen.getByText('form.cancelButton'));
            expect(onCancel).toHaveBeenCalledTimes(1);
        });
    });

    describe('Accessibility', () => {
        it('should have aria-invalid on rating group when error present', async () => {
            render(
                <ReviewForm
                    entityId="acc-1"
                    entityType="accommodation"
                />
            );
            fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            await waitFor(() => {
                const radiogroup = screen.getByRole('radiogroup');
                expect(radiogroup).toHaveAttribute('aria-invalid', 'true');
            });
        });

        it('should have data-entity-id and data-entity-type on the form', () => {
            render(
                <ReviewForm
                    entityId="dest-42"
                    entityType="destination"
                />
            );
            const form = document.querySelector('form');
            expect(form).toHaveAttribute('data-entity-id', 'dest-42');
            expect(form).toHaveAttribute('data-entity-type', 'destination');
        });
    });
});
