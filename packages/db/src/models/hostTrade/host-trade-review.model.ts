import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeReviews } from '../../schemas/host-trade/host_trade_review.dbschema.ts';

/** Drizzle-inferred row shape for `host_trade_reviews`. */
type HostTradeReviewRow = typeof hostTradeReviews.$inferSelect;

/**
 * Model for the `host_trade_reviews` table (HOS-376).
 *
 * Standard CRUD via {@link BaseModelImpl}, including soft-delete and restore.
 *
 * No custom finders yet, and that is deliberate: the two lookups this domain
 * needs are already served elsewhere. "Has this host reviewed this provider?"
 * is a `findOne` against the UNIQUE `(hostUserId, hostTradeId)` pair, and the
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
}

/** Singleton instance of HostTradeReviewModel. */
export const hostTradeReviewModel = new HostTradeReviewModel();
