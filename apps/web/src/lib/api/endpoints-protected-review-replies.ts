/** Protected endpoints for the host's reply to a review (HOS-2199). */
import type {
    AccommodationReviewReplyOwner,
    OwnerReceivedReview,
    OwnerReceivedReviewsQuery
} from '@repo/schemas';
import { apiClient } from './client';
import type { ApiResult } from './types';

const PROTECTED = '/api/v1/protected';

/** The owner's received-reviews page, as the API returns it. */
export interface ReceivedReviewsPage {
    readonly items: readonly OwnerReceivedReview[];
    readonly total: number;
    /** Whether the owner's plan sells `respond_reviews`. */
    readonly canRespond: boolean;
}

/** Reviews received on the owner's accommodations, and the reply write endpoints. */
export const reviewRepliesApi = {
    /** List reviews received on the caller's accommodations, with their live reply. */
    listReceived(
        params: Partial<
            Pick<OwnerReceivedReviewsQuery, 'page' | 'pageSize' | 'accommodationId'>
        > & {
            readonly unanswered?: boolean;
        }
    ): Promise<ApiResult<ReceivedReviewsPage>> {
        return apiClient.getProtected({
            path: `${PROTECTED}/users/me/received-reviews`,
            params: { ...params, unanswered: params.unanswered ? 'true' : undefined }
        });
    },

    /** Publish the host's reply to a review of an own accommodation. */
    create({
        accommodationId,
        reviewId,
        content
    }: {
        readonly accommodationId: string;
        readonly reviewId: string;
        readonly content: string;
    }): Promise<ApiResult<AccommodationReviewReplyOwner>> {
        return apiClient.postProtected({
            path: `${PROTECTED}/accommodations/${accommodationId}/reviews/${reviewId}/reply`,
            body: { content }
        });
    },

    /** Rewrite the host's live reply. */
    update({
        accommodationId,
        reviewId,
        content
    }: {
        readonly accommodationId: string;
        readonly reviewId: string;
        readonly content: string;
    }): Promise<ApiResult<AccommodationReviewReplyOwner>> {
        return apiClient.patch({
            path: `${PROTECTED}/accommodations/${accommodationId}/reviews/${reviewId}/reply`,
            body: { content }
        });
    },

    /** Soft-delete the host's live reply. */
    remove({
        accommodationId,
        reviewId
    }: {
        readonly accommodationId: string;
        readonly reviewId: string;
    }): Promise<ApiResult<{ readonly deleted: true }>> {
        return apiClient.delete({
            path: `${PROTECTED}/accommodations/${accommodationId}/reviews/${reviewId}/reply`
        });
    }
};
