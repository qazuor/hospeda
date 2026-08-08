import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeReviewReplies } from '../../schemas/host-trade/host_trade_review_reply.dbschema.ts';

/** Drizzle-inferred row shape for `host_trade_review_replies`. */
type HostTradeReviewReplyRow = typeof hostTradeReviewReplies.$inferSelect;

/**
 * Model for the `host_trade_review_replies` table (HOS-376).
 *
 * Standard CRUD via {@link BaseModelImpl}. One reply per review, enforced by a
 * UNIQUE index on `reviewId` — a right of response, not a thread.
 *
 * Unlike the review it answers, a reply is born `PENDING` (spec §6.4): it is
 * written by someone with a wounded commercial interest who was physically at
 * the host's address, which is a doxxing vector the review itself does not
 * carry.
 */
export class HostTradeReviewReplyModel extends BaseModelImpl<HostTradeReviewReplyRow> {
    protected table = hostTradeReviewReplies;
    public entityName = 'hostTradeReviewReplies';

    protected getTableName(): string {
        return 'hostTradeReviewReplies';
    }
}

/** Singleton instance of HostTradeReviewReplyModel. */
export const hostTradeReviewReplyModel = new HostTradeReviewReplyModel();
