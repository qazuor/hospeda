import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Review } from '../../../src/components/review/ReviewList.client';
import { ReviewList } from '../../../src/components/review/ReviewList.client';

const mockReviews: ReadonlyArray<Review> = [
    {
        id: '1',
        authorName: 'Juan Pérez',
        authorAvatar: 'https://example.com/avatar1.jpg',
        rating: 5,
        title: 'Excelente lugar',
        content: 'Una experiencia increíble, todo estuvo perfecto.',
        date: '2026-01-15',
        verified: true
    },
    {
        id: '2',
        authorName: 'María García',
        rating: 4,
        title: 'Muy bueno',
        content: 'Me gustó mucho, solo algunos detalles menores.',
        date: '2026-01-10',
        verified: false
    },
    {
        id: '3',
        authorName: 'Carlos López',
        authorAvatar: 'https://example.com/avatar3.jpg',
        rating: 3,
        title: 'Regular',
        content: 'Está bien, pero esperaba más.',
        date: '2026-01-05',
        verified: true
    }
];

describe('ReviewList.client.tsx', () => {
    describe('Props', () => {
        it('should accept reviews prop', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );
            const articles = container.querySelectorAll('article');
            expect(articles.length).toBe(3);
        });

        it('should accept totalCount prop', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={42}
                />
            );
            expect(screen.getByText('42 reseñas')).toBeInTheDocument();
        });

        it('should default locale to es', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );
            expect(screen.getByText('Reseñas')).toBeInTheDocument();
            expect(screen.getByText('3 reseñas')).toBeInTheDocument();
        });

        it('should accept locale prop for English', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    locale="en"
                />
            );
            expect(screen.getByText('Reviews')).toBeInTheDocument();
            expect(screen.getByText('3 reviews')).toBeInTheDocument();
        });

        it('should accept isAuthenticated prop', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    isAuthenticated={true}
                />
            );
            expect(screen.getByText('Reseñas')).toBeInTheDocument();
        });

        it('should accept onWriteReview callback', () => {
            const handleWriteReview = vi.fn();
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    isAuthenticated={true}
                    onWriteReview={handleWriteReview}
                />
            );

            const writeButton = screen.getByText('Escribir reseña');
            fireEvent.click(writeButton);

            expect(handleWriteReview).toHaveBeenCalledTimes(1);
        });

        it('should accept onLoadMore callback', () => {
            const handleLoadMore = vi.fn();
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={10}
                    hasMore={true}
                    onLoadMore={handleLoadMore}
                />
            );

            const loadMoreButton = screen.getByText('Cargar más');
            fireEvent.click(loadMoreButton);

            expect(handleLoadMore).toHaveBeenCalledTimes(1);
        });

        it('should accept hasMore prop', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={10}
                    hasMore={true}
                    onLoadMore={vi.fn()}
                />
            );

            expect(screen.getByText('Cargar más')).toBeInTheDocument();
        });

        it('should accept sortBy prop', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    sortBy="highest"
                />
            );

            const select = screen.getByLabelText('Ordenar por:');
            expect(select).toHaveValue('highest');
        });

        it('should default sortBy to newest', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const select = screen.getByLabelText('Ordenar por:');
            expect(select).toHaveValue('newest');
        });

        it('should accept onSortChange callback', () => {
            const handleSortChange = vi.fn();
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    sortBy="newest"
                    onSortChange={handleSortChange}
                />
            );

            const select = screen.getByLabelText('Ordenar por:');
            fireEvent.change(select, { target: { value: 'highest' } });

            expect(handleSortChange).toHaveBeenCalledWith('highest');
            expect(handleSortChange).toHaveBeenCalledTimes(1);
        });

        it('should accept className prop', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    className="custom-class"
                />
            );

            const rootDiv = container.firstChild;
            expect(rootDiv).toHaveClass('custom-class');
        });
    });

    describe('Rendering', () => {
        it('should render review items with author name', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
            expect(screen.getByText('María García')).toBeInTheDocument();
            expect(screen.getByText('Carlos López')).toBeInTheDocument();
        });

        it('should render review items with rating stars', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const starGroups = container.querySelectorAll('[role="img"]');
            expect(starGroups.length).toBeGreaterThan(0);
        });

        it('should render review items with title', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            expect(screen.getByText('Excelente lugar')).toBeInTheDocument();
            expect(screen.getByText('Muy bueno')).toBeInTheDocument();
            expect(screen.getByText('Regular')).toBeInTheDocument();
        });

        it('should render review items with content', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            expect(
                screen.getByText('Una experiencia increíble, todo estuvo perfecto.')
            ).toBeInTheDocument();
            expect(
                screen.getByText('Me gustó mucho, solo algunos detalles menores.')
            ).toBeInTheDocument();
            expect(screen.getByText('Está bien, pero esperaba más.')).toBeInTheDocument();
        });

        it('should render review items with dates', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const timeElements = container.querySelectorAll('time');
            expect(timeElements.length).toBe(3);
            expect(timeElements[0]).toHaveAttribute('datetime', '2026-01-15');
        });

        it('should render verified badge for verified reviews', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const verifiedBadges = screen.getAllByText('Verificado');
            expect(verifiedBadges.length).toBe(2);
        });

        it('should render author avatar when provided', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const avatar = screen.getByAltText('Juan Pérez');
            expect(avatar).toBeInTheDocument();
            expect(avatar).toHaveAttribute('src', 'https://example.com/avatar1.jpg');
        });

        it('should render author initials when avatar is not provided', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const { container } = render(
                <ReviewList
                    reviews={[
                        {
                            id: '1',
                            authorName: 'Test User',
                            rating: 5,
                            title: 'Title',
                            content: 'Content',
                            date: '2026-01-15'
                        }
                    ]}
                    totalCount={1}
                />
            );

            expect(container.textContent).toContain('T');
        });

        it('should show total count in header', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={42}
                />
            );

            expect(screen.getByText('42 reseñas')).toBeInTheDocument();
        });

        it('should show correct singular form for single review', () => {
            const firstReview = mockReviews[0];
            if (!firstReview) throw new Error('First review not found');

            render(
                <ReviewList
                    reviews={[firstReview]}
                    totalCount={1}
                />
            );

            expect(screen.getByText('1 reseña')).toBeInTheDocument();
        });

        it('should render sort dropdown', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const select = screen.getByLabelText('Ordenar por:');
            expect(select).toBeInTheDocument();
        });

        it('should render sort options in Spanish', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            expect(screen.getByText('Más recientes')).toBeInTheDocument();
            expect(screen.getByText('Mejor valorados')).toBeInTheDocument();
            expect(screen.getByText('Menor valorados')).toBeInTheDocument();
        });

        it('should render sort options in English', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    locale="en"
                />
            );

            expect(screen.getByText('Newest')).toBeInTheDocument();
            expect(screen.getByText('Highest rated')).toBeInTheDocument();
            expect(screen.getByText('Lowest rated')).toBeInTheDocument();
        });

        it('should render write review button when isAuthenticated and onWriteReview are provided', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                />
            );

            expect(screen.getByText('Escribir reseña')).toBeInTheDocument();
        });

        it('should not render write review button when onWriteReview is not provided', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            expect(screen.queryByText('Escribir reseña')).not.toBeInTheDocument();
        });

        it('should not render write review button when not authenticated even with onWriteReview', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    isAuthenticated={false}
                    onWriteReview={vi.fn()}
                />
            );

            expect(screen.queryByText('Escribir reseña')).not.toBeInTheDocument();
        });

        it('should render load more button when hasMore is true and onLoadMore is provided', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={10}
                    hasMore={true}
                    onLoadMore={vi.fn()}
                />
            );

            expect(screen.getByText('Cargar más')).toBeInTheDocument();
        });

        it('should not render load more button when hasMore is false', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    hasMore={false}
                    onLoadMore={vi.fn()}
                />
            );

            expect(screen.queryByText('Cargar más')).not.toBeInTheDocument();
        });

        it('should not render load more button when onLoadMore is not provided', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={10}
                    hasMore={true}
                />
            );

            expect(screen.queryByText('Cargar más')).not.toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should render empty state when no reviews', () => {
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                />
            );

            expect(screen.getByText('Aún no hay reseñas')).toBeInTheDocument();
            expect(screen.getByText('Sé el primero en dejar una reseña')).toBeInTheDocument();
        });

        it('should render empty state in English', () => {
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                    locale="en"
                />
            );

            expect(screen.getByText('No reviews yet')).toBeInTheDocument();
            expect(screen.getByText('Be the first to leave a review')).toBeInTheDocument();
        });

        it('should render write review button in empty state when isAuthenticated and onWriteReview are provided', () => {
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                />
            );

            expect(screen.getByText('Escribir reseña')).toBeInTheDocument();
        });

        it('should call onWriteReview when button is clicked in empty state', () => {
            const handleWriteReview = vi.fn();
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                    isAuthenticated={true}
                    onWriteReview={handleWriteReview}
                />
            );

            const button = screen.getByText('Escribir reseña');
            fireEvent.click(button);

            expect(handleWriteReview).toHaveBeenCalledTimes(1);
        });

        it('should not render write review button in empty state when not authenticated', () => {
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                    isAuthenticated={false}
                    onWriteReview={vi.fn()}
                />
            );

            expect(screen.queryByText('Escribir reseña')).not.toBeInTheDocument();
        });

        it('should not render header in empty state', () => {
            render(
                <ReviewList
                    reviews={[]}
                    totalCount={0}
                />
            );

            expect(screen.queryByText('Ordenar por:')).not.toBeInTheDocument();
        });
    });

    describe('Interaction', () => {
        it('should call onSortChange with correct value when sort changes', () => {
            const handleSortChange = vi.fn();
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    sortBy="newest"
                    onSortChange={handleSortChange}
                />
            );

            const select = screen.getByLabelText('Ordenar por:');
            fireEvent.change(select, { target: { value: 'highest' } });

            expect(handleSortChange).toHaveBeenCalledWith('highest');
        });

        it('should call onSortChange with lowest when selecting lowest', () => {
            const handleSortChange = vi.fn();
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    sortBy="newest"
                    onSortChange={handleSortChange}
                />
            );

            const select = screen.getByLabelText('Ordenar por:');
            fireEvent.change(select, { target: { value: 'lowest' } });

            expect(handleSortChange).toHaveBeenCalledWith('lowest');
        });

        it('should call onWriteReview when write review button is clicked', () => {
            const handleWriteReview = vi.fn();
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    isAuthenticated={true}
                    onWriteReview={handleWriteReview}
                />
            );

            const button = screen.getByText('Escribir reseña');
            fireEvent.click(button);

            expect(handleWriteReview).toHaveBeenCalledTimes(1);
        });

        it('should call onLoadMore when load more button is clicked', () => {
            const handleLoadMore = vi.fn();
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={10}
                    hasMore={true}
                    onLoadMore={handleLoadMore}
                />
            );

            const button = screen.getByText('Cargar más');
            fireEvent.click(button);

            expect(handleLoadMore).toHaveBeenCalledTimes(1);
        });
    });

    describe('Locale switching', () => {
        it('should display Spanish text when locale is es', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    locale="es"
                />
            );

            expect(screen.getByText('Reseñas')).toBeInTheDocument();
            expect(screen.getByText('Ordenar por:')).toBeInTheDocument();
        });

        it('should display English text when locale is en', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    locale="en"
                />
            );

            expect(screen.getByText('Reviews')).toBeInTheDocument();
            expect(screen.getByText('Sort by:')).toBeInTheDocument();
        });

        it('should format dates according to locale', () => {
            const firstReview = mockReviews[0];
            if (!firstReview) throw new Error('First review not found');

            const { container: esContainer } = render(
                <ReviewList
                    reviews={[firstReview]}
                    totalCount={1}
                    locale="es"
                />
            );

            const { container: enContainer } = render(
                <ReviewList
                    reviews={[firstReview]}
                    totalCount={1}
                    locale="en"
                />
            );

            const esTime = esContainer.querySelector('time');
            const enTime = enContainer.querySelector('time');

            expect(esTime?.textContent).toBeTruthy();
            expect(enTime?.textContent).toBeTruthy();
            expect(esTime?.textContent).not.toBe(enTime?.textContent);
        });

        it('should update button text based on locale', () => {
            const { rerender } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    locale="es"
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                />
            );

            expect(screen.getByText('Escribir reseña')).toBeInTheDocument();

            rerender(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    locale="en"
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                />
            );

            expect(screen.getByText('Write a review')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA label for star ratings', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const starGroup = container.querySelector('[role="img"]');
            expect(starGroup).toHaveAttribute('aria-label');
        });

        it('should have time elements with datetime attribute', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const timeElements = container.querySelectorAll('time[datetime]');
            expect(timeElements.length).toBe(3);
        });

        it('should have proper label for sort select', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const select = screen.getByLabelText('Ordenar por:');
            expect(select).toHaveAttribute('id', 'sort-select');
        });

        it('should have type="button" on all buttons', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={10}
                    hasMore={true}
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                    onLoadMore={vi.fn()}
                />
            );

            const buttons = screen.getAllByRole('button');
            for (const button of buttons) {
                expect(button).toHaveAttribute('type', 'button');
            }
        });

        it('should have focus-visible styles on buttons', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                />
            );

            const button = screen.getByText('Escribir reseña');
            expect(button.className).toContain('focus-visible:outline');
        });

        it('should have aria-hidden on decorative SVGs', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const svgs = Array.from(container.querySelectorAll('svg[aria-hidden="true"]'));
            expect(svgs.length).toBeGreaterThan(0);
        });

        it('should have alt text for author avatars', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const avatar = screen.getByAltText('Juan Pérez');
            expect(avatar).toBeInTheDocument();
        });
    });

    describe('Styling', () => {
        it('should apply container spacing classes', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const rootDiv = container.firstChild;
            expect(rootDiv).toHaveClass('space-y-6');
        });

        it('should apply hover styles to review cards', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const articles = Array.from(container.querySelectorAll('article'));
            for (const article of articles) {
                expect(article.className).toContain('hover:shadow-md');
            }
        });

        it('should apply transition classes to buttons', () => {
            render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    isAuthenticated={true}
                    onWriteReview={vi.fn()}
                />
            );

            const button = screen.getByText('Escribir reseña');
            expect(button.className).toContain('transition-colors');
        });

        it('should apply custom className to root element', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                    className="another-class my-custom-class"
                />
            );

            const rootDiv = container.firstChild;
            expect(rootDiv).toHaveClass('my-custom-class');
            expect(rootDiv).toHaveClass('another-class');
        });

        it('should apply correct styles for verified badge', () => {
            const { container } = render(
                <ReviewList
                    reviews={mockReviews}
                    totalCount={3}
                />
            );

            const verifiedBadges = container.querySelectorAll('.text-green-700');
            expect(verifiedBadges.length).toBeGreaterThan(0);
        });
    });
});
