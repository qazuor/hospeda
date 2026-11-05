// @vitest-environment jsdom
/**
 * TEST:7.5:2 (AC:7:6) — the moderation card shows the dimensions a venue
 * reviewer voted, and nothing else.
 *
 * What would make it silently wrong:
 *  - listing a dimension the reviewer did not vote;
 *  - showing the wrong score beside a label;
 *  - rendering an empty list (or a placeholder) for a review without a
 *    breakdown;
 *  - offering edit controls the admin does not have.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VenueReviewDimensions } from '../components/VenueReviewDimensions';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

describe('VenueReviewDimensions (TEST:7.5:2 / AC:7:6)', () => {
    it('lists the voted dimensions with their scores and label keys', () => {
        render(<VenueReviewDimensions rating={{ food: 4, ambiance: 2 }} />);

        expect(screen.getByText('review.dimensions.food')).toBeInTheDocument();
        expect(screen.getByText('4/5')).toBeInTheDocument();
        expect(screen.getByText('review.dimensions.ambiance')).toBeInTheDocument();
        expect(screen.getByText('2/5')).toBeInTheDocument();
    });

    it('does not list dimensions the reviewer did not vote', () => {
        render(<VenueReviewDimensions rating={{ food: 4, ambiance: 2 }} />);

        expect(screen.queryByText('review.dimensions.service')).toBeNull();
        expect(screen.queryByText('review.dimensions.value')).toBeNull();
    });

    it('exposes the list with the translated aria-label', () => {
        render(<VenueReviewDimensions rating={{ food: 4 }} />);

        expect(
            screen.getByRole('list', {
                name: 'admin-entities.venue.reviews.dimensionsLabel'
            })
        ).toBeInTheDocument();
    });

    it('renders nothing for a null or empty breakdown', () => {
        const { container, rerender } = render(<VenueReviewDimensions rating={null} />);
        expect(container).toBeEmptyDOMElement();

        rerender(<VenueReviewDimensions rating={{}} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders no button or input: the admin does not edit dimensions', () => {
        const { container } = render(<VenueReviewDimensions rating={{ food: 4, ambiance: 2 }} />);

        expect(container.querySelector('button')).toBeNull();
        expect(container.querySelector('input')).toBeNull();
    });
});
