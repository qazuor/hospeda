import type { AccommodationReviewReply } from '@repo/schemas';
import { VerticalEnum } from '@repo/schemas';
import { and, count, desc, eq, inArray, isNotNull, isNull, or, type SQL } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { accommodations } from '../../schemas/accommodation/accommodation.dbschema.ts';
import { accommodationReviews } from '../../schemas/accommodation/accommodation_review.dbschema.ts';
import { accommodationReviewReplies } from '../../schemas/accommodation/accommodation_review_reply.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { listingReviewsShownCondition } from '../listing/listing-reviews-shown.ts';

/** A review received on an accommodation, joined with its live reply. */
export interface ReceivedReviewRow {
    readonly id: string;
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly accommodationSlug: string;
    readonly title: string | null;
    readonly content: string | null;
    readonly averageRating: number;
    readonly createdAt: Date;
    readonly reviewerDisplayName: string | null;
    readonly reviewerFirstName: string | null;
    readonly reviewerLastName: string | null;
    readonly replyId: string | null;
    readonly replyContent: string | null;
    readonly replyModerationState: AccommodationReviewReply['moderationState'] | null;
    readonly replyCreatedAt: Date | null;
    readonly replyEditedAt: Date | null;
}

/** A host reply as the admin moderation queue reads it, joined with its review. */
export interface AdminReplyRow {
    readonly id: string;
    readonly reviewId: string;
    readonly content: string;
    readonly moderationState: AccommodationReviewReply['moderationState'];
    readonly moderationReason: string | null;
    readonly moderatedAt: Date | null;
    readonly createdAt: Date;
    readonly editedAt: Date | null;
    readonly accommodationId: string;
    readonly reviewTitle: string | null;
    readonly reviewContent: string | null;
    readonly reviewAverageRating: number;
    readonly reviewerName: string | null;
}

/**
 * Model for the `accommodation_review_replies` table (HOS-2199).
 *
 * One LIVE reply per review (partial unique index on `review_id` where
 * `deleted_at IS NULL`). Use `findOne({ reviewId, deletedAt: null })` to read it.
 */
export class AccommodationReviewReplyModel extends BaseModelImpl<AccommodationReviewReply> {
    protected table = accommodationReviewReplies;
    public entityName = 'accommodationReviewReplies';

    protected getTableName(): string {
        return 'accommodationReviewReplies';
    }

    /**
     * Reviews received by an owner, newest first, each with its live reply.
     *
     * Only reviews the public can see (APPROVED + ACTIVE, not deleted, listing
     * not purged) on accommodations the owner owns. Ownership is enforced in
     * the SQL, so a foreign review can never appear.
     *
     * @param input.ownerId - The accommodation owner.
     * @param input.unanswered - Keep only reviews with no live reply.
     * @param input.accommodationId - Narrow to one of the owner's accommodations.
     * @param input.page - 1-based page.
     * @param input.pageSize - Page size.
     * @param tx - Optional transaction client.
     * @returns The page of rows and the total that match.
     */
    async findReceivedByOwner(
        input: {
            readonly ownerId: string;
            readonly unanswered: boolean;
            readonly accommodationId?: string;
            readonly page: number;
            readonly pageSize: number;
        },
        tx?: DrizzleClient
    ): Promise<{ items: ReceivedReviewRow[]; total: number }> {
        const db = this.getClient(tx);
        const conditions: SQL[] = [
            eq(accommodations.ownerId, input.ownerId),
            isNull(accommodations.deletedAt),
            listingReviewsShownCondition({ vertical: VerticalEnum.ACCOMMODATION }),
            isNull(accommodationReviews.deletedAt),
            eq(accommodationReviews.lifecycleState, 'ACTIVE'),
            eq(accommodationReviews.moderationState, 'APPROVED')
        ];
        if (input.accommodationId) {
            conditions.push(eq(accommodations.id, input.accommodationId));
        }
        if (input.unanswered) {
            conditions.push(isNull(accommodationReviewReplies.id));
        }
        const where = and(...conditions);
        const liveReplyJoin = and(
            eq(accommodationReviewReplies.reviewId, accommodationReviews.id),
            isNull(accommodationReviewReplies.deletedAt)
        );
        try {
            const [items, totals] = await Promise.all([
                db
                    .select({
                        id: accommodationReviews.id,
                        accommodationId: accommodationReviews.accommodationId,
                        accommodationName: accommodations.name,
                        accommodationSlug: accommodations.slug,
                        title: accommodationReviews.title,
                        content: accommodationReviews.content,
                        averageRating: accommodationReviews.averageRating,
                        createdAt: accommodationReviews.createdAt,
                        reviewerDisplayName: users.displayName,
                        reviewerFirstName: users.firstName,
                        reviewerLastName: users.lastName,
                        replyId: accommodationReviewReplies.id,
                        replyContent: accommodationReviewReplies.content,
                        replyModerationState: accommodationReviewReplies.moderationState,
                        replyCreatedAt: accommodationReviewReplies.createdAt,
                        replyEditedAt: accommodationReviewReplies.editedAt
                    })
                    .from(accommodationReviews)
                    .innerJoin(
                        accommodations,
                        eq(accommodations.id, accommodationReviews.accommodationId)
                    )
                    .leftJoin(users, eq(users.id, accommodationReviews.userId))
                    .leftJoin(accommodationReviewReplies, liveReplyJoin)
                    .where(where)
                    .orderBy(desc(accommodationReviews.createdAt), desc(accommodationReviews.id))
                    .limit(input.pageSize)
                    .offset((input.page - 1) * input.pageSize),
                db
                    .select({ value: count() })
                    .from(accommodationReviews)
                    .innerJoin(
                        accommodations,
                        eq(accommodations.id, accommodationReviews.accommodationId)
                    )
                    .leftJoin(accommodationReviewReplies, liveReplyJoin)
                    .where(where)
            ]);
            return { items: items as ReceivedReviewRow[], total: Number(totals[0]?.value ?? 0) };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            throw new DbError(this.entityName, 'findReceivedByOwner', input, err.message, err);
        }
    }

    /**
     * Live host replies for the admin moderation queue, newest first.
     *
     * Joins each reply to its review, beating accommodation and reviewer so the
     * moderator sees what the reply answers. Soft-deleted replies never appear.
     *
     * @param input.accommodationId - Narrow to one accommodation.
     * @param input.moderationState - Keep only one moderation state.
     * @param input.page - 1-based page.
     * @param input.pageSize - Page size.
     * @param tx - Optional transaction client.
     * @returns The page of rows and the total that match.
     */
    async findAdminList(
        input: {
            readonly accommodationId?: string;
            readonly moderationState?: AccommodationReviewReply['moderationState'];
            readonly page: number;
            readonly pageSize: number;
        },
        tx?: DrizzleClient
    ): Promise<{ items: AdminReplyRow[]; total: number }> {
        const db = this.getClient(tx);
        const conditions: SQL[] = [isNull(accommodationReviewReplies.deletedAt)];
        if (input.accommodationId) {
            conditions.push(eq(accommodationReviews.accommodationId, input.accommodationId));
        }
        if (input.moderationState) {
            conditions.push(eq(accommodationReviewReplies.moderationState, input.moderationState));
        }
        const where = and(...conditions);
        try {
            const [rows, totals] = await Promise.all([
                db
                    .select({
                        id: accommodationReviewReplies.id,
                        reviewId: accommodationReviewReplies.reviewId,
                        content: accommodationReviewReplies.content,
                        moderationState: accommodationReviewReplies.moderationState,
                        moderationReason: accommodationReviewReplies.moderationReason,
                        moderatedAt: accommodationReviewReplies.moderatedAt,
                        createdAt: accommodationReviewReplies.createdAt,
                        editedAt: accommodationReviewReplies.editedAt,
                        accommodationId: accommodationReviews.accommodationId,
                        reviewTitle: accommodationReviews.title,
                        reviewContent: accommodationReviews.content,
                        reviewAverageRating: accommodationReviews.averageRating,
                        reviewerDisplayName: users.displayName,
                        reviewerFirstName: users.firstName,
                        reviewerLastName: users.lastName
                    })
                    .from(accommodationReviewReplies)
                    .innerJoin(
                        accommodationReviews,
                        eq(accommodationReviews.id, accommodationReviewReplies.reviewId)
                    )
                    .innerJoin(
                        accommodations,
                        eq(accommodations.id, accommodationReviews.accommodationId)
                    )
                    .leftJoin(users, eq(users.id, accommodationReviews.userId))
                    .where(where)
                    .orderBy(
                        desc(accommodationReviewReplies.createdAt),
                        desc(accommodationReviewReplies.id)
                    )
                    .limit(input.pageSize)
                    .offset((input.page - 1) * input.pageSize),
                db
                    .select({ value: count() })
                    .from(accommodationReviewReplies)
                    .innerJoin(
                        accommodationReviews,
                        eq(accommodationReviews.id, accommodationReviewReplies.reviewId)
                    )
                    .where(where)
            ]);
            const items: AdminReplyRow[] = rows.map((row) => ({
                id: row.id,
                reviewId: row.reviewId,
                content: row.content,
                moderationState: row.moderationState as AdminReplyRow['moderationState'],
                moderationReason: row.moderationReason,
                moderatedAt: row.moderatedAt,
                createdAt: row.createdAt,
                editedAt: row.editedAt,
                accommodationId: row.accommodationId,
                reviewTitle: row.reviewTitle,
                reviewContent: row.reviewContent,
                reviewAverageRating: row.reviewAverageRating,
                reviewerName:
                    row.reviewerDisplayName ??
                    ([row.reviewerFirstName, row.reviewerLastName].filter(Boolean).join(' ') ||
                        null)
            }));
            return { items, total: Number(totals[0]?.value ?? 0) };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            throw new DbError(this.entityName, 'findAdminList', input, err.message, err);
        }
    }

    /**
     * The live replies the public may see for a set of reviews: not deleted and
     * APPROVED (PENDING and REJECTED never leave the author's own view).
     *
     * @param input.reviewIds - The reviews on the page being rendered.
     * @param tx - Optional transaction client.
     */
    async findPublicByReviewIds(
        input: { readonly reviewIds: readonly string[] },
        tx?: DrizzleClient
    ): Promise<
        Array<{ reviewId: string; content: string; createdAt: Date; editedAt: Date | null }>
    > {
        if (input.reviewIds.length === 0) return [];
        const db = this.getClient(tx);
        try {
            return await db
                .select({
                    reviewId: accommodationReviewReplies.reviewId,
                    content: accommodationReviewReplies.content,
                    createdAt: accommodationReviewReplies.createdAt,
                    editedAt: accommodationReviewReplies.editedAt
                })
                .from(accommodationReviewReplies)
                .where(
                    and(
                        inArray(accommodationReviewReplies.reviewId, [...input.reviewIds]),
                        isNull(accommodationReviewReplies.deletedAt),
                        eq(accommodationReviewReplies.moderationState, 'APPROVED')
                    )
                );
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            throw new DbError(this.entityName, 'findPublicByReviewIds', input, err.message, err);
        }
    }

    /**
     * Whether an admin ever moderated a DELETED reply of this review (it was
     * rejected, or carries a moderator). A new reply on such a review must not
     * skip human review, or deleting and re-posting would undo the admin's decision.
     *
     * @param input.reviewId - The review.
     * @param tx - Optional transaction client.
     */
    async hasAdminModeratedDeletedReply(
        input: { readonly reviewId: string },
        tx?: DrizzleClient
    ): Promise<boolean> {
        const db = this.getClient(tx);
        try {
            const rows = await db
                .select({ id: accommodationReviewReplies.id })
                .from(accommodationReviewReplies)
                .where(
                    and(
                        eq(accommodationReviewReplies.reviewId, input.reviewId),
                        isNotNull(accommodationReviewReplies.deletedAt),
                        or(
                            eq(accommodationReviewReplies.moderationState, 'REJECTED'),
                            isNotNull(accommodationReviewReplies.moderatedById)
                        )
                    )
                )
                .limit(1);
            return rows.length > 0;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            throw new DbError(
                this.entityName,
                'hasAdminModeratedDeletedReply',
                input,
                err.message,
                err
            );
        }
    }
}
