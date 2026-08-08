import type { HostTradeReview } from '@repo/schemas';
import { BaseModelImpl } from '../../base/base.model.ts';
import { hostTradeReviews } from '../../schemas/host-trade/host_trade_review.dbschema.ts';

/**
 * Row shape for `host_trade_reviews`.
 *
 * The `@repo/schemas` entity, not `typeof table.$inferSelect`: Drizzle widens
 * the pgEnum columns to `string`, which does not satisfy `BaseModel<TEntity>`
 * once this model is bound to `BaseCrudService<HostTradeReview, …>`. Same
 * reason `HostTradeBenefitUsageModel` was retyped when its service landed.
 */
type HostTradeReviewRow = HostTradeReview;

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
