import type { HostTradeReview } from '@repo/schemas';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeReviews } from '../../schemas/host-trade/host_trade_review.dbschema.ts';
import { hostTradeReviewReplies } from '../../schemas/host-trade/host_trade_review_reply.dbschema.ts';
import { users } from '../../schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { buildWhereClause } from '../../utils/drizzle-helpers.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Row shape for `host_trade_reviews`.
 *
 * The `@repo/schemas` entity, not `typeof table.$inferSelect`: Drizzle widens
 * the pgEnum columns to `string`, which does not satisfy `BaseModel<TEntity>`
 * once this model is bound to `BaseCrudService<HostTradeReview, …>`. Same
 * reason `HostTradeBenefitUsageModel` was retyped when its service landed.
 */
type HostTradeReviewRow = HostTradeReview;

/** One directory row: the review, who wrote it, and the answer if it is public. */
export type HostTradeReviewWithAuthorAndReply = {
    review: HostTradeReviewRow;
    author: {
        id: string;
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        image: string | null;
    } | null;
    reply: {
        id: string;
        content: string;
        reviewEditedAfterReply: boolean;
        createdAt: Date;
        updatedAt: Date;
    } | null;
};

/**
 * Model for the `host_trade_reviews` table (HOS-376).
 *
 * Standard CRUD via {@link BaseModelImpl}, including soft-delete and restore,
 * plus the one directory read that cannot be expressed as a `findAll`.
 *
 * "Has this host reviewed this provider?" is NOT here on purpose: it is a
 * `findOne` against the UNIQUE `(hostUserId, hostTradeId)` pair, and the
 * eligibility gate that precedes it belongs to
 * `HostTradeBenefitUsageModel.findConfirmedPair` — the usage is the
 * precondition, not the review.
 */
export class HostTradeReviewModel extends BaseModelImpl<HostTradeReviewRow> {
    protected table = hostTradeReviews;
    public entityName = 'hostTradeReviews';

    protected getTableName(): string {
        return 'hostTradeReviews';
    }

    /**
     * The directory listing: reviews matching `where`, each with its author and
     * its answer.
     *
     * THE `where` IS APPLIED VERBATIM and this method adds nothing to it. Which
     * reviews are publishable is the service's decision (it forces
     * `moderationState` and `deletedAt` after spreading the caller's filters);
     * repeating that rule here would create a second place to get §6.4 wrong,
     * and the two copies would drift the first time one of them changed.
     *
     * THE REPLY CONDITION IS DIFFERENT and does live here, because it is a JOIN
     * predicate rather than a filter: an unapproved answer must remove the
     * ANSWER, never the review it hangs off. Expressed as a `WHERE` it would
     * drop the review too — silently hiding a complaint because the provider's
     * reply to it is still awaiting moderation, which is the exact opposite of
     * what §6.4 asks for.
     *
     * Explicit joins rather than Drizzle's relational query API: the review
     * table declares no inverse `reply` relation, and adding one would make
     * `host_trade_review.dbschema.ts` import the reply schema that already
     * imports it back.
     *
     * @param where - Filters, already decided by the caller.
     * @param options - Page window. Unpaginated when absent.
     * @param tx - Optional transaction client.
     * @returns The page and the total matching the same `where`.
     */
    async findAllWithAuthorAndReply(
        where: Record<string, unknown>,
        options?: { page?: number; pageSize?: number },
        tx?: DrizzleClient
    ): Promise<{ items: HostTradeReviewWithAuthorAndReply[]; total: number }> {
        const db = this.getClient(tx);
        const safeWhere = where ?? {};
        const page = options?.page;
        const pageSize = options?.pageSize;
        const logContext = { where: safeWhere, page, pageSize };

        try {
            const whereClause = buildWhereClause(safeWhere, this.table);

            const baseQuery = db
                .select({
                    review: hostTradeReviews,
                    author: {
                        id: users.id,
                        displayName: users.displayName,
                        firstName: users.firstName,
                        lastName: users.lastName,
                        image: users.image
                    },
                    reply: {
                        id: hostTradeReviewReplies.id,
                        content: hostTradeReviewReplies.content,
                        reviewEditedAfterReply: hostTradeReviewReplies.reviewEditedAfterReply,
                        createdAt: hostTradeReviewReplies.createdAt,
                        updatedAt: hostTradeReviewReplies.updatedAt
                    }
                })
                .from(hostTradeReviews)
                .leftJoin(users, eq(users.id, hostTradeReviews.hostUserId))
                .leftJoin(
                    hostTradeReviewReplies,
                    and(
                        eq(hostTradeReviewReplies.reviewId, hostTradeReviews.id),
                        eq(hostTradeReviewReplies.moderationState, 'APPROVED'),
                        isNull(hostTradeReviewReplies.deletedAt)
                    )
                )
                .where(whereClause)
                .orderBy(desc(hostTradeReviews.createdAt));

            const rows =
                page !== undefined && pageSize !== undefined
                    ? await baseQuery.limit(pageSize).offset((page - 1) * pageSize)
                    : await baseQuery;

            const total =
                page !== undefined && pageSize !== undefined
                    ? await this.count(safeWhere, { tx })
                    : rows.length;

            const result = {
                items: rows as unknown as HostTradeReviewWithAuthorAndReply[],
                total
            };

            try {
                logQuery(this.entityName, 'findAllWithAuthorAndReply', logContext, result);
            } catch {}

            return result;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            try {
                logError(this.entityName, 'findAllWithAuthorAndReply', logContext, err);
            } catch {}
            throw new DbError(
                this.entityName,
                'findAllWithAuthorAndReply',
                logContext,
                err.message
            );
        }
    }
}

/** Singleton instance of HostTradeReviewModel. */
export const hostTradeReviewModel = new HostTradeReviewModel();
