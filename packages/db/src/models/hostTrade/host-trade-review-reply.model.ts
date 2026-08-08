import type { HostTradeReviewReply } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeReviewReplies } from '../../schemas/host-trade/host_trade_review_reply.dbschema.ts';

/**
 * Row shape for `host_trade_review_replies`.
 *
 * The `@repo/schemas` entity, not `typeof table.$inferSelect`: Drizzle widens
 * the pgEnum columns to `string`, which does not satisfy `BaseModel<TEntity>`
 * once this model is bound to `BaseCrudService<HostTradeReviewReply, …>`. Same
 * reason `HostTradeReviewModel` and `HostTradeBenefitUsageModel` were retyped
 * when their services landed.
 */
type HostTradeReviewReplyRow = HostTradeReviewReply;

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
