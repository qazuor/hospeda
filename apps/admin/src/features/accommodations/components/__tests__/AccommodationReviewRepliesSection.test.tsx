/**
 * @file AccommodationReviewRepliesSection.test.tsx
 * @description The owner-reply moderation section (HOS-2675).
 *
 * What it asks for is the design: the queue defaults to ALL (an APPROVED reply
 * may still come down), the filter narrows it, and the two verdicts reach the
 * mutation with the row's own id. None of that is visible on screen.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    queue: vi.fn(),
    mutate: vi.fn(),
    moderateIsError: false
}));

vi.mock('@/hooks/use-accommodation-review-reply-moderation', () => ({
    useAccommodationReviewRepliesQueue: (filters: unknown) => mocks.queue(filters),
    useModerateAccommodationReviewReply: () => ({
        mutate: mocks.mutate,
        isError: mocks.moderateIsError
    })
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

import { AccommodationReviewRepliesSection } from '../AccommodationReviewRepliesSection';

const EMPTY = {
    data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
    isLoading: false,
    error: null
};

const reply = {
    id: 'reply-1',
    reviewId: 'review-1',
    content: 'Gracias por su visita.',
    moderationState: 'PENDING' as const,
    moderationReason: null,
    moderatedAt: null,
    createdAt: new Date('2026-11-27T10:00:00.000Z'),
    editedAt: null,
    accommodationId: 'acc-1',
    reviewTitle: 'Muy buen lugar',
    reviewContent: 'Todo excelente.',
    reviewAverageRating: 4.5,
    reviewerName: 'Ana'
};

describe('AccommodationReviewRepliesSection', () => {
    beforeEach(() => {
        mocks.queue.mockReset().mockReturnValue(EMPTY);
        mocks.mutate.mockReset();
        mocks.moderateIsError = false;
    });

    it('should default the queue to every state, not PENDING', () => {
        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        expect(mocks.queue).toHaveBeenLastCalledWith(
            expect.objectContaining({ accommodationId: 'acc-1', moderationState: undefined })
        );
    });

    it('should render a reply with its moderation state', () => {
        mocks.queue.mockReturnValue({
            ...EMPTY,
            data: { ...EMPTY.data, items: [reply] }
        });

        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        expect(screen.getByText('Gracias por su visita.')).toBeInTheDocument();
        expect(
            screen.getByText('admin-pages.accommodations.reviews.replies.statePending')
        ).toBeInTheDocument();
    });

    it('should narrow the queue when the filter changes', () => {
        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PENDING' } });

        expect(mocks.queue).toHaveBeenLastCalledWith(
            expect.objectContaining({ moderationState: 'PENDING' })
        );
    });

    it('should approve the row that was clicked', () => {
        mocks.queue.mockReturnValue({
            ...EMPTY,
            data: { ...EMPTY.data, items: [reply] }
        });

        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        fireEvent.click(screen.getByText('admin-pages.accommodations.reviews.replies.approve'));

        expect(mocks.mutate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'reply-1', decision: 'APPROVED' }),
            expect.anything()
        );
    });

    it('should reject the row that was clicked', () => {
        mocks.queue.mockReturnValue({
            ...EMPTY,
            data: { ...EMPTY.data, items: [reply] }
        });

        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        fireEvent.click(screen.getByText('admin-pages.accommodations.reviews.replies.reject'));

        expect(mocks.mutate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'reply-1', decision: 'REJECTED' }),
            expect.anything()
        );
    });

    it('should surface a failed read instead of an empty queue', () => {
        mocks.queue.mockReturnValue({ ...EMPTY, error: new Error('boom') });

        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
            screen.queryByText('admin-pages.accommodations.reviews.replies.empty')
        ).not.toBeInTheDocument();
    });

    it('should disable the verdict the row already carries', () => {
        mocks.queue.mockReturnValue({
            ...EMPTY,
            data: {
                ...EMPTY.data,
                items: [{ ...reply, moderationState: 'APPROVED' as const }]
            }
        });

        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        expect(
            screen.getByText('admin-pages.accommodations.reviews.replies.approve').closest('button')
        ).toBeDisabled();
    });

    it('should surface a failed verdict', () => {
        mocks.moderateIsError = true;

        render(<AccommodationReviewRepliesSection accommodationId="acc-1" />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});
