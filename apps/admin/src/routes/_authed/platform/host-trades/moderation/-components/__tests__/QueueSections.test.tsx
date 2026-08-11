/**
 * @file QueueSections.test.tsx
 * @description The two queues ask for different things (HOS-376 T-055, §6.4).
 *
 * The scoping of each queue is the whole design, and it is invisible on screen:
 * both sections render the same shape of list, so only what they REQUEST tells
 * a blocking queue apart from a backlog.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRepliesQueue = vi.fn();
const mockReviewsQueue = vi.fn();

vi.mock('@/hooks/use-host-trade-moderation', () => ({
    useHostTradeRepliesQueue: (filters: unknown) => mockRepliesQueue(filters),
    useHostTradeReviewsQueue: (filters: unknown) => mockReviewsQueue(filters),
    useModerateHostTradeReply: () => ({ mutate: vi.fn(), isError: false }),
    useModerateHostTradeReview: () => ({ mutate: vi.fn(), isError: false })
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key, tPlural: (key: string) => key })
}));

import { ReplyQueueSection } from '../ReplyQueueSection';
import { ReviewQueueSection } from '../ReviewQueueSection';

/** An empty, settled query result. */
const EMPTY = {
    data: { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 } },
    isLoading: false,
    error: null
};

describe('the two moderation queues', () => {
    beforeEach(() => {
        mockRepliesQueue.mockReset().mockReturnValue(EMPTY);
        mockReviewsQueue.mockReset().mockReturnValue(EMPTY);
    });

    it('should scope the reply queue to PENDING', () => {
        // This queue exists to release providers who cannot answer a complaint
        // about their own business. Widening it to every state buries the rows
        // that are actually blocking somebody among the ones already decided.
        render(<ReplyQueueSection />);

        expect(mockRepliesQueue).toHaveBeenCalledWith(
            expect.objectContaining({ moderationState: 'PENDING' })
        );
    });

    it('should leave the review queue unscoped', () => {
        // The opposite rule, for the opposite reason: reviews publish on
        // creation, so a queue scoped to PENDING would be empty most of the
        // time and would hide the published rows worth taking down.
        render(<ReviewQueueSection />);

        expect(mockReviewsQueue).toHaveBeenCalledWith(
            expect.objectContaining({ moderationState: undefined })
        );
    });

    it('should show the reply queue its own empty copy', () => {
        render(<ReplyQueueSection />);

        expect(screen.getByText('host-trades.moderation.replies.empty')).toBeInTheDocument();
    });

    it('should surface a failed read instead of an empty queue', () => {
        // Zero rows is what a broken read and a cleared queue have in common.
        // Only one of them means the moderator has nothing to do.
        mockRepliesQueue.mockReturnValue({ ...EMPTY, error: new Error('boom') });

        render(<ReplyQueueSection />);

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.queryByText('host-trades.moderation.replies.empty')).not.toBeInTheDocument();
    });

    it('should render a reply row with the edited-after-reply warning', () => {
        mockRepliesQueue.mockReturnValue({
            ...EMPTY,
            data: {
                items: [
                    {
                        id: 'reply-1',
                        reviewId: 'review-1',
                        content: 'Ya lo resolvimos.',
                        moderationState: 'PENDING',
                        reviewEditedAfterReply: true
                    }
                ],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        render(<ReplyQueueSection />);

        expect(screen.getByText('Ya lo resolvimos.')).toBeInTheDocument();
        expect(
            screen.getByText('host-trades.moderation.replies.editedAfterReply')
        ).toBeInTheDocument();
    });

    it('should tell the moderator whether the benefit was honoured', () => {
        // The one signal on a review a moderator can act on without reading the
        // prose: a provider not honouring the benefit is the failure the
        // directory exists to surface.
        mockReviewsQueue.mockReturnValue({
            ...EMPTY,
            data: {
                items: [
                    {
                        id: 'review-1',
                        overallRating: 2,
                        moderationState: 'APPROVED',
                        respectedBenefit: false,
                        content: 'No me hizo el descuento.'
                    }
                ],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        render(<ReviewQueueSection />);

        expect(screen.getByText('host-trades.moderation.reviews.benefitNo')).toBeInTheDocument();
    });

    it('should name a rating-only review rather than render an empty line', () => {
        mockReviewsQueue.mockReturnValue({
            ...EMPTY,
            data: {
                items: [
                    {
                        id: 'review-1',
                        overallRating: 5,
                        moderationState: 'APPROVED',
                        respectedBenefit: true,
                        content: null
                    }
                ],
                pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 }
            }
        });

        render(<ReviewQueueSection />);

        expect(screen.getByText('host-trades.moderation.reviews.noContent')).toBeInTheDocument();
    });
});
